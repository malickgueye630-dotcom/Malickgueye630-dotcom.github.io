// Client du backend conversationnel. Aucune clé ni aucun jeton secret n'est
// stocké ici : le navigateur connaît uniquement l'URL publique du Worker.
import { ASSISTANT_CONFIG } from './assistant-config.js';
import { state } from './state.js';

let healthCache = null;
let healthAt = 0;

export class AssistantUnavailableError extends Error {
  constructor(message, code = 'assistant_unavailable') {
    super(message);
    this.name = 'AssistantUnavailableError';
    this.code = code;
  }
}
export function assistantEndpoint() {
  const configured = String(state.settings?.ai?.endpoint || ASSISTANT_CONFIG.endpoint || '').trim();
  return configured.replace(/\/+$/, '');
}

export async function aiHealth({ signal, refresh = false } = {}) {
  const endpoint = assistantEndpoint();
  if (!endpoint) {
    return {
      ok: false,
      configured: false,
      model: null,
      provider: null,
      mode: 'local',
    };
  }
  if (!refresh && healthCache && Date.now() - healthAt < 60_000) return healthCache;
  try {
    const result = await request('/v1/health', null, { method: 'GET', signal, timeout: 8000 });
    healthCache = { ...result, mode: result.configured ? 'remote' : 'local' };
  } catch {
    healthCache = { ok: false, configured: false, model: null, provider: null, mode: 'local' };
  }
  healthAt = Date.now();
  return healthCache;
}

export async function aiPlan({ message, history, signal }) {
  return request('/v1/plan', { message, history }, { signal });
}

export async function aiAnswer({ message, searchQuery, history, sources, style, signal }) {
  return request('/v1/chat', {
    message,
    search_query: searchQuery,
    history,
    sources,
    style,
  }, { signal });
}

async function request(path, payload, { method = 'POST', signal, timeout } = {}) {
  const endpoint = assistantEndpoint();
  if (!endpoint) throw new AssistantUnavailableError('Aucun backend conversationnel n’est configuré.', 'not_configured');
  if (!/^https:\/\//i.test(endpoint) && !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(endpoint)) {
    throw new AssistantUnavailableError('Adresse du backend invalide.', 'invalid_endpoint');
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeout || ASSISTANT_CONFIG.timeoutMs || 40_000);

  try {
    const response = await fetch(endpoint + path, {
      method,
      signal: controller.signal,
      cache: 'no-store',
      headers: method === 'GET' ? { Accept: 'application/json' } : {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: method === 'GET' ? undefined : JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AssistantUnavailableError(
        body.message || 'Le modèle distant est indisponible.',
        body.error || `http_${response.status}`,
      );
    }
    return body;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Génération arrêtée', 'AbortError');
    if (error?.name === 'AbortError') {
      throw new AssistantUnavailableError('Le modèle a mis trop de temps à répondre.', 'timeout');
    }
    if (error instanceof AssistantUnavailableError) throw error;
    throw new AssistantUnavailableError('Impossible de joindre le modèle distant.', 'network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
