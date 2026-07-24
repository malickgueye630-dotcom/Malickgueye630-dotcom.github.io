// Nour — passerelle RAG conversationnelle pour Cloudflare Workers.
//
// Le navigateur effectue la récupération locale dans les données vérifiées de
// Nour. Le Worker reformule la question avec le LLM, puis rédige une réponse
// exclusivement à partir des sources récupérées. Les citations sont validées
// côté serveur avant que la réponse ne soit renvoyée au navigateur.
import { SOURCE_FINGERPRINTS } from './source-fingerprints.js';

const API_VERSION = '2026-07-24';
const MAX_BODY_BYTES = 64 * 1024;
const MAX_HISTORY = 12;
const MAX_SOURCES = 14;
const MAX_SOURCE_TEXT = 2400;
const localRateBuckets = new Map();

const SOURCE_ID = /^(?:Q:\d{1,3}:\d{1,3}|H:[a-z0-9_-]+:\d+|D:[a-z0-9_-]+|N:[a-z0-9_-]+)$/i;
const SOURCE_LINK = /^#\/(?:quran\/s\/\d+(?:\?v=\d+)?|hadith\/[a-z0-9_-]+\/find\/\d+|duas\/[a-z0-9_-]+(?:\?d=[a-z0-9_-]+)?)$/i;
const REFERENCE_PATTERNS = [
  /\bCoran\s+\d{1,3}\s*[:.]\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?/gi,
  /\b(?:Sahih\s+)?(?:al-)?(?:Bukhari|Boukhari|Muslim|Abu Dawud|Tirmidhi|Nasa[’']?i|Ibn Majah)\s+\d+\b/gi,
];

const PLANNER_SYSTEM = `Tu es le module de compréhension de l'assistant islamique Nour.
Tu ne réponds pas à la question religieuse. À partir du dernier message et de
l'historique, tu dois produire une requête de recherche autonome en français.
Corrige les fautes et résous les références comme « cela » grâce à l'historique.
Si la demande est réellement ambiguë et qu'une recherche fiable exige un choix,
pose une seule question de clarification. Retourne uniquement un objet JSON :
{"search_query":"...","clarification":null,"style":"simple|detaille|enfant|resume","intent":"question|sources|reformulation|comparaison"}.
N'ajoute aucun texte avant ou après le JSON.`;

const ANSWER_SYSTEM = `Tu es l'assistant islamique conversationnel de Nour.
Tu réponds en français avec clarté, respect et nuance.

RÈGLES ABSOLUES :
1. Utilise uniquement les SOURCES AUTORISÉES fournies dans le message.
2. N'utilise aucune connaissance religieuse extérieure, même si tu la connais.
3. N'invente jamais de verset, hadith, invocation, référence, règle ou consensus.
4. Chaque affirmation religieuse importante doit porter un identifiant de source
   exactement sous la forme [Q:2:43], [H:bukhari:1], [D:peur] ou [N:priere].
5. Ne cite jamais un identifiant absent des SOURCES AUTORISÉES.
6. Distingue explicitement Coran, hadith authentifié, invocation et explication.
7. Si les sources ne suffisent pas, dis-le et mets insufficient_sources à true.
8. Ne donne pas de fatwa personnelle. Pour un cas individuel sensible, signale
   qu'une personne qualifiée doit être consultée.
9. N'altère pas le sens des traductions fournies et ne traduis pas toi-même l'arabe.

Retourne uniquement ce JSON, sans balise Markdown :
{
  "answer_directe":"réponse courte avec citations [ID]",
  "explication":"explication rédigée avec citations [ID]",
  "nuances":["nuance sourcée ou prudence"],
  "citations":[{"id":"ID","usage":"raison de l'utilisation"}],
  "insufficient_sources":false,
  "follow_up_suggestions":["question courte","question courte"]
}`;

class ApiError extends Error {
  constructor(message, status = 500, code = 'internal_error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      if (!cors) return json({ error: 'origin_not_allowed' }, 403, {});
      return new Response(null, { status: 204, headers: cors });
    }
    if (!cors) return json({ error: 'origin_not_allowed' }, 403, {});

    if (request.method === 'GET' && url.pathname.endsWith('/v1/health')) {
      return json({
        ok: true,
        configured: modelConfigured(env),
        api_version: API_VERSION,
        provider: env.LLM_PROVIDER_NAME || 'OpenAI-compatible',
        model: env.LLM_MODEL || null,
        retrieval: 'local-browser',
        generation: modelConfigured(env) ? 'remote-llm' : 'unavailable',
      }, 200, cors);
    }

    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405, cors);
    }
    if (!url.pathname.endsWith('/v1/plan') && !url.pathname.endsWith('/v1/chat')) {
      return json({ error: 'not_found' }, 404, cors);
    }

    try {
      await enforceRateLimit(request, env);
      if (!modelConfigured(env)) {
        throw new ApiError('Aucun modèle distant n’est configuré.', 503, 'model_not_configured');
      }
      const body = await readJson(request);
      if (url.pathname.endsWith('/v1/plan')) {
        const result = await planRequest(body, env);
        return json(result, 200, cors);
      }
      const result = await answerRequest(body, env);
      return json(result, 200, cors);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 502;
      const code = error instanceof ApiError ? error.code : 'provider_unavailable';
      return json({
        error: code,
        message: status >= 500
          ? 'Le modèle distant est momentanément indisponible.'
          : error.message,
        fallback: 'local',
      }, status, cors);
    }
  },
};

export async function planRequest(body, env) {
  const message = cleanText(body?.message, 1200);
  if (!message) throw new ApiError('message requis', 400, 'invalid_request');
  const history = sanitizeHistory(body?.history);
  const content = await callModel(env, [
    { role: 'system', content: PLANNER_SYSTEM },
    ...history,
    { role: 'user', content: message },
  ], { maxTokens: 350, temperature: 0.05 });
  const parsed = parseModelJson(content);
  const style = ['simple', 'detaille', 'enfant', 'resume'].includes(parsed?.style)
    ? parsed.style : inferStyle(message);
  return {
    search_query: cleanText(parsed?.search_query, 700) || message,
    clarification: cleanText(parsed?.clarification, 500) || null,
    style,
    intent: ['question', 'sources', 'reformulation', 'comparaison'].includes(parsed?.intent)
      ? parsed.intent : 'question',
    model: publicModel(env),
  };
}

export async function answerRequest(body, env) {
  const message = cleanText(body?.message, 1200);
  const searchQuery = cleanText(body?.search_query, 700) || message;
  if (!message) throw new ApiError('message requis', 400, 'invalid_request');
  const history = sanitizeHistory(body?.history);
  const submittedSources = sanitizeSources(body?.sources);
  const sources = await verifyCorpusSources(submittedSources);
  if (!sources.length) {
    return {
      response: insufficientAnswer(),
      sources: [],
      validation: {
        status: submittedSources.length ? 'corpus-rejected' : 'insufficient',
        checked: submittedSources.length,
      },
      model: publicModel(env),
    };
  }

  const sourceBlock = sources.map(source => {
    const details = [
      `type=${source.type}`,
      `référence=${source.ref}`,
      source.grade ? `degré=${source.grade}` : '',
      `texte_fr=${source.text}`,
    ].filter(Boolean).join(' ; ');
    return `[${source.id}] ${details}`;
  }).join('\n');

  const userPrompt = `QUESTION ACTUELLE :
${message}

REQUÊTE DE RECHERCHE REFORMULÉE :
${searchQuery}

STYLE DEMANDÉ :
${cleanText(body?.style, 30) || 'simple'}

SOURCES AUTORISÉES :
${sourceBlock}

Rédige la réponse structurée. Toute citation doit utiliser exactement l'un des
identifiants ci-dessus. Si ces sources ne répondent pas assez précisément,
reconnais explicitement la limite.`;

  const content = await callModel(env, [
    { role: 'system', content: ANSWER_SYSTEM },
    ...history,
    { role: 'user', content: userPrompt },
  ], { maxTokens: 1200, temperature: 0.12 });

  const parsed = parseModelJson(content);
  if (!parsed) throw new ApiError('Réponse du modèle invalide.', 502, 'invalid_model_output');
  const checked = validateGeneratedAnswer(parsed, sources);
  return {
    response: checked.response,
    sources: checked.sources,
    validation: checked.validation,
    model: publicModel(env),
  };
}

export function validateGeneratedAnswer(value, sources) {
  const allowed = new Map(sources.map(source => [source.id.toUpperCase(), source]));
  const sections = [
    cleanText(value?.answer_directe, 2400),
    cleanText(value?.explication, 6000),
    ...(Array.isArray(value?.nuances) ? value.nuances.map(item => cleanText(item, 1000)) : []),
  ].filter(Boolean);
  const allText = sections.join('\n');
  const cited = new Set();
  const unknown = new Set();

  for (const match of allText.matchAll(/\[([A-Z]:[^\]\s]+)\]/gi)) {
    const id = match[1].toUpperCase();
    if (allowed.has(id)) cited.add(id);
    else unknown.add(id);
  }
  for (const item of Array.isArray(value?.citations) ? value.citations : []) {
    const id = cleanText(typeof item === 'string' ? item : item?.id, 100).toUpperCase();
    if (!id) continue;
    if (allowed.has(id)) cited.add(id);
    else unknown.add(id);
  }

  const allowedRefs = sources.map(source => normalizeReference(source.ref));
  for (const pattern of REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of allText.matchAll(pattern)) {
      const ref = normalizeReference(match[0]);
      if (!allowedRefs.some(allowedRef => allowedRef.includes(ref) || ref.includes(allowedRef))) {
        unknown.add(match[0]);
      }
    }
  }

  const insufficient = Boolean(value?.insufficient_sources);
  if (unknown.size || (!insufficient && cited.size === 0)) {
    return {
      response: insufficientAnswer(),
      sources: [],
      validation: {
        status: 'rejected',
        checked: sources.length,
        reason: unknown.size ? 'unknown_citation' : 'missing_citation',
      },
    };
  }

  const usedSources = [...cited].map(id => allowed.get(id)).filter(Boolean);
  return {
    response: {
      answer_directe: cleanText(value.answer_directe, 2400)
        || 'Les sources disponibles ne permettent pas une réponse directe suffisamment sûre.',
      explication: cleanText(value.explication, 6000),
      nuances: (Array.isArray(value.nuances) ? value.nuances : [])
        .map(item => cleanText(item, 1000)).filter(Boolean).slice(0, 6),
      citation_ids: [...cited],
      insufficient_sources: insufficient,
      follow_up_suggestions: (Array.isArray(value.follow_up_suggestions)
        ? value.follow_up_suggestions : [])
        .map(item => cleanText(item, 180)).filter(Boolean).slice(0, 4),
    },
    sources: usedSources,
    validation: { status: 'validated', checked: sources.length, cited: usedSources.length },
  };
}

export function sanitizeSources(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const output = [];
  for (const raw of input.slice(0, MAX_SOURCES * 2)) {
    const id = cleanText(raw?.id, 100).toUpperCase();
    const type = cleanText(raw?.type, 30).toLowerCase();
    const ref = cleanText(raw?.ref, 180);
    const text = cleanText(raw?.text, MAX_SOURCE_TEXT);
    const url = cleanText(raw?.url, 240);
    if (!SOURCE_ID.test(id) || !['quran', 'hadith', 'dua', 'explanation'].includes(type)) continue;
    if (!ref || !text || !SOURCE_LINK.test(url) || seen.has(id)) continue;
    if (id.startsWith('Q:') && type !== 'quran') continue;
    if (id.startsWith('H:') && type !== 'hadith') continue;
    if (id.startsWith('D:') && type !== 'dua') continue;
    if (id.startsWith('N:') && type !== 'explanation') continue;
    seen.add(id);
    output.push({
      id,
      type,
      ref,
      text,
      url,
      title: cleanText(raw?.title, 180),
      grade: cleanText(raw?.grade, 80),
    });
    if (output.length >= MAX_SOURCES) break;
  }
  return output;
}

export async function verifyCorpusSources(sources) {
  const checked = await Promise.all((sources || []).map(async source => {
    const expected = SOURCE_FINGERPRINTS[source.id.toUpperCase()];
    if (!expected) return null;
    const actual = await sha256Hex(canonicalSource(source));
    return actual === expected ? source : null;
  }));
  return checked.filter(Boolean);
}

export function parseModelJson(content) {
  const text = cleanText(content, 16000);
  if (!text) return null;
  const unfenced = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(unfenced.slice(start, end + 1)); }
  catch { return null; }
}

async function callModel(env, messages, options = {}) {
  const endpoint = chatCompletionsUrl(env.LLM_BASE_URL);
  const controller = new AbortController();
  const timeout = clampNumber(env.LLM_TIMEOUT_MS, 5000, 60000, 30000);
  const timer = setTimeout(() => controller.abort(), timeout);
  const headerName = env.LLM_API_KEY_HEADER || 'Authorization';
  const prefix = env.LLM_API_KEY_PREFIX ?? (headerName.toLowerCase() === 'authorization' ? 'Bearer ' : '');
  const headers = { 'Content-Type': 'application/json' };
  headers[headerName] = `${prefix}${env.LLM_API_KEY}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: env.LLM_MODEL,
        messages,
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens ?? 1000,
        stream: false,
      }),
    });
    if (!response.ok) {
      throw new ApiError(`Fournisseur HTTP ${response.status}`, 502, 'provider_error');
    }
    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content;
    if (Array.isArray(content)) {
      const joined = content.map(part => part?.text || part?.content || '').join('');
      if (joined.trim()) return joined.trim();
    }
    if (typeof content !== 'string' || !content.trim()) {
      throw new ApiError('Réponse vide du fournisseur.', 502, 'empty_provider_response');
    }
    return content.trim();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === 'AbortError') {
      throw new ApiError('Délai du fournisseur dépassé.', 504, 'provider_timeout');
    }
    throw new ApiError('Fournisseur indisponible.', 502, 'provider_unavailable');
  } finally {
    clearTimeout(timer);
  }
}

async function enforceRateLimit(request, env) {
  const key = request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'unknown';
  if (env.RATE_LIMITER?.limit) {
    const result = await env.RATE_LIMITER.limit({ key });
    if (!result.success) throw new ApiError('Trop de requêtes.', 429, 'rate_limited');
    return;
  }

  // Secours pour le développement. En production, le binding RATE_LIMITER du
  // fichier Wrangler est utilisé par l'infrastructure Cloudflare.
  const now = Date.now();
  const windowMs = 60_000;
  const limit = clampNumber(env.NOUR_FALLBACK_RATE_LIMIT, 2, 60, 12);
  const bucket = localRateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    localRateBuckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    bucket.count += 1;
    if (bucket.count > limit) throw new ApiError('Trop de requêtes.', 429, 'rate_limited');
  }
  if (localRateBuckets.size > 2000) {
    for (const [bucketKey, value] of localRateBuckets) {
      if (value.resetAt <= now) localRateBuckets.delete(bucketKey);
    }
  }
}

async function readJson(request) {
  const announced = Number(request.headers.get('Content-Length') || 0);
  if (announced > MAX_BODY_BYTES) throw new ApiError('Corps trop volumineux.', 413, 'payload_too_large');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new ApiError('Corps trop volumineux.', 413, 'payload_too_large');
  }
  try { return JSON.parse(text); }
  catch { throw new ApiError('JSON invalide.', 400, 'invalid_json'); }
}

function sanitizeHistory(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(-MAX_HISTORY).map(item => {
    const role = item?.role === 'assistant' ? 'assistant' : 'user';
    return { role, content: cleanText(item?.content, 1800) };
  }).filter(item => item.content);
}

function insufficientAnswer() {
  return {
    answer_directe: 'Je ne dispose pas de sources vérifiées suffisantes dans la base de Nour pour répondre avec certitude.',
    explication: 'Essayez de préciser la question. Pour un avis religieux lié à une situation personnelle, consultez également un imam ou une personne qualifiée.',
    nuances: [],
    citation_ids: [],
    insufficient_sources: true,
    follow_up_suggestions: ['Peux-tu préciser ma question ?', 'Quelles sources sont disponibles ?'],
  };
}

function inferStyle(message) {
  const text = message.toLowerCase();
  if (/enfant|très simple|tres simple/.test(text)) return 'enfant';
  if (/résum|resum|court|bref/.test(text)) return 'resume';
  if (/détail|detail|davantage|approfond/.test(text)) return 'detaille';
  return 'simple';
}

function modelConfigured(env) {
  const model = String(env.LLM_MODEL || '').trim();
  return Boolean(
    env.LLM_BASE_URL
    && env.LLM_API_KEY
    && model
    && model !== 'A_CONFIGURER',
  );
}

function publicModel(env) {
  return {
    provider: env.LLM_PROVIDER_NAME || 'OpenAI-compatible',
    model: env.LLM_MODEL || null,
    remote: true,
  };
}

function chatCompletionsUrl(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) throw new ApiError('LLM_BASE_URL invalide.', 500, 'invalid_server_config');
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = String(env.NOUR_ALLOWED_ORIGINS || '')
    .split(',').map(item => item.trim()).filter(Boolean);
  const local = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin || '');
  if (origin && !allowed.includes(origin) && !(env.NOUR_ENV !== 'production' && local)) return null;
  if (!origin && request.method !== 'GET') return null;
  const selectedOrigin = origin || allowed[0] || 'https://malickgueye630-dotcom.github.io';
  return {
    'Access-Control-Allow-Origin': selectedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

function json(value, status, headers) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function cleanText(value, max) {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeReference(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[’']/g, '').replace(/\s+/g, '').replace(/\./g, ':');
}

function canonicalSource(source) {
  return [
    source.id.toUpperCase(),
    source.type,
    source.ref,
    source.text,
    source.url,
    source.title || '',
    source.grade || '',
  ].map(value => cleanText(value, MAX_SOURCE_TEXT + 500)).join('\n');
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export const __test = {
  SOURCE_ID,
  chatCompletionsUrl,
  insufficientAnswer,
  normalizeReference,
};
