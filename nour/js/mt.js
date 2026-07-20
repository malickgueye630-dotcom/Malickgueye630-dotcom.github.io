// Traduction automatique de secours (anglais → français).
// UNIQUEMENT pour les hadiths dont il n'existe pas encore de traduction
// française fiable dans notre base. Utilise l'API publique et gratuite
// MyMemory (sans clé). Le résultat est TOUJOURS étiqueté « Traduction
// automatique depuis l'anglais » et n'est jamais présenté comme une traduction
// religieuse officielle ; la source et l'arabe d'origine restent affichés.
// Nécessite une connexion ; en cas d'échec, l'utilisateur en est informé.

function withTimeout(url, ms = 11000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// découpe en morceaux ≤ 450 caractères (limite de l'API anonyme) sur les phrases
function chunk(text, max = 450) {
  const parts = [];
  let buf = '';
  for (const seg of text.split(/(?<=[.!?])\s+/)) {
    if ((buf + ' ' + seg).length > max && buf) { parts.push(buf); buf = seg; }
    else buf = buf ? buf + ' ' + seg : seg;
  }
  if (buf) parts.push(buf);
  return parts;
}

export async function translateEnFr(text) {
  const chunks = chunk(String(text || '').trim());
  if (!chunks.length) throw new Error('empty');
  const out = [];
  for (const c of chunks) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(c)}&langpair=en|fr`;
    const r = await withTimeout(url);
    if (!r.ok) throw new Error('http');
    const j = await r.json();
    const t = j?.responseData?.translatedText;
    if (!t) throw new Error('no-translation');
    out.push(t);
  }
  return out.join(' ');
}
