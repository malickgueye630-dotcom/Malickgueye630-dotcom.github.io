// Chargement des données (fichiers JSON statiques, mis en cache en mémoire
// et par le service worker pour le hors-ligne).
const mem = new Map();

async function get(url) {
  if (mem.has(url)) return mem.get(url);
  const p = fetch(url).then(r => {
    if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
    return r.json();
  }).catch(err => { mem.delete(url); throw err; });
  mem.set(url, p);
  return p;
}

export const quranIndex = () => get('data/quran/index.json');
export const surah = n => get(`data/quran/s/${n}.json`);
export const quranSearchIndex = () => get('data/quran/search-fr.json');
export const duas = () => get('data/duas.json');
export const hadithsFr = () => get('data/hadiths_fr.json');
export const hadithIndex = () => get('data/hadith/index.json');
export const hadithChapter = (col, ch) => get(`data/hadith/${col}/${ch}.json`);

// ---- utilitaires Coran ----
export async function surahMeta(n) {
  const idx = await quranIndex();
  return idx.surahs[n - 1];
}
// id global (1..6236) d'un verset
export async function globalAyah(s, v) {
  const m = await surahMeta(s);
  return m.start + v;
}
export async function juzOfAyah(gid) {
  const idx = await quranIndex();
  let j = 1;
  for (let i = 1; i <= 30; i++) if (idx.juz[i] <= gid) j = i;
  return j;
}
export async function hizbOfAyah(gid) {
  const idx = await quranIndex();
  let q = 1;
  for (let i = 1; i < idx.hizbQuarters.length; i++) if (idx.hizbQuarters[i] <= gid) q = i;
  return { hizb: Math.ceil(q / 4), quarter: ((q - 1) % 4) + 1 };
}
export async function surahOfGlobal(gid) {
  const idx = await quranIndex();
  for (let i = idx.surahs.length - 1; i >= 0; i--) {
    if (idx.surahs[i].start < gid) return { s: idx.surahs[i].n, v: gid - idx.surahs[i].start };
  }
  return { s: 1, v: 1 };
}

// ---- audio ----
export const RECITERS = [
  { id: 'ar.alafasy',            name: 'Mishary Rashid Alafasy',   bitrates: [128, 64] },
  { id: 'ar.abdulbasitmurattal', name: 'Abdul Basit (murattal)',   bitrates: [192, 64] },
  { id: 'ar.husary',             name: 'Mahmoud Khalil Al-Husary', bitrates: [128, 64] },
  { id: 'ar.minshawi',           name: 'Mohamed Siddiq El-Minshawi', bitrates: [128, 64] },
  { id: 'ar.mahermuaiqly',       name: 'Maher Al-Muaiqly',         bitrates: [128, 64] },
];
export function audioUrls(reciter, gid) {
  const r = RECITERS.find(x => x.id === reciter) || RECITERS[0];
  return r.bitrates.map(b => `https://cdn.islamic.network/quran/audio/${b}/${r.id}/${gid}.mp3`);
}
