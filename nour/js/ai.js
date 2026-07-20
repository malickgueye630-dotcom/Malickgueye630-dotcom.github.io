// Assistant IA en ligne (optionnel).
//
// Deux modes, tous deux SANS clé stockée dans l'app :
//
//   • 'simple'  — le plus facile : appelle directement un service d'IA public
//     et gratuit (Pollinations), sans clé, sans serveur à installer. Comme il
//     n'y a pas de proxy, c'est le client qui construit ici le prompt strict
//     (système + passages). Service partagé : peut être lent ou indisponible ;
//     l'app revient alors à la réponse locale sourcée.
//
//   • 'proxy'   — avancé : appelle une URL de proxy que l'utilisateur déploie
//     lui-même (voir nour/server/). Le proxy garde la clé côté serveur — ou,
//     avec Cloudflare Workers AI, n'a même pas besoin de clé. Le client
//     n'envoie que { query, passages } ; le proxy rédige la synthèse.
//
// Contrat RAG strict (dans les deux cas) : la recherche locale (moteur vérifié)
// est faite d'abord, puis seuls la question + les passages déjà trouvés sont
// transmis. L'IA rédige une synthèse française à partir de ces passages
// uniquement ; le texte religieux affiché reste toujours celui de la base.

function withTimeout(url, opts, ms = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// consigne stricte anti-invention, utilisée en mode simple (pas de serveur)
const SYSTEM = [
  "Tu es l'assistant de Nour, une application musulmane.",
  "Tu réponds en français, avec respect et sobriété.",
  "RÈGLE ABSOLUE : tu ne réponds QU'À PARTIR des passages fournis ci-dessous.",
  "Tu n'inventes JAMAIS un verset, un hadith, une invocation ou une règle religieuse.",
  "Tu ne cites aucune référence qui n'est pas dans les passages.",
  "Si les passages ne suffisent pas, dis-le honnêtement et invite à consulter un savant.",
  "Rédige une synthèse claire et concise (3 à 6 phrases). Tu peux renvoyer aux",
  "passages par leur numéro entre crochets, ex. [1]. Ne traduis pas toi-même l'arabe.",
].join(' ');

function buildUserMessage(query, passages) {
  const lines = ['Question : ' + String(query || '').slice(0, 500), '',
    'Passages vérifiés (seule source autorisée) :'];
  (passages || []).slice(0, 12).forEach((p, i) => {
    const ref = [p.type, p.ref, p.source].filter(Boolean).join(' · ');
    lines.push('[' + (i + 1) + '] (' + ref + ') ' + String(p.text || '').slice(0, 700));
  });
  lines.push('', 'Rédige la synthèse en français à partir de ces passages uniquement.');
  return lines.join('\n');
}

// --- Mode simple : service public gratuit, sans clé (Pollinations) ---------
const SIMPLE_ENDPOINT = 'https://text.pollinations.ai/';

async function aiAnswerSimple(query, passages) {
  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: buildUserMessage(query, passages) },
  ];
  const r = await withTimeout(SIMPLE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model: 'openai', private: true, referrer: 'nour-app' }),
  }, 30000);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  // le service renvoie du texte brut (parfois une enveloppe JSON) : on gère les deux
  const raw = (await r.text()).trim();
  if (!raw) throw new Error('réponse vide');
  let txt = raw;
  if (raw[0] === '{' || raw[0] === '[') {
    try {
      const j = JSON.parse(raw);
      txt = (j.choices && j.choices[0] && (j.choices[0].message?.content || j.choices[0].text))
        || j.response || j.answer || j.content || raw;
    } catch { /* on garde le texte brut */ }
  }
  txt = String(txt).trim();
  if (!txt) throw new Error('réponse vide');
  return txt;
}

// --- Mode proxy : URL déployée par l'utilisateur ---------------------------
async function aiAnswerProxy(query, passages, cfg) {
  const r = await withTimeout(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.token ? { 'X-Nour-Token': cfg.token } : {}),
    },
    body: JSON.stringify({ query, passages }),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!j || typeof j.answer !== 'string' || !j.answer.trim()) throw new Error('réponse vide');
  return j.answer.trim();
}

// point d'entrée : choisit le mode (simple par défaut)
export async function aiAnswer(query, passages, cfg) {
  if (cfg && cfg.mode === 'proxy') {
    if (!cfg.endpoint) throw new Error('endpoint manquant');
    return aiAnswerProxy(query, passages, cfg);
  }
  return aiAnswerSimple(query, passages);
}

// test de connexion pour les réglages
export async function aiPing(cfg) {
  const txt = await aiAnswer('Réponds simplement « ok ».',
    [{ type: 'Test', ref: '—', source: 'test', text: 'Ceci est un test de connexion.' }], cfg);
  return !!txt;
}
