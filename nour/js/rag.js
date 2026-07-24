// Adaptateur entre le moteur de récupération local et le LLM distant.
// BM25/TF-IDF/synonymes servent uniquement à sélectionner des documents.
import { searchAll, buildAnswer, fold } from './engine.js';
import * as data from './data.js';

const ACCEPTED_GRADE = /(?:sahih|ṣaḥīḥ|hasan|ḥasan|authentifi)/i;
const REJECTED_GRADE = /(?:da.?if|faible|weak|mawdu|fabriqu)/i;

export async function retrieveSources(query, options = {}) {
  const result = await searchAll(query, {
    smart: options.smart !== false,
    phonetic: options.phonetic !== false,
    verseLimit: 16,
  });
  const [quranIndex, verseSources] = await Promise.all([
    data.quranIndex(),
    buildVerseSources(result),
  ]);

  const hadithCandidates = dedupe(
    [...result.hadithsTopic, ...result.hadiths]
      .sort((a, b) => (b._s || 0) - (a._s || 0)),
    item => `${item.collection}:${item.refId || item.num || item.id}`,
  ).filter(isAcceptedHadith).slice(0, options.hadithLimit || 4);

  const duaCandidates = dedupe(
    [...result.duasTopic, ...result.duas]
      .sort((a, b) => (b._s || 0) - (a._s || 0)),
    item => item.id,
  ).slice(0, options.duaLimit || 3);

  const sources = [
    ...verseSources.slice(0, options.verseLimit || 6),
    ...hadithCandidates.map(hadithSource),
    ...duaCandidates.map(duaSource),
  ].slice(0, options.limit || 13);

  return {
    query,
    result,
    sources,
    stats: {
      total: sources.length,
      quran: sources.filter(source => source.type === 'quran').length,
      hadith: sources.filter(source => source.type === 'hadith').length,
      dua: sources.filter(source => source.type === 'dua').length,
      corrections: result.corrections || [],
      understood: result.understood || null,
      semanticScore: result.semanticTop || 0,
    },
    quranIndex,
  };
}

export function buildLocalFallback(retrieval, previousAssistant = null, message = '') {
  const metaIntent = fold(message);
  if (previousAssistant && /\b(source|sources|preuve|preuves|reference|references)\b/.test(metaIntent)) {
    return {
      mode: 'local',
      response: {
        answer_directe: previousAssistant.sources?.length
          ? 'Voici les sources exactes utilisées dans la réponse précédente.'
          : 'La réponse précédente ne comportait aucune source validée.',
        explication: '',
        nuances: [],
        citation_ids: (previousAssistant.sources || []).map(source => source.id),
        insufficient_sources: !(previousAssistant.sources || []).length,
        follow_up_suggestions: ['Résume la réponse précédente', 'Explique davantage'],
      },
      sources: previousAssistant.sources || [],
      validation: { status: 'local', checked: previousAssistant.sources?.length || 0 },
    };
  }
  if (previousAssistant && /\b(resume|resumer|résume|résumer)\b/.test(metaIntent)) {
    return {
      mode: 'local',
      response: {
        answer_directe: previousAssistant.response?.answer_directe
          || 'Le mode local ne peut pas reformuler davantage sans modèle distant.',
        explication: '',
        nuances: previousAssistant.response?.nuances?.slice(0, 2) || [],
        citation_ids: (previousAssistant.sources || []).map(source => source.id),
        insufficient_sources: false,
        follow_up_suggestions: ['Quelles sont tes sources ?', 'Explique davantage'],
      },
      sources: previousAssistant.sources || [],
      validation: { status: 'local', checked: previousAssistant.sources?.length || 0 },
    };
  }

  const answer = buildAnswer(retrieval.result);
  if (!answer) return localInsufficient(retrieval.sources);
  return {
    mode: 'local',
    response: {
      answer_directe: answer.summary,
      explication: answer.context,
      nuances: answer.explanations?.map(item => item.nuances).filter(Boolean).slice(0, 3) || [],
      citation_ids: retrieval.sources.map(source => source.id),
      insufficient_sources: false,
      follow_up_suggestions: ['Quelles sont les sources ?', 'Précise ma question'],
    },
    sources: retrieval.sources,
    validation: { status: 'local', checked: retrieval.sources.length },
  };
}

export function conversationHistory(messages, limit = 10) {
  return (messages || []).filter(message =>
    message.role === 'user' || message.role === 'assistant')
    .slice(-limit)
    .map(message => ({
      role: message.role,
      content: message.role === 'assistant'
        ? [
            message.response?.answer_directe,
            message.response?.explication,
            ...(message.response?.nuances || []),
          ].filter(Boolean).join(' ')
        : String(message.content || ''),
    }))
    .filter(message => message.content);
}

async function buildVerseSources(result) {
  const candidates = dedupe(
    [...result.versesTopic, ...result.verses]
      .sort((a, b) => (b._s || 0) - (a._s || 0)),
    item => `${item.s}:${item.v}`,
  ).slice(0, 8);
  const surahs = new Map();
  await Promise.all([...new Set(candidates.map(item => item.s))].map(async number => {
    try { surahs.set(number, await data.surah(number)); } catch {}
  }));
  const index = await data.quranIndex();
  return candidates.map(item => {
    const verse = surahs.get(item.s)?.verses?.[item.v - 1];
    const meta = index.surahs[item.s - 1];
    if (!verse?.[1] || !meta) return null;
    return {
      id: `Q:${item.s}:${item.v}`,
      type: 'quran',
      ref: `Coran ${item.s}:${item.v} — ${meta.phonetic}`,
      title: `${meta.phonetic}, verset ${item.v}`,
      text: verse[1],
      url: `#/quran/s/${item.s}?v=${item.v}`,
    };
  }).filter(Boolean);
}

function hadithSource(hadith) {
  const collection = String(hadith.collection || 'source').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const number = Number(hadith.refId || hadith.num || hadith.id);
  return {
    id: `H:${collection}:${number}`,
    type: 'hadith',
    ref: hadith.source,
    title: hadith.narrator ? `Hadith rapporté par ${hadith.narrator}` : 'Hadith authentifié',
    text: hadith.fr,
    grade: hadith.grade || 'Authentifié',
    url: `#/hadith/${collection}/find/${number}`,
  };
}

function duaSource(dua) {
  const id = String(dua.id || 'invocation').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return {
    id: `D:${id}`,
    type: 'dua',
    ref: `${dua.source} — ${dua.title}`,
    title: dua.title,
    text: [dua.fr, dua.note].filter(Boolean).join(' '),
    grade: dua.grade || '',
    url: `#/duas/${dua.cat}?d=${encodeURIComponent(dua.id)}`,
  };
}

function isAcceptedHadith(hadith) {
  const grade = String(hadith.grade || '');
  return !REJECTED_GRADE.test(grade) && (ACCEPTED_GRADE.test(grade) || /^Sahih /i.test(hadith.source || ''));
}

function localInsufficient(sources) {
  return {
    mode: 'local',
    response: {
      answer_directe: 'Je ne dispose pas de sources locales suffisamment précises pour répondre avec certitude.',
      explication: 'Le modèle distant est indisponible. Reformulez la question ou consultez une personne qualifiée pour un avis lié à votre situation.',
      nuances: [],
      citation_ids: [],
      insufficient_sources: true,
      follow_up_suggestions: ['Reformule ma question', 'Afficher les passages trouvés'],
    },
    sources: sources.slice(0, 4),
    validation: { status: 'local-insufficient', checked: sources.length },
  };
}

function dedupe(items, key) {
  const seen = new Set();
  return items.filter(item => {
    const id = key(item);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export const __test = { isAcceptedHadith, dedupe };
