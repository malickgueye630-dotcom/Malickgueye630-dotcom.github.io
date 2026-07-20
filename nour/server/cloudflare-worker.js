// Proxy IA pour Nour — à déployer sur Cloudflare Workers (gratuit).
// Voir README-IA.md pour le déploiement pas à pas.
//
// Rôle : recevoir { query, passages } depuis l'app, demander à un modèle de
// langage une synthèse EN FRANÇAIS rédigée UNIQUEMENT à partir des passages
// fournis, et renvoyer { answer }. La clé éventuelle reste ici, côté serveur,
// jamais dans l'app.
//
// Deux modes possibles :
//   1. GRATUIT (par défaut) : Cloudflare Workers AI (env.AI), modèle Llama
//      open-source. Aucune clé à gérer. Il suffit de lier [ai] dans wrangler.
//   2. PAYANT (optionnel) : si le secret ANTHROPIC_API_KEY est défini, on
//      utilise l'API Claude à la place (meilleure qualité). Idem pour d'autres
//      fournisseurs si vous adaptez callPaid().

const SYSTEM = [
  "Tu es l'assistant de Nour, une application musulmane.",
  "Tu réponds en français, avec respect et sobriété.",
  "RÈGLE ABSOLUE : tu ne réponds QU'À PARTIR des passages fournis ci-dessous.",
  "Tu n'inventes JAMAIS un verset, un hadith, une invocation ou une règle religieuse.",
  "Tu ne cites aucune référence qui n'est pas dans les passages.",
  "Si les passages ne suffisent pas pour répondre, dis-le honnêtement et invite",
  "l'utilisateur à consulter un savant. Ne comble jamais un manque par une invention.",
  "Rédige une synthèse claire et concise (3 à 6 phrases). Tu peux renvoyer aux",
  "passages par leur numéro entre crochets, ex. [1]. Ne traduis pas toi-même",
  "l'arabe : appuie-toi sur les traductions fournies.",
].join(' ');

// Construit le message utilisateur (question + passages numérotés).
function buildUserMessage(query, passages) {
  const lines = [];
  lines.push('Question : ' + String(query || '').slice(0, 500));
  lines.push('');
  lines.push('Passages vérifiés (seule source autorisée) :');
  (passages || []).slice(0, 12).forEach((p, i) => {
    const ref = [p.type, p.ref, p.source].filter(Boolean).join(' · ');
    const txt = String(p.text || '').slice(0, 700);
    lines.push(`[${i + 1}] (${ref}) ${txt}`);
  });
  lines.push('');
  lines.push('Rédige la synthèse en français à partir de ces passages uniquement.');
  return lines.join('\n');
}

// --- Mode gratuit : Cloudflare Workers AI ---------------------------------
async function callFree(env, query, passages) {
  const model = env.NOUR_MODEL || '@cf/meta/llama-3.1-8b-instruct';
  const out = await env.AI.run(model, {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildUserMessage(query, passages) },
    ],
    max_tokens: 512,
    temperature: 0.2,
  });
  // Workers AI renvoie { response: "..." }
  return (out && (out.response || out.result || '')).toString().trim();
}

// --- Mode payant : API Claude (si ANTHROPIC_API_KEY est défini) ------------
async function callPaid(env, query, passages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.NOUR_MODEL || 'claude-haiku-4-5',
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildUserMessage(query, passages) }],
    }),
  });
  if (!r.ok) throw new Error('Claude HTTP ' + r.status);
  const j = await r.json();
  const txt = (j.content || []).map(b => b.text || '').join('').trim();
  return txt;
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.NOUR_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Nour-Token',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') {
      return new Response('Méthode non autorisée', { status: 405, headers: cors });
    }

    // Jeton partagé optionnel : si NOUR_TOKEN est défini, on l'exige.
    if (env.NOUR_TOKEN && request.headers.get('X-Nour-Token') !== env.NOUR_TOKEN) {
      return new Response(JSON.stringify({ error: 'jeton invalide' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'JSON invalide' }, 400, cors); }

    const query = body && body.query;
    const passages = (body && body.passages) || [];
    if (!query || !Array.isArray(passages) || !passages.length) {
      return json({ error: 'query et passages requis' }, 400, cors);
    }

    try {
      const answer = env.ANTHROPIC_API_KEY
        ? await callPaid(env, query, passages)
        : await callFree(env, query, passages);
      if (!answer) return json({ error: 'réponse vide' }, 502, cors);
      return json({ answer }, 200, cors);
    } catch (e) {
      return json({ error: 'IA indisponible', detail: String(e).slice(0, 200) }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
