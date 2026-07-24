// ============================================================
// Nour — moteur de recherche islamique unifié
// Combine, sur la base documentaire LOCALE uniquement :
//   1. recherche plein texte française (avec racines légères)
//   2. recherche floue (distance d'édition)
//   3. recherche phonétique (translittérations arabes approximatives)
//   4. synonymes français (lexique)
//   5. recherche « sémantique » par thésaurus de sujets vérifiés
//   6. recherche dans le texte arabe (sans diacritiques)
//   7. détection de questions → réponse structurée sourcée
//   8. reclassement des résultats (exact > sujet > phonétique)
// Aucune génération de contenu : chaque résultat provient d'une
// entrée de la base et porte sa source.
// ============================================================
import * as data from './data.js';
import { phoneticSearch } from './phonetic.js';

// ---------------- normalisation française ----------------
export function fold(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´‘]/g, "'")
    .replace(/œ/g, 'oe')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9à-ÿء-ۿ'\s:]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// racine légère : pluriels et terminaisons fréquentes
export function stem(w) {
  let t = w;
  for (const suf of ['issements', 'issement', 'atrices', 'atrice', 'euses', 'ements', 'ement', 'euse', 'eurs', 'eur', 'ives', 'ive', 'aux', 'ies', 'ent', 'er', 'ie', 'es', 'e', 's', 'x']) {
    if (t.length - suf.length >= 4 && t.endsWith(suf)) { t = t.slice(0, -suf.length); break; }
  }
  return t;
}

// les verbes de parole (parle, dit…) restent des tokens : ils portent du sens
// (« parle dans le dos » = médisance)
const STOP = new Set(['le','la','les','de','des','du','un','une','et','ou','a','au','aux','en','pour','sur','que','qui','quoi','quand','avec','sans','dans','par','est','sont','etre','avoir','fait','faire','dit','dire','disait','sujet','chose','ce','cette','ces','se','sa','son','ses','mon','ma','mes','ton','ta','tes','notre','nos','votre','vos','leur','leurs','je','tu','il','elle','on','nous','vous','ils','elles','moi','toi','lui','y','ne','pas','plus','tres','tout','toute','tous','comme','meme','aussi','donc','alors','mais','si','oui','non','avant','apres','lorsque','lorsqu','quel','quelle','quels','quelles','doit','dois','peut','peux','faut','veut','veux','islam','musulman','musulmane','prophete','saws','existe','concernant','personne','quelqu','quelquun','autres','autre','autrui','gens']);

const CONTENT_HINTS = {
  dua: /\b(dua|doua|douaa|du'a|invocation|invoquer|adhkar|azkar|dhikr|zikr|reciter|formule)\b/,
  quran: /\b(coran|quran|qur'an|verset|versets|sourate|surat|surah|sura|ayat?|juz|hizb)\b/,
  hadith: /\b(hadith|hadiths|hadis|hadeeth|sunna|sounna|rapporte|bukhari|boukhari|muslim|mouslim|tirmidhi|nasai|dawud|majah)\b/,
};

export function tokens(q) {
  return fold(q).split(/[\s':]+/).filter(t => t.length > 1 && !STOP.has(t));
}

// ---------------- chargement ----------------
let CACHE = null;
async function loadBase() {
  if (CACHE) return CACHE;
  const [topics, duasDb, hfr, idx] = await Promise.all([
    fetch('data/topics.json').then(r => r.json()),
    data.duas(), data.hadithsFr(), data.quranIndex(),
  ]);
  // lexique : mot normalisé → identifiant de groupe
  const lex = new Map();
  topics.lexicon.forEach((group, gi) => {
    for (const w of group) lex.set(stem(fold(w)), gi);
  });
  const allDuas = duasDb.categories.flatMap(c =>
    c.duas.map(d => ({ ...d, cat: c.id, catName: c.name, icon: c.icon })));
  const duaById = new Map(allDuas.map(d => [d.id, d]));
  const hById = new Map(hfr.hadiths.map(h => [h.id, h]));
  // clés de sujets pré-normalisées
  for (const t of topics.topics) {
    t._keys = t.keys.map(k => fold(k));
    t._keyTokens = new Set(t._keys.flatMap(k => k.split(' ').map(stem).filter(w => w.length > 2)));
    t._label = fold(t.label);
  }
  CACHE = { topics, duasDb, hfr, idx, lex, allDuas, duaById, hById };
  return CACHE;
}

let QURAN_FR = null;
async function loadQuranFr() {
  if (!QURAN_FR) QURAN_FR = await data.quranSearchIndex();
  return QURAN_FR;
}
let QURAN_AR = null;
async function loadQuranAr() {
  if (!QURAN_AR) QURAN_AR = await fetch('data/quran/search-ar.json').then(r => r.json());
  return QURAN_AR;
}

// ---------------- compréhension de la requête ----------------
// Vocabulaire construit uniquement à partir de la base locale (sujets, lexique,
// invocations, sourates, thèmes de hadiths). Chaque mot inconnu de la requête
// est rapproché du mot du vocabulaire le plus proche (distance d'édition
// bornée) : « médizance » → « médisance », « trahizon » → « trahison ».
// Aucune génération : on ne fait que corriger vers des mots existants.
function buildVocab(base) {
  const vocab = new Map(); // racine → mot canonique
  const add = w => {
    for (const part of fold(w).split(/[\s':]+/)) {
      if (part.length < 4 || STOP.has(part) || /\d/.test(part)) continue;
      const st = stem(part);
      if (!vocab.has(st)) vocab.set(st, part);
    }
  };
  for (const t of base.topics.topics) { t.keys.forEach(add); add(t.label); add(t.desc || ''); }
  for (const g of base.topics.lexicon) g.forEach(add);
  for (const d of base.allDuas) { add(d.title); add(d.catName); }
  for (const s of base.idx.surahs) { add(s.phonetic); add(s.fr); }
  for (const k in base.hfr.themes) add(base.hfr.themes[k]);
  return vocab;
}

// corrige les fautes de frappe token par token ; retourne aussi la liste des
// corrections pour que l'interface puisse afficher « compris comme… »
const STOP_WORDS = [...STOP].filter(w => w.length >= 4);
// forme lisible de quelques mots-outils pour l'affichage « compris comme… »
const STOP_PRETTY = { quelqu: "quelqu'un", quelquun: "quelqu'un", lorsqu: 'lorsque' };
function correctTokens(toks, base) {
  if (!base._vocab) base._vocab = buildVocab(base);
  const vocab = base._vocab;
  const corrections = [];
  const out = toks.map(tok => {
    const st = stem(tok);
    if (vocab.has(st)) return tok;
    // mot déjà reconnu par préfixe long → pas de correction nécessaire
    for (const vs of vocab.keys()) {
      if (vs.length >= 4 && (st.startsWith(vs) || vs.startsWith(st)) && Math.abs(vs.length - st.length) <= 2) return tok;
    }
    const max = tok.length >= 9 ? 2 : tok.length >= 4 ? 1 : 0;
    if (!max) return tok;
    // faute sur un mot-outil (« quelqun » → « quelqu'un ») → on l'écarte
    for (const sw of STOP_WORDS) {
      if (sw[0] === tok[0] && Math.abs(sw.length - tok.length) <= 1 && editDistLe(tok, sw, 1) <= 1) {
        corrections.push([tok, STOP_PRETTY[sw] || sw]);
        return null;
      }
    }
    let best = null, bestD = max + 1;
    for (const [vs, vw] of vocab) {
      // les fautes de frappe touchent rarement la première lettre
      if (vs[0] !== st[0] || Math.abs(vs.length - st.length) > max) continue;
      const d = editDistLe(st, vs, max);
      if (d < bestD) { bestD = d; best = vw; if (d === 1 && tok.length >= 7) break; }
    }
    // second passage sans contrainte de première lettre (« karnayn » → « qarnayn »)
    if (!best && tok.length >= 6) {
      for (const [vs, vw] of vocab) {
        if (Math.abs(vs.length - st.length) > 1) continue;
        const d = editDistLe(st, vs, 1);
        if (d <= 1 && d < bestD) { bestD = d; best = vw; break; }
      }
    }
    if (best && bestD <= max) { corrections.push([tok, best]); return best; }
    return tok;
  });
  return { toks: out.filter(t => t !== null), corrections };
}

// ---------------- correspondance de tokens ----------------
function editDistLe(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[a.length];
}

// note d'un texte pour un ensemble de tokens (retourne aussi les mots trouvés)
function scoreText(toks, foldedText, lex) {
  const words = foldedText.split(/[\s',:;.!?()«»-]+/);
  const stems = words.map(stem);
  let score = 0, matched = 0, exactHits = 0;
  const found = [];
  for (const tok of toks) {
    const st = stem(tok);
    let best = 0, bestWord = null;
    for (let i = 0; i < words.length; i++) {
      const w = words[i], sw = stems[i];
      if (w === tok || sw === st) { best = 3; bestWord = w; break; }
      if (best < 2 && Math.min(sw.length, st.length) >= 4) {
        // préfixe commun long (sorti/sortant, priere/prier…)
        let cp = 0;
        while (cp < st.length && cp < sw.length && st[cp] === sw[cp]) cp++;
        if (cp >= 4 && cp >= Math.min(st.length, sw.length) - 2) { best = 2; bestWord = w; }
      }
      if (best < 1.5 && lex && lex.has(st) && lex.has(sw) && lex.get(st) === lex.get(sw)) { best = 1.8; bestWord = w; }
      if (best < 1 && tok.length >= 5) {
        const max = tok.length >= 8 ? 2 : 1;
        if (editDistLe(st, sw, max) <= max) { best = 1.2; bestWord = w; }
      }
    }
    if (best > 0) { score += best; matched++; if (bestWord) found.push(bestWord); if (best === 3) exactHits++; }
  }
  if (!matched) return { score: 0, found: [], ratio: 0, exact: false };
  const ratio = matched / toks.length;
  return { score: score * ratio, found, ratio, exact: exactHits === toks.length };
}

// ---------------- sujets (sémantique) ----------------
function matchTopics(q, toks, base) {
  const folded = fold(q);
  const stems = new Set(toks.map(stem));
  const groups = new Set([...stems].map(s => base.lex.get(s)).filter(g => g !== undefined));
  const out = [];
  const padded = ` ${folded} `;
  for (const t of base.topics.topics) {
    let s = 0;
    for (const k of t._keys) {
      // correspondance de phrase complète, bornée par des espaces (pas en milieu de mot)
      if (k.length > 3 && padded.includes(` ${k} `)) s = Math.max(s, 3 + k.split(' ').length);
    }
    let overlap = 0;
    const countedConcepts = new Set();
    for (const kt of t._keyTokens) {
      const group = base.lex.get(kt);
      const concept = group === undefined ? `t:${kt}` : `g:${group}`;
      if (countedConcepts.has(concept)) continue;
      let gain = 0;
      if (stems.has(kt)) gain = 1;
      else if (group !== undefined && groups.has(group)) gain = 0.8;
      // token tronqué (« do » → « dos ») : préfixe à une lettre près
      else if ([...stems].some(s => s.length >= 2 && kt.startsWith(s) && kt.length - s.length <= 1)) gain = 0.6;
      if (gain) {
        countedConcepts.add(concept);
        overlap += gain;
      }
    }
    if (toks.length && overlap) s = Math.max(s, overlap * 1.4 * (overlap / toks.length));
    if (s > 0.9) out.push({ topic: t, score: s });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

// ---------------- recherche vectorielle sémantique (locale) ----------------
// Chaque passage de la base (verset FR, hadith FR, invocation) est représenté
// par un vecteur creux TF-IDF. Les dimensions incluent, en plus des racines de
// mots, un identifiant de « groupe de synonymes » (du lexique) : ainsi des mots
// différents mais de sens proche partagent une dimension → la similarité cosinus
// capte une proximité conceptuelle au-delà des mots exacts. Le score final fusionne
// cette similarité cosinus avec BM25 (classement plein texte) et un bonus de phrase.
// Il ne s'agit pas d'embeddings neuronaux : tout est local, déterministe et traçable.
function expandVec(text, base) {
  const out = [];
  for (const t of tokens(text)) {
    const st = stem(t);
    out.push(st);
    const g = base.lex.get(st);
    if (g !== undefined) out.push('g' + g); // dimension conceptuelle partagée
  }
  return out;
}

let VEC = null;
async function buildVec(base) {
  if (VEC) return VEC;
  const vi = await loadQuranFr();
  const docs = [];
  for (const [s, v, fr] of vi) docs.push({ type: 'v', s, v, text: fr });
  for (const h of base.hfr.hadiths) {
    const themeNames = h.themes.map(t => base.hfr.themes[t] || t).join(' ');
    docs.push({ type: 'h', id: h.id, text: `${h.fr} ${themeNames}` });
  }
  for (const d of base.allDuas) docs.push({ type: 'd', id: d.id, text: `${d.title} ${d.fr} ${d.catName} ${d.note || ''}` });

  const df = new Map();
  const lengths = new Uint32Array(docs.length);
  const tfs = docs.map(doc => {
    const tf = new Map();
    for (const t of expandVec(doc.text, base)) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    return tf;
  });
  tfs.forEach((tf, i) => { lengths[i] = [...tf.values()].reduce((a, b) => a + b, 0); });
  const N = docs.length;
  const idf = t => Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;
  const inv = new Map();       // terme → [[docIdx, poids]]
  const norms = new Float64Array(N);
  tfs.forEach((tf, i) => {
    let sq = 0;
    for (const [t, f] of tf) {
      const w = (1 + Math.log(f)) * idf(t);
      sq += w * w;
      if (!inv.has(t)) inv.set(t, []);
      inv.get(t).push([i, w]);
    }
    norms[i] = Math.sqrt(sq) || 1;
  });
  const avgdl = lengths.reduce((a, b) => a + b, 0) / Math.max(1, N);
  VEC = { docs, inv, idf, norms, tfs, df, lengths, avgdl, N };
  return VEC;
}

async function semanticSearch(qText, base) {
  const { docs, inv, idf, norms, tfs, df, lengths, avgdl, N } = await buildVec(base);
  const qtf = new Map();
  for (const t of expandVec(qText, base)) qtf.set(t, (qtf.get(t) || 0) + 1);
  if (!qtf.size) return { v: [], h: [], d: [], top: 0 };
  let qnorm = 0;
  const qw = new Map();
  for (const [t, f] of qtf) { const w = (1 + Math.log(f)) * idf(t); qw.set(t, w); qnorm += w * w; }
  qnorm = Math.sqrt(qnorm) || 1;
  const acc = new Map();
  for (const [t, wq] of qw) {
    const post = inv.get(t);
    if (!post) continue;
    for (const [i, wd] of post) acc.set(i, (acc.get(i) || 0) + wq * wd);
  }
  const hits = [];
  for (const [i, dot] of acc) {
    const cosine = dot / (qnorm * norms[i]);
    let bm25 = 0;
    const k1 = 1.35, b = 0.72;
    for (const t of qw.keys()) {
      const f = tfs[i].get(t) || 0;
      if (!f) continue;
      const bmIdf = Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
      bm25 += bmIdf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * lengths[i] / Math.max(1, avgdl)));
    }
    const bmNorm = 1 - Math.exp(-bm25 / 5);
    const phrase = fold(qText).length >= 5 && fold(docs[i].text).includes(fold(qText)) ? 0.08 : 0;
    const sim = Math.min(1, 0.62 * cosine + 0.38 * bmNorm + phrase);
    if (sim > 0.1) hits.push({ ...docs[i], sim, cosine, bm25 });
  }
  hits.sort((a, b) => b.sim - a.sim);
  const out = { v: [], h: [], d: [], top: hits.length ? hits[0].sim : 0 };
  for (const x of hits) {
    if (x.type === 'v' && out.v.length < 8) out.v.push(x);
    else if (x.type === 'h' && out.h.length < 8) out.h.push(x);
    else if (x.type === 'd' && out.d.length < 8) out.d.push(x);
  }
  return out;
}

// ---------------- détection de question ----------------
const Q_PATTERNS = [
  /^(que|qu'|quoi|quel|quelle|quels|quelles|comment|pourquoi|est-ce|existe|y a-t-il|combien|où|ou dois)/,
  /\?$/,
  /\b(que dit|que disait|a dit|dois-je|dois je|doit-on|comment faire|comment accomplir|que faire|quelle (dua|doua|invocation)|que reciter|quoi dire|que dire)\b/,
];
export function isQuestion(q) {
  const f = fold(q);
  return Q_PATTERNS.some(re => re.test(f)) || /\?\s*$/.test(q.trim());
}

// ---------------- recherche principale ----------------
export async function searchAll(q, opts = {}) {
  const base = await loadBase();
  const smart = opts.smart !== false; // réglage « recherche intelligente »
  const rawToks = tokens(q);
  const hasArabic = /[ء-ۿ]/.test(q);
  // compréhension : correction des fautes de frappe contre le vocabulaire de la base
  const { toks, corrections } = hasArabic || !smart
    ? { toks: rawToks, corrections: [] }
    : correctTokens(rawToks, base);
  // requête corrigée (pour la correspondance de phrases des sujets)
  let qFixed = fold(q);
  for (const [from, to] of corrections) {
    qFixed = qFixed.replace(new RegExp(`(^| )${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`, 'g'), `$1${to}$2`);
  }
  const hints = {
    dua: CONTENT_HINTS.dua.test(qFixed),
    quran: CONTENT_HINTS.quran.test(qFixed),
    hadith: CONTENT_HINTS.hadith.test(qFixed),
  };
  const contentToks = toks.filter(t =>
    !CONTENT_HINTS.dua.test(t) && !CONTENT_HINTS.quran.test(t) && !CONTENT_HINTS.hadith.test(t));
  const useToks = contentToks.length ? contentToks : toks;

  const result = {
    query: q,
    corrections,
    understood: corrections.length ? qFixed : null,
    question: isQuestion(q),
    hints,
    surahs: [],
    verses: [],      // exacts (français ou arabe)
    versesTopic: [], // liés au sujet
    phonetic: [],    // correspondances phonétiques
    hadiths: [],
    hadithsTopic: [],
    duas: [],
    duasTopic: [],
    topics: [],
  };
  if (!useToks.length && !hasArabic && fold(q).length < 3) return result;

  // --- sourates par nom
  for (const s of base.idx.surahs) {
    const st = scoreText(useToks, fold(`${s.phonetic} ${s.fr} sourate ${s.n}`), base.lex);
    if (st.score > 1.2) result.surahs.push({ ...s, _s: st.score + 3 });
  }
  result.surahs.sort((a, b) => b._s - a._s);
  result.surahs = result.surahs.slice(0, 4);

  // --- sujets (sémantique) — sur la requête corrigée (désactivable dans les réglages)
  const topicMatches = smart ? matchTopics(qFixed, useToks, base) : [];
  result.topics = topicMatches.slice(0, 3);
  // sujet fort : la requête décrit un concept → le sens prime sur les mots isolés
  result.strongTopic = topicMatches.length > 0 && (topicMatches[0].score >= 2.5 || useToks.length >= 3);

  // --- recherche exacte/floue française : Coran
  if (useToks.length) {
    const vi = await loadQuranFr();
    const scored = [];
    // avec un sujet fort, on exige que la quasi-totalité des mots correspondent
    // (évite les faux positifs du type « dos » + « autres »)
    const minRatio = result.strongTopic && useToks.length >= 2 ? 0.99 : 0;
    for (const [s, v, fr] of vi) {
      const st = scoreText(useToks, fold(fr), base.lex);
      if (st.score > 1.1 && st.ratio >= minRatio) {
        scored.push({ s, v, fr, _s: st.score, found: st.found, approx: !st.exact });
      }
    }
    scored.sort((a, b) => b._s - a._s);
    result.verses = scored.slice(0, opts.verseLimit || 20);
  }

  // --- recherche arabe : Coran + hadiths + duas
  if (hasArabic) {
    const arNorm = q.replace(/[ً-ٰٟۖ-ۭـ،؛؟]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[^ء-ۿ ]/g, '').trim();
    if (arNorm.length >= 3) {
      const ai = await loadQuranAr();
      for (const [s, v, ar] of ai) {
        if (ar.includes(arNorm)) {
          result.verses.unshift({ s, v, fr: '', _s: 10, arMatch: true });
          if (result.verses.length > 20) break;
        }
      }
      for (const h of base.hfr.hadiths) {
        const hAr = h.ar.replace(/[ً-ٰٟۖ-ۭـ،؛؟]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
        if (hAr.includes(arNorm)) result.hadiths.push({ ...h, _s: 10, exact: true });
      }
      for (const d of base.allDuas) {
        const dAr = d.ar.replace(/[ً-ٰٟۖ-ۭـ،؛؟]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
        if (dAr.includes(arNorm)) result.duas.push({ ...d, _s: 10, exact: true });
      }
    }
  }

  // --- hadiths (sélection FR)
  if (useToks.length) {
    const minRatio = result.strongTopic && useToks.length >= 2 ? 0.7 : 0;
    for (const h of base.hfr.hadiths) {
      const themeNames = h.themes.map(t => base.hfr.themes[t] || t).join(' ');
      const st = scoreText(useToks, fold(`${h.fr} ${themeNames} ${h.narrator || ''}`), base.lex);
      if (st.score > 1.1 && st.ratio >= minRatio) result.hadiths.push({ ...h, _s: st.score, found: st.found, exact: true, approx: !st.exact });
    }
    result.hadiths.sort((a, b) => b._s - a._s);
    result.hadiths = result.hadiths.slice(0, 12);

    // --- invocations
    for (const d of base.allDuas) {
      const st = scoreText(useToks, fold(`${d.title} ${d.fr} ${d.translit} ${d.catName} ${d.note || ''}`), base.lex);
      if (st.score > 1.1 && st.ratio >= minRatio) result.duas.push({ ...d, _s: st.score, found: st.found, exact: true, approx: !st.exact });
    }
    result.duas.sort((a, b) => b._s - a._s);
    result.duas = result.duas.slice(0, 10);
  }

  // --- contenus liés aux sujets détectés (sans doublon avec l'exact)
  const seenV = new Set(result.verses.map(v => `${v.s}:${v.v}`));
  const seenH = new Set(result.hadiths.map(h => h.id));
  const seenD = new Set(result.duas.map(d => d.id));
  for (const { topic, score } of result.topics) {
    for (const [s, a, b] of topic.quran) {
      for (let v = a; v <= Math.min(b, a + 4); v++) {
        const id = `${s}:${v}`;
        if (!seenV.has(id)) {
          seenV.add(id);
          result.versesTopic.push({ s, v, topic: topic.label, topicId: topic.id, range: b > a ? [s, a, b] : null, _s: score });
        }
      }
    }
    for (const hid of topic.hadiths) {
      if (!seenH.has(hid) && base.hById.has(hid)) {
        seenH.add(hid);
        result.hadithsTopic.push({ ...base.hById.get(hid), topic: topic.label, _s: score });
      }
    }
    for (const did of topic.duas) {
      if (!seenD.has(did) && base.duaById.has(did)) {
        seenD.add(did);
        result.duasTopic.push({ ...base.duaById.get(did), topic: topic.label, _s: score });
      }
    }
  }
  // --- recherche vectorielle sémantique : rattrape les formulations que le
  // thésaurus ne couvre pas (« un homme injuste envers les gens », « je n'arrive
  // pas à dormir »…). Les passages proches par le SENS complètent les sections
  // « par le sens », clairement étiquetés.
  result.semanticStrong = false;
  if (smart && useToks.length && !hasArabic) {
    try {
      const sem = await semanticSearch(qFixed, base);
      result.semanticTop = sem.top;
      // seuils prudents : on préfère ne rien montrer plutôt qu'un faux positif
      result.semanticStrong = sem.top >= 0.32;
      for (const x of sem.v) {
        const id = `${x.s}:${x.v}`;
        if (x.sim >= 0.2 && !seenV.has(id)) {
          seenV.add(id);
          result.versesTopic.push({ s: x.s, v: x.v, topic: 'proche par le sens', sem: true, _s: 1 + x.sim, sim: x.sim });
        }
      }
      for (const x of sem.h) {
        if (x.sim >= 0.17 && !seenH.has(x.id) && base.hById.has(x.id)) {
          seenH.add(x.id);
          result.hadithsTopic.push({ ...base.hById.get(x.id), topic: 'proche par le sens', sem: true, _s: 1 + x.sim, sim: x.sim });
        }
      }
      for (const x of sem.d) {
        if (x.sim >= 0.17 && !seenD.has(x.id) && base.duaById.has(x.id)) {
          seenD.add(x.id);
          result.duasTopic.push({ ...base.duaById.get(x.id), topic: 'proche par le sens', sem: true, _s: 1 + x.sim, sim: x.sim });
        }
      }
    } catch { /* index vectoriel indisponible (hors-ligne partiel) */ }
  }

  // reclassement (reranking) : le contenu de sujet vérifié d'abord, puis la
  // proximité sémantique, en respectant l'ordre déjà établi
  const rerank = (a, b) => (b._s || 0) - (a._s || 0);
  result.versesTopic.sort(rerank);
  result.hadithsTopic.sort(rerank);
  result.duasTopic.sort(rerank);
  result.versesTopic = result.versesTopic.slice(0, 12);
  result.hadithsTopic = result.hadithsTopic.slice(0, 8);
  result.duasTopic = result.duasTopic.slice(0, 8);

  // explications : descriptions vérifiées des sujets reconnus (orientation, pas un avis religieux)
  result.explanations = result.topics
    .filter(t => t.topic.desc)
    .map(t => ({
      label: t.topic.label,
      desc: t.topic.desc,
      nuances: t.topic.nuances || '',
      id: t.topic.id,
    }));

  // --- phonétique (si la requête ressemble à de l'arabe latinisé, ou si peu de résultats)
  const latinish = !hasArabic && /^[a-z0-9'\s]+$/i.test(fold(q));
  const fewResults = result.verses.length + result.hadiths.length + result.duas.length < 3;
  const looksTransliterated = !result.question && !result.topics.length && useToks.length <= 5;
  if (opts.phonetic !== false && latinish && (fewResults || looksTransliterated)) {
    try {
      const ph = await phoneticSearch(q, { limit: 8 });
      result.phonetic = ph.filter(p => !result.verses.some(v => v.s === p.s && v.v === p.v));
    } catch { /* index indisponible hors-ligne partiel */ }
  }

  return result;
}

// ---------------- réponse directe (pipeline type RAG, sans génération) ----------------
// question ou sujet clairement identifié → réponse structurée assemblée
// UNIQUEMENT à partir du meilleur sujet vérifié + des meilleurs passages de la
// base ; chaque élément garde sa source. Rien n'est jamais inventé.
export function buildAnswer(result) {
  // la réponse se déclenche pour une question, un sujet fort, OU une forte
  // proximité sémantique (formulation nouvelle non couverte par le thésaurus)
  if (!result.question && !result.strongTopic && !result.semanticStrong) return null;
  const t = result.topics[0];
  const useTopic = !!t || result.semanticStrong; // les passages « par le sens » comptent
  const strong = (arr, min) => arr.filter(x => x._s >= min && !x.approx);
  // contenu du sujet / sémantique d'abord ; sinon correspondances textuelles fortes
  const pick = (topicArr, exactArr, minWithTopic, minAlone) => useTopic
    ? (topicArr.length
        ? [...topicArr.slice(0, 3), ...strong(exactArr, minWithTopic).slice(0, 1)].slice(0, 3)
        : strong(exactArr, 2.5).slice(0, 3))
    : strong(exactArr, minAlone).slice(0, 3);
  const duas = pick(result.duasTopic, result.duas, 4, 2.2);
  const hadiths = pick(result.hadithsTopic, result.hadiths, 4, 2.2);
  const verses = useTopic && result.versesTopic.length
    ? [...result.versesTopic.slice(0, 5), ...strong(result.verses, 5).slice(0, 1)].slice(0, 5)
    : pick(result.versesTopic, result.verses, 5, 2.2);
  if (!t && !duas.length && !hadiths.length && !verses.length) return null;
  const topic = t ? t.topic : null;
  const summary = topic?.answer || topic?.desc ||
    "La base locale de Nour a retrouvé les passages ci-dessous comme correspondances les plus proches. Elle ne peut pas rédiger une conclusion doctrinale au-delà de ces textes.";
  const context = topic?.nuances ||
    "Cette sélection locale aide à retrouver des sources ; elle ne remplace pas l'étude du contexte complet ni l'avis d'une personne qualifiée pour un cas particulier.";
  return {
    topic,
    summary,
    context,
    duas,
    hadiths,
    verses,
    explanations: result.explanations || [],
    retrieval: {
      mode: 'hybride-local',
      semantic: 'TF-IDF conceptuel + BM25',
      score: result.semanticTop || 0,
    },
  };
}

// ---------------- suggestions pendant la saisie ----------------
export async function suggest(q) {
  const base = await loadBase();
  const f = fold(q);
  if (f.length < 2) return [];
  const toks = tokens(q);
  const content = toks.filter(t => !CONTENT_HINTS.dua.test(t) && !CONTENT_HINTS.quran.test(t) && !CONTENT_HINTS.hadith.test(t));
  const useToks = content.length ? content : toks;
  const out = [];
  const push = (type, label, hash, sub, s) => out.push({ type, label, hash, sub, _s: s });

  // chaque token doit se retrouver (préfixe/racine) dans le texte cible
  const matches = text => {
    if (text.includes(f)) return 5; // la phrase entière
    if (!useToks.length) return 0;
    const words = text.split(' ').map(stem);
    let hit = 0;
    for (const t of useToks) {
      const st = stem(t);
      if (words.some(w => {
        if (w === st) return true;
        let cp = 0;
        while (cp < st.length && cp < w.length && st[cp] === w[cp]) cp++;
        return cp >= 4 || (cp >= 3 && cp === Math.min(st.length, w.length));
      })) hit++;
    }
    return hit === useToks.length ? 2 + hit : 0;
  };

  for (const s of base.idx.surahs) {
    const sc = matches(fold(`sourate ${s.phonetic} ${s.fr}`)) || (String(s.n) === f ? 5 : 0);
    if (sc) push('surah', `Sourate ${s.phonetic}`, `#/quran/s/${s.n}`, s.fr, sc + 1);
  }
  for (const d of base.allDuas) {
    const sc = matches(fold(`${d.title} ${d.catName} invocation doua`));
    if (sc) push('dua', d.title, `#/duas/${d.cat}?d=${d.id}`, d.catName, sc);
  }
  for (const t of base.topics.topics) {
    const sc = matches(t._label) || (t._keys.some(k => k.startsWith(f) && f.length >= 3) ? 2 : 0);
    if (sc) push('topic', t.label, null, 'Sujet', sc);
  }
  out.sort((a, b) => b._s - a._s);
  return out.slice(0, 8);
}

export { loadBase };
