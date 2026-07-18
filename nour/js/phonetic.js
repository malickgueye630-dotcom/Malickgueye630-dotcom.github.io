// Recherche phonétique du Coran : l'utilisateur écrit ce qu'il entend
// (« lakhadjaakoul », « laqad jaakoum »…) et on retrouve les versets dont
// la translittération est proche. Normalisation agressive des variantes
// d'écriture latine de l'arabe, puis correspondance par n-grammes et
// distance d'édition bornée sur fenêtre glissante.
import { quranSearchIndex } from './data.js';

let INDEX = null; // [{s, v, raw, key}]

// --- normalisation phonétique commune requête / index ---
export function phoneticKey(s) {
  let t = (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')       // accents
    .replace(/[’'`´ʿʾ‘ʼ-]/g, '')                  // hamza / ayn / tirets
    // digraphes d'abord (avant les lettres seules)
    .replace(/gh/g, 'r')                          // غ entendu comme un r français
    .replace(/kh/g, 'k')                          // خ souvent écrit kh/k/q par les francophones
    .replace(/sh/g, 'c').replace(/ch/g, 'c')      // ش
    .replace(/dh/g, 'd').replace(/th/g, 't')
    .replace(/dj/g, 'j').replace(/ph/g, 'f')
    .replace(/ou/g, 'u').replace(/oo/g, 'u').replace(/ee/g, 'i')
    // arabe de chat (chiffres)
    .replace(/7/g, 'h').replace(/5/g, 'k').replace(/9/g, 'k')
    .replace(/3/g, 'a').replace(/2/g, 'a').replace(/8/g, 'g')
    // lettres seules → classes
    .replace(/q/g, 'k').replace(/g/g, 'j')
    .replace(/o/g, 'u').replace(/e/g, 'a').replace(/y/g, 'i')
    .replace(/w/g, 'u').replace(/v/g, 'u')
    .replace(/x/g, 'ks').replace(/z/g, 's')
    .replace(/[^a-z]/g, '');
  // voyelles longues et lettres doublées réduites
  t = t.replace(/(.)\1+/g, '$1');
  return t;
}

async function ensureIndex() {
  if (INDEX) return INDEX;
  const raw = await (await fetch('data/quran/phonetic.json')).json();
  INDEX = raw.map(([s, v, tr]) => ({ s, v, raw: tr, key: phoneticKey(tr) }));
  return INDEX;
}

// Distance d'édition minimale entre l'aiguille et N'IMPORTE QUELLE sous-chaîne
// du texte (alignement semi-global : début et fin libres dans le texte).
function approxSubstringDist(needle, hay, max) {
  if (hay.includes(needle)) return 0;
  const L = needle.length;
  // dp[i] = coût minimal pour aligner needle[0..i) en terminant à la position courante de hay
  const dp = Array.from({ length: L + 1 }, (_, i) => i);
  let best = max + 1;
  for (let j = 1; j <= hay.length; j++) {
    let prev = dp[0]; // dp[0] reste 0 : départ libre dans hay
    let rowMin = 0;
    for (let i = 1; i <= L; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (needle[i - 1] === hay[j - 1] ? 0 : 1));
      prev = tmp;
      if (dp[i] < rowMin) rowMin = dp[i];
    }
    if (dp[L] < best) best = dp[L]; // fin libre : on peut s'arrêter ici
    if (best === 0) return 0;
  }
  return best;
}

function searchKey(idx, key, limit) {
  const max = key.length >= 16 ? 4 : key.length >= 12 ? 3 : key.length >= 8 ? 2 : 1;

  // préfiltre par trigrammes
  const grams = [];
  for (let i = 0; i <= key.length - 3; i++) grams.push(key.slice(i, i + 3));
  const need = Math.max(1, Math.floor(grams.length * 0.4));

  const candidates = [];
  for (const e of idx) {
    let hit = 0;
    for (const g of grams) if (e.key.includes(g)) hit++;
    if (hit >= need) candidates.push([e, hit / grams.length]);
  }
  candidates.sort((a, b) => b[1] - a[1]);

  const out = [];
  for (const [e, gramScore] of candidates.slice(0, 400)) {
    const d = approxSubstringDist(key, e.key, max);
    if (d <= max) {
      out.push({ s: e.s, v: e.v, translit: e.raw, dist: d, score: (1 - d / (max + 1)) * 2 + gramScore });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

// Variantes de la requête : « dj » peut être un ج seul (djinn) ou د+ج
// (laqad jaakum), « kh » est écrit k ou h selon les habitudes.
function queryKeys(query) {
  const variants = new Set([query]);
  if (/dj/i.test(query)) variants.add(query.replace(/dj/gi, 'd j'));
  if (/kh/i.test(query)) {
    for (const v of [...variants]) variants.add(v.replace(/kh/gi, 'h'));
  }
  const keys = new Set();
  for (const v of variants) {
    const k = phoneticKey(v);
    if (k.length >= 5) keys.add(k);
  }
  return [...keys];
}

function mergeBest(seen, results, extra = {}) {
  for (const r of results) {
    const id = `${r.s}:${r.v}`;
    const prev = seen.get(id);
    if (!prev || prev.score < r.score) seen.set(id, { ...r, ...extra });
  }
}

// Recherche principale. Si la requête complète ne donne rien (par exemple
// parce qu'elle chevauche deux versets), on la découpe en tronçons de mots.
export async function phoneticSearch(query, { limit = 12 } = {}) {
  const idx = await ensureIndex();
  const seen = new Map();
  for (const key of queryKeys(query)) mergeBest(seen, searchKey(idx, key, limit));
  let out = [...seen.values()].sort((a, b) => b.score - a.score);
  if (out.length) return out.slice(0, limit);

  const words = (query.toLowerCase().match(/[a-z0-9''`´ʿ]+/g) || []);
  if (words.length >= 4) {
    const size = Math.min(4, words.length - 1);
    const starts = new Set();
    for (let i = 0; i + size <= words.length; i += Math.max(1, size - 1)) starts.add(i);
    starts.add(words.length - size); // ne jamais sauter la fin de la requête
    for (const i of starts) {
      const chunk = words.slice(i, i + size).join(' ');
      for (const key of queryKeys(chunk)) mergeBest(seen, searchKey(idx, key, 6), { partial: true });
    }
    out = [...seen.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }
  return out;
}

// Suggestions rapides pendant la frappe (préfixe phonétique de début de verset)
export async function phoneticSuggest(query, { limit = 5 } = {}) {
  const key = phoneticKey(query);
  if (key.length < 5) return [];
  const idx = await ensureIndex();
  const out = [];
  for (const e of idx) {
    if (e.key.startsWith(key) || e.key.includes(key)) {
      out.push({ s: e.s, v: e.v, translit: e.raw });
      if (out.length >= limit) break;
    }
  }
  return out;
}
