// Translittération automatique de l'arabe VOCALISÉ vers une phonétique
// française (mêmes conventions que scripts/phonetics_fr.py : ou/oû, â/î,
// ch, kh, gh, article assimilé « r-r », Allah unifié).
// Aide à la lecture générée — le texte arabe n'est jamais modifié.
// La phonétique du Coran est pré-générée ; ce module sert aux hadiths.

const CONS = {
  'ء': "'", 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'ch', 'ص': 's',
  'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': "'", 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
  'أ': "'", 'إ': "'", 'ؤ': "'", 'ئ': "'",
};
const SUN = new Set(['ت','ث','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ل','ن']);

const FATHA = 'َ', DAMMA = 'ُ', KASRA = 'ِ', SUKUN = 'ْ', SHADDA = 'ّ',
  TAN_F = 'ً', TAN_D = 'ٌ', TAN_K = 'ٍ',
  ALIF = 'ا', ALIF_MAQ = 'ى', WASLA = 'ٱ', MADDA_L = 'آ', TA_MARB = 'ة', DAGGER = 'ٰ';

const isHaraka = c => (c >= 'ً' && c <= 'ْ') || c === DAGGER;

export function arToLatin(input) {
  if (!input) return '';
  const text = input
    .replace(/[ۖ-ۜ۞ۘۛ]/g, '').replace(/[ۢ-ۭ]/g, '').replace(/[۟-۠]/g, '')
    .replace(/ۡ/g, SUKUN).replace(/ٓ/g, '').replace(/ٔ/g, '').replace(/ٞ/g, TAN_F)
    .replace(/ٖ/g, KASRA + 'ۦ').replace(/ٗ/g, DAMMA + 'ۥ')
    .replace(/ـ/g, '').replace(/\s+/g, ' ');

  const chars = [...text];
  const out = [];
  let latin = '', hyphenNext = false;
  const n = chars.length;

  const flush = () => { if (latin) { out.push(latin); latin = ''; } };
  const prevEndsVowel = () => {
    if (latin) return /[aiouâîû]$/.test(latin);
    if (out.length >= 2 && out[out.length - 1] === ' ') return /[aiouâîû]$/.test(out[out.length - 2]);
    return false;
  };

  for (let i = 0; i < n; i++) {
    const c = chars[i];
    if (c === ' ' || !/[؀-ۿ]/.test(c)) {
      flush();
      if (c !== ' ') out.push(c);
      else if (out.length && out[out.length - 1] !== ' ') out.push(' ');
      continue;
    }
    if (isHaraka(c)) continue;

    let j = i + 1, marks = '';
    while (j < n && isHaraka(chars[j])) { marks += chars[j]; j++; }
    const nxt = chars[j];

    const shadda = marks.includes(SHADDA);
    let vowel = marks.includes(FATHA) ? 'a'
      : marks.includes(KASRA) ? 'i'
      : marks.includes(DAMMA) ? 'ou'
      : marks.includes(TAN_F) ? 'an'
      : marks.includes(TAN_K) ? 'in'
      : marks.includes(TAN_D) ? 'oun' : '';
    if (marks.includes(DAGGER)) vowel = 'â';

    if (c === 'ۥ') { latin = latin.endsWith('ou') ? latin.slice(0, -2) + 'oû' : latin + 'oû'; i = j - 1; continue; }
    if (c === 'ۦ' || c === 'ۧ') { latin = latin.endsWith('i') ? latin.slice(0, -1) + 'î' : latin + 'î'; i = j - 1; continue; }

    if (c === ALIF || c === WASLA) {
      const wordStart = !latin && (!out.length || out[out.length - 1] === ' ');
      const elide = c === WASLA && wordStart && prevEndsVowel();
      if (!wordStart && !marks && /(an|in|oun)$/.test(latin)) { i = j - 1; continue; } // alif du tanwin

      // article après préposition attachée (bi-, wa-, li-…)
      const articleCheck = () => {
        if (chars[j] !== 'ل') return 0;
        let jj = j + 1, lamMarks = '';
        while (jj < n && isHaraka(chars[jj])) { lamMarks += chars[jj]; jj++; }
        let a2 = jj + 1, afterMarks = '';
        while (a2 < n && isHaraka(chars[a2])) { afterMarks += chars[a2]; a2++; }
        if (!lamMarks && chars[jj] && SUN.has(chars[jj]) && afterMarks.includes(SHADDA)) return 1; // solaire
        if (!lamMarks || lamMarks === SUKUN) return 2; // lunaire
        return 0;
      };

      if (!wordStart && !marks && /(a|i|ou)$/.test(latin)) {
        const kind = articleCheck();
        if (kind === 1) { hyphenNext = true; i = j; continue; }
        if (kind === 2) { latin += 'l-'; i = j; continue; }
      }
      if (wordStart) {
        if (!elide) latin += vowel || 'a';
        const kind = articleCheck();
        if (kind === 1) { hyphenNext = true; i = j; continue; }
        if (kind === 2 && !marks) { latin += 'l-'; i = j; continue; }
      } else if (latin.endsWith('a')) {
        latin = latin.slice(0, -1) + 'â';
      } else {
        latin += 'â';
      }
      i = j - 1;
      continue;
    }
    if (c === MADDA_L) { latin = latin.endsWith('a') ? latin.slice(0, -1) + 'â' : latin + 'â'; i = j - 1; continue; }
    if (c === ALIF_MAQ) {
      if (latin.endsWith('a')) latin = latin.slice(0, -1);
      latin += 'â'; i = j - 1; continue;
    }
    if (c === TA_MARB) { latin += vowel ? 't' + vowel : 'h'; i = j - 1; continue; }

    let base = CONS[c] || '';
    if (c === 'و' && !marks && latin.endsWith('ou')) { latin = latin.slice(0, -2) + 'oû'; i = j - 1; continue; }
    if (c === 'ي' && !marks && latin.endsWith('i')) { latin = latin.slice(0, -1) + 'î'; i = j - 1; continue; }

    const wordStartCons = !latin && (!out.length || out[out.length - 1] === ' ');
    if (shadda && (!wordStartCons || hyphenNext)) {
      base = (hyphenNext && c !== 'ل') ? base + '-' + base : base + base;
    }
    hyphenNext = false;

    latin += base + vowel;

    if (vowel === 'a' && (nxt === ALIF || nxt === ALIF_MAQ)) {
      let k = j + 1, hasMarks = false;
      while (k < n && isHaraka(chars[k])) { hasMarks = true; k++; }
      if (!hasMarks || nxt === ALIF_MAQ) {
        latin = latin.slice(0, -1) + 'â';
        i = j;
        continue;
      }
    }
    i = j - 1;
  }
  flush();

  let s = out.join('')
    .replace(/''/g, "'")
    .replace(/(^| )'/g, '$1')
    .replace(/ +/g, ' ')
    .trim();
  s = s.replace(/llah/g, 'llâh').replace(/\ballâh/g, 'Allâh').replace(/\bllâh/g, 'Llâh');
  return s;
}
