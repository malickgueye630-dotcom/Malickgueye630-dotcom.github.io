// Assistant IA en ligne (optionnel, désactivé par défaut).
// L'app ne contient AUCUNE clé API : elle appelle uniquement une URL de proxy
// que l'utilisateur déploie lui-même (voir nour/server/). Le proxy garde la clé
// côté serveur — ou, avec Cloudflare Workers AI, n'a même pas besoin de clé
// (modèle open-source gratuit).
//
// Contrat RAG strict : le client fait d'abord la recherche locale (moteur
// vérifié), puis n'envoie au proxy QUE la question + les passages déjà trouvés.
// L'IA rédige une synthèse française à partir de ces passages uniquement ;
// le texte religieux affiché reste toujours celui de la base vérifiée.

function withTimeout(url, opts, ms = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// interroge le proxy avec la question + les passages sourcés ; renvoie le texte
export async function aiAnswer(query, passages, cfg) {
  if (!cfg || !cfg.endpoint) throw new Error('endpoint manquant');
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

// test de connexion simple pour les réglages
export async function aiPing(cfg) {
  const txt = await aiAnswer('test', [{ type: 'test', ref: '—', source: 'test', text: 'Ceci est un test de connexion.' }], cfg);
  return !!txt;
}
