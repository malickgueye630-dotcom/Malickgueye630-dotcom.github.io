// Recherche globale : Coran (FR + noms de sourates), invocations, hadiths.
// Tolérante aux fautes : pliage des accents, variantes (doua/du'â…),
// correspondance par sous-chaîne et distance d'édition légère.
// Aucune génération de contenu : uniquement les textes de la base.
import * as data from './data.js';

const ALIASES = [
  [/\bdou?[aâ']a?s?\b/g, 'dua'], [/\bdu[aâ'‘']a?s?\b/g, 'dua'], [/\binvocations?\b/g, 'dua'],
  [/\bsou?rate?s?\b/g, 'sura'], [/\bsurah?s?\b/g, 'sura'],
  [/\bhadith?s?\b/g, 'hadith'], [/\bhadis\b/g, 'hadith'], [/\bhadeeth?s?\b/g, 'hadith'],
  [/\badh?kars?\b/g, 'dhikr'], [/\bazkars?\b/g, 'dhikr'],
  [/\bcoran\b/g, 'quran'], [/\bqour'?an\b/g, 'quran'], [/\bquran\b/g, 'quran'],
  [/\bsalat\b/g, 'priere'], [/\bsalah\b/g, 'priere'], [/\bnamaz\b/g, 'priere'],
  [/\bsawm\b/g, 'jeune'], [/\bsiyam\b/g, 'jeune'],
  [/\bzakat\b/g, 'aumone'], [/\bsadaqa\b/g, 'aumone'],
];

export function fold(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´‘]/g, "'")
    .replace(/œ/g, 'oe')
    .replace(/[^a-z0-9'\s:-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function aliasFold(s) {
  let t = fold(s);
  for (const [re, rep] of ALIASES) t = t.replace(re, rep);
  return t;
}

const STOP = new Set(['le','la','les','de','des','du','un','une','et','ou','a','au','aux','en','pour','sur','que','qui','quoi','dire','dit','avant','apres','quand','lorsqu','on','je','me','ma','mon','mes','chez','moi','dans','ce','cette','est','il','elle','faire','islam','musulman','avec','sans','se','sa','son','ses']);

function editDistLe(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  // Levenshtein borné, petite taille
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[a.length] <= max;
}

// un token correspond-il quelque part dans le texte plié ?
function tokenIn(tok, text, words) {
  if (text.includes(tok)) return 2;                       // sous-chaîne exacte
  if (tok.length >= 5) {
    const max = tok.length >= 8 ? 2 : 1;
    for (const w of words) {
      if (Math.abs(w.length - tok.length) <= max && editDistLe(tok, w, max)) return 1;
    }
  }
  return 0;
}

export function tokens(q) {
  return aliasFold(q).split(/[\s']+/).filter(t => t.length > 1 && !STOP.has(t));
}

// mots-clés d'intention → catégories à mettre en avant
export function intent(q) {
  const t = aliasFold(q);
  return {
    dua: /\bdua\b|\bdhikr\b/.test(t),
    quran: /\bquran\b|\bsura\b|\bverset\b|\bayat?\b|\bjuz\b|\bhizb\b/.test(t),
    hadith: /\bhadith\b/.test(t),
  };
}

function score(toks, text) {
  const folded = aliasFold(text);
  const words = folded.split(' ');
  let s = 0, matched = 0;
  for (const t of toks) {
    const m = tokenIn(t, folded, words);
    if (m) { matched++; s += m; }
  }
  return matched === 0 ? 0 : s + matched / toks.length;
}

const CONTENT_TOKENS = new Set(['dua', 'hadith', 'quran', 'sura', 'dhikr', 'verset']);

export async function globalSearch(q, opts = {}) {
  const toks = tokens(q);
  const inten = intent(q);
  // tokens de contenu (hors mots d'intention, sauf s'il n'y a qu'eux)
  let content = toks.filter(t => !CONTENT_TOKENS.has(t));
  if (!content.length) content = toks;
  if (!content.length) return { verses: [], surahs: [], duas: [], hadiths: [], collections: [], intent: inten };

  const [idx, duasDb, hfr] = await Promise.all([data.quranIndex(), data.duas(), data.hadithsFr()]);

  // — sourates par nom
  const surahs = [];
  for (const s of idx.surahs) {
    const sc = score(content, `${s.phonetic} ${s.fr} sourate ${s.n}`);
    if (sc > 0) surahs.push({ ...s, _s: sc + 2 });
  }
  surahs.sort((a, b) => b._s - a._s);

  // — versets (index FR chargé à la demande)
  let verses = [];
  if (!opts.skipVerses) {
    const vi = await data.quranSearchIndex();
    for (const [s, v, fr] of vi) {
      const sc = score(content, fr);
      if (sc > 0) verses.push({ s, v, fr, _s: sc });
    }
    verses.sort((a, b) => b._s - a._s);
    verses = verses.slice(0, 30);
  }

  // — invocations
  const duas = [];
  for (const cat of duasDb.categories) {
    for (const d of cat.duas) {
      const sc = score(content, `${d.title} ${d.fr} ${d.translit} ${cat.name} ${d.note || ''}`);
      if (sc > 0) duas.push({ ...d, cat: cat.id, catName: cat.name, icon: cat.icon, _s: sc });
    }
  }
  duas.sort((a, b) => b._s - a._s);

  // — hadiths (sélection FR)
  const hadiths = [];
  for (const h of hfr.hadiths) {
    const themeNames = h.themes.map(t => hfr.themes[t] || t).join(' ');
    const sc = score(content, `${h.fr} ${themeNames} ${h.narrator || ''}`);
    if (sc > 0) hadiths.push({ ...h, _s: sc });
  }
  hadiths.sort((a, b) => b._s - a._s);

  return {
    surahs: surahs.slice(0, 5),
    verses,
    duas: duas.slice(0, 12),
    hadiths: hadiths.slice(0, 12),
    intent: inten,
  };
}

export function highlight(text, q) {
  const toks = tokens(q).filter(t => !CONTENT_TOKENS.has(t));
  let out = text;
  for (const t of toks) {
    try {
      const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
      out = out.replace(re, '<mark>$1</mark>');
    } catch {}
  }
  return out;
}
