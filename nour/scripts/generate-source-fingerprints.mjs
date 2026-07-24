import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const nourRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputFile = path.join(nourRoot, 'server', 'source-fingerprints.js');
const acceptedGrade = /(?:sahih|ṣaḥīḥ|hasan|ḥasan|authentifi)/i;
const rejectedGrade = /(?:da.?if|faible|weak|mawdu|fabriqu)/i;
const clean = value => String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
const digest = value => createHash('sha256').update(value).digest('hex');
const canonical = source => [
  source.id.toUpperCase(),
  source.type,
  source.ref,
  source.text,
  source.url,
  source.title || '',
  source.grade || '',
].map(clean).join('\n');

const index = JSON.parse(await readFile(path.join(nourRoot, 'data', 'quran', 'index.json'), 'utf8'));
const sources = [];
for (const meta of index.surahs) {
  const surahNumber = meta.n;
  const surah = JSON.parse(await readFile(path.join(nourRoot, 'data', 'quran', 's', `${surahNumber}.json`), 'utf8'));
  for (let index = 0; index < surah.verses.length; index += 1) {
    const verse = surah.verses[index];
    if (!verse?.[1]) continue;
    const number = index + 1;
    sources.push({
      id: `Q:${surahNumber}:${number}`,
      type: 'quran',
      ref: `Coran ${surahNumber}:${number} — ${meta.phonetic}`,
      title: `${meta.phonetic}, verset ${number}`,
      text: verse[1],
      url: `#/quran/s/${surahNumber}?v=${number}`,
      grade: '',
    });
  }
}

const hadithData = JSON.parse(await readFile(path.join(nourRoot, 'data', 'hadiths_fr.json'), 'utf8'));
for (const hadith of hadithData.hadiths) {
  const grade = String(hadith.grade || '');
  if (rejectedGrade.test(grade)
      || !(acceptedGrade.test(grade) || /^Sahih /i.test(hadith.source || ''))) continue;
  const collection = String(hadith.collection || 'source').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const number = Number(hadith.refId || hadith.num || hadith.id);
  sources.push({
    id: `H:${collection}:${number}`,
    type: 'hadith',
    ref: hadith.source,
    title: hadith.narrator ? `Hadith rapporté par ${hadith.narrator}` : 'Hadith authentifié',
    text: hadith.fr,
    grade: hadith.grade || 'Authentifié',
    url: `#/hadith/${collection}/find/${number}`,
  });
}

const duaData = JSON.parse(await readFile(path.join(nourRoot, 'data', 'duas.json'), 'utf8'));
for (const category of duaData.categories) {
  for (const dua of category.duas) {
    const id = String(dua.id || 'invocation').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    sources.push({
      id: `D:${id}`,
      type: 'dua',
      ref: `${dua.source} — ${dua.title}`,
      title: dua.title,
      text: [dua.fr, dua.note].filter(Boolean).join(' '),
      grade: dua.grade || '',
      url: `#/duas/${category.id}?d=${encodeURIComponent(dua.id)}`,
    });
  }
}

const fingerprints = Object.fromEntries(
  sources.map(source => [source.id.toUpperCase(), digest(canonical(source))]),
);
const generated = `// Généré par scripts/generate-source-fingerprints.mjs.\n`
  + `// Empreintes SHA-256 des sources autorisées de la base Nour.\n`
  + `export const SOURCE_FINGERPRINTS = Object.freeze(${JSON.stringify(fingerprints, null, 2)});\n`;

if (process.argv.includes('--check')) {
  const current = await readFile(outputFile, 'utf8').catch(() => '');
  if (current !== generated) {
    throw new Error('server/source-fingerprints.js doit être régénéré.');
  }
  console.log(`${sources.length} empreintes de sources à jour.`);
} else {
  await writeFile(outputFile, generated, 'utf8');
  console.log(`${sources.length} empreintes écrites dans server/source-fingerprints.js.`);
}
