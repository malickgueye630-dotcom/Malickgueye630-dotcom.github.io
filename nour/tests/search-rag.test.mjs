import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fetched = [];

globalThis.fetch = async input => {
  const url = String(input);
  fetched.push(url);
  if (/^https?:/i.test(url)) throw new Error(`External request forbidden in local RAG test: ${url}`);
  const file = path.resolve(root, url.replace(/^\.?\//, ''));
  try {
    const body = await readFile(file, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  } catch {
    return { ok: false, status: 404, json: async () => null };
  }
};

const { searchAll, buildAnswer } = await import('../js/engine.js');
const { retrieveSources, conversationHistory } = await import('../js/rag.js');

test('la question sur la femme produit une réponse locale sourcée', async () => {
  const result = await searchAll('Quel est le rôle de la femme dans l’Islam ?', { smart: true, phonetic: true });
  assert.equal(result.topics[0]?.topic.id, 'femmes');
  const answer = buildAnswer(result);
  assert.ok(answer);
  assert.match(answer.summary, /responsable|récompense|droits/i);
  assert.ok(answer.verses.length >= 3);
  assert.ok(answer.hadiths.some(h => h.id === 36));
  assert.ok(answer.hadiths.every(h => h.source && h.grade));
  assert.equal(answer.retrieval.mode, 'hybride-local');
});

test('la correction orthographique reste reliée au sujet vérifié', async () => {
  const result = await searchAll('role de la feme en islame', { smart: true });
  assert.equal(result.topics[0]?.topic.id, 'femmes');
  assert.ok(result.corrections.length >= 1);
});

test('la recherche phonétique retrouve le verset attendu', async () => {
  const result = await searchAll('laqad jaakoum', { smart: true, phonetic: true });
  assert.ok(result.phonetic.some(hit => hit.s === 9 && hit.v === 128));
});

test('les références des sujets et les médias Apprendre existent', async () => {
  const topics = JSON.parse(await readFile(path.join(root, 'data/topics.json'), 'utf8'));
  const hadiths = JSON.parse(await readFile(path.join(root, 'data/hadiths_fr.json'), 'utf8'));
  const duas = JSON.parse(await readFile(path.join(root, 'data/duas.json'), 'utf8'));
  const learn = JSON.parse(await readFile(path.join(root, 'data/learn.json'), 'utf8'));
  const hadithIds = new Set(hadiths.hadiths.map(h => h.id));
  const duaIds = new Set(duas.categories.flatMap(c => c.duas.map(d => d.id)));

  for (const topic of topics.topics) {
    for (const id of topic.hadiths) assert.ok(hadithIds.has(id), `${topic.id}: hadith ${id}`);
    for (const id of topic.duas) assert.ok(duaIds.has(id), `${topic.id}: invocation ${id}`);
  }
  for (const guide of learn.guides) {
    assert.ok(guide.steps.length >= 8);
    for (const step of guide.steps) {
      assert.ok(step.image && step.proof && step.errors?.length, `${guide.id}: ${step.title}`);
      await access(path.join(root, step.image));
    }
  }
  const wudu = learn.guides.find(guide => guide.id === 'wudu');
  assert.deepEqual(
    wudu.steps.slice(6, 9).map(step => step.title),
    ['Essuyer la tête', 'Essuyer les oreilles', 'Laver les pieds'],
  );
  assert.match(wudu.steps[7].proof, /Ibn Majah 439/);
});

test('le RAG prépare des paquets exacts et cliquables pour le LLM', async () => {
  const retrieval = await retrieveSources('Pourquoi la prière est-elle obligatoire ?');
  assert.ok(retrieval.sources.length > 0);
  assert.ok(retrieval.sources.every(source => /^(Q:|H:|D:)/.test(source.id)));
  assert.ok(retrieval.sources.every(source => source.url.startsWith('#/')));
  assert.ok(retrieval.sources.some(source => source.type === 'quran'));
  assert.ok(retrieval.sources.some(source => source.type === 'hadith'));
});

test('l’historique conversationnel transmet le contexte sans métadonnées internes', () => {
  const history = conversationHistory([
    { role: 'user', content: 'Explique-moi la médisance.' },
    {
      role: 'assistant',
      response: {
        answer_directe: 'Elle est interdite.',
        explication: 'Les sources la comparent à un acte grave.',
        nuances: ['Il faut distinguer les cas légitimes établis.'],
      },
    },
    { role: 'system', content: 'ne doit pas être transmis' },
    { role: 'user', content: 'Résume pour un enfant.' },
  ]);
  assert.deepEqual(history.map(item => item.role), ['user', 'assistant', 'user']);
  assert.match(history[1].content, /interdite/);
});

test('le pipeline RAG ne tente aucun appel réseau externe', () => {
  assert.ok(fetched.length > 0);
  assert.ok(fetched.every(url => !/^https?:/i.test(url)));
});
