import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planRequest,
  answerRequest,
  parseModelJson,
  sanitizeSources,
  validateGeneratedAnswer,
  verifyCorpusSources,
} from '../cloudflare-worker.js';

const env = {
  LLM_BASE_URL: 'https://provider.example/v1',
  LLM_API_KEY: 'test-only',
  LLM_MODEL: 'modele-integration-test',
  LLM_PROVIDER_NAME: 'Fournisseur de test',
};

const sources = [
  {
    id: 'Q:2:43',
    type: 'quran',
    ref: 'Coran 2:43 — Al-Baqarah',
    title: 'Al-Baqarah, verset 43',
    text: "Et accomplissez la Salât, et acquittez la Zakât, et inclinez-vous avec ceux qui s'inclinent",
    url: '#/quran/s/2?v=43',
  },
  {
    id: 'H:bukhari:8',
    type: 'hadith',
    ref: 'Sahih al-Bukhari 8 ; Sahih Muslim 16',
    title: "Hadith rapporté par Ibn 'Umar",
    text: "L'Islam est bâti sur cinq piliers : l'attestation qu'il n'y a de divinité digne d'adoration qu'Allah et que Muhammad est le Messager d'Allah, l'accomplissement de la prière, l'acquittement de la zakat, le pèlerinage et le jeûne du Ramadan.",
    grade: 'Sahih',
    url: '#/hadith/bukhari/find/8',
  },
];

test('le parseur accepte un JSON clôturé mais aucun texte inventé', () => {
  assert.deepEqual(parseModelJson('```json\n{"style":"simple"}\n```'), { style: 'simple' });
  assert.equal(parseModelJson('réponse libre sans objet'), null);
});

test('le serveur filtre les sources et les liens hors application', () => {
  const clean = sanitizeSources([
    ...sources,
    { ...sources[0], id: 'Q:2:44', url: 'https://evil.example/source' },
    { ...sources[0], id: 'SCRIPT:1', url: '#/quran/s/2?v=43' },
  ]);
  assert.deepEqual(clean.map(source => source.id), ['Q:2:43', 'H:BUKHARI:8']);
});

test('les empreintes du corpus rejettent un passage local altéré', async () => {
  const valid = await verifyCorpusSources(sanitizeSources(sources));
  assert.deepEqual(valid.map(source => source.id), ['Q:2:43', 'H:BUKHARI:8']);
  const forged = await verifyCorpusSources(sanitizeSources([
    { ...sources[0], text: 'Texte remplacé malgré un identifiant valide.' },
  ]));
  assert.deepEqual(forged, []);
});

test('les citations autorisées sont conservées et rendues cliquables', () => {
  const checked = validateGeneratedAnswer({
    answer_directe: 'La prière est expressément prescrite [Q:2:43].',
    explication: 'Elle figure aussi parmi les piliers rapportés authentiquement [H:BUKHARI:8].',
    nuances: ['Ces sources établissent l’obligation générale [Q:2:43].'],
    citations: [{ id: 'Q:2:43' }, { id: 'H:bukhari:8' }],
    insufficient_sources: false,
  }, sources);
  assert.equal(checked.validation.status, 'validated');
  assert.deepEqual(checked.response.citation_ids.sort(), ['H:BUKHARI:8', 'Q:2:43']);
  assert.equal(checked.sources.length, 2);
});

test('une citation ou référence inventée rejette toute la réponse', () => {
  const unknownId = validateGeneratedAnswer({
    answer_directe: 'Texte [Q:99:99].',
    explication: '',
    citations: [],
    insufficient_sources: false,
  }, sources);
  assert.equal(unknownId.validation.status, 'rejected');

  const unknownLiteral = validateGeneratedAnswer({
    answer_directe: 'Selon Sahih Muslim 9999, ceci serait établi [Q:2:43].',
    explication: '',
    citations: [{ id: 'Q:2:43' }],
    insufficient_sources: false,
  }, sources);
  assert.equal(unknownLiteral.validation.status, 'rejected');
});

test('conversation complète : reformulation, historique, rédaction et validation', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    const planner = body.messages[0].content.includes('module de compréhension');
    const content = planner
      ? JSON.stringify({
          search_query: 'obligation et importance de la prière en Islam',
          clarification: null,
          style: 'simple',
          intent: 'question',
        })
      : JSON.stringify({
          answer_directe: 'La prière fait partie des obligations centrales de l’Islam [Q:2:43] [H:BUKHARI:8].',
          explication: 'Le verset ordonne de l’accomplir et le hadith la compte parmi les piliers [Q:2:43] [H:BUKHARI:8].',
          nuances: ['Les sources fournies établissent ici le principe général.'],
          citations: [{ id: 'Q:2:43' }, { id: 'H:BUKHARI:8' }],
          insufficient_sources: false,
          follow_up_suggestions: ['Explique-moi cela pour un enfant'],
        });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const history = [
      { role: 'user', content: 'Parle-moi de la prière.' },
      { role: 'assistant', content: 'Que souhaites-tu savoir exactement ?' },
    ];
    const plan = await planRequest({ message: 'Pourquoi est-elle obligatoire ?', history }, env);
    assert.equal(plan.search_query, 'obligation et importance de la prière en Islam');

    const generated = await answerRequest({
      message: 'Pourquoi est-elle obligatoire ?',
      search_query: plan.search_query,
      history,
      sources,
      style: plan.style,
    }, env);
    assert.equal(generated.validation.status, 'validated');
    assert.equal(generated.model.model, 'modele-integration-test');
    assert.notEqual(generated.response.explication, sources[0].text);
    assert.ok(calls.every(call => call.messages.some(message => message.content.includes('Parle-moi de la prière.'))));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
