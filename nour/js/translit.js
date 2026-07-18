// Translittération automatique de l'arabe VOCALISÉ vers une phonétique
// lisible par un francophone (ou = ‘ou’ français, ch = ‘ch’, â/î/oû longues).
// Méthode : lecture lettre + harakat (fatha/kasra/damma/sukun/shadda/tanwin),
// voyelles longues, assimilation de l'article devant lettres solaires.
// Le texte arabe n'est jamais modifié : ceci est une aide à la lecture,
// générée automatiquement — la translittération du Coran, elle, provient
// de Tanzil (source vérifiée) et n'utilise pas ce module.

const CONS = {
  'ء': "'", 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'ch', 'ص': 's',
  'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': "'", 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
  'أ': "'", 'إ': "'", 'ؤ': "'", 'ئ': "'", 'ٮ': 'b',
};
const SUN = new Set(['ت','ث','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ل','ن']);

const FATHA = 'َ', DAMMA = 'ُ', KASRA = 'ِ',
  SUKUN = 'ْ', SHADDA = 'ّ',
  TAN_FATH = 'ً', TAN_DAMM = 'ٌ', TAN_KASR = 'ٍ',
  ALIF = 'ا', ALIF_MAQ = 'ى', WASLA = 'ٱ', MADDA = 'آ', TA_MARB = 'ة',
  DAGGER = 'ٰ';

const isHaraka = c => c >= 'ً' && c <= 'ْ' || c === DAGGER;

export function arToLatin(input) {
  if (!input) return '';
  // retire les marques coraniques/pausales hors harakat utiles
  const text = input.replace(/[ۖ-ࣰۭ-ࣿ]/g, '')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ');

  const out = [];
  const chars = [...text];
  let latin = '';

  const flushWord = () => {
    if (latin) { out.push(latin); latin = ''; }
  };

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];

    if (c === ' ' || /[^؀-ۿ]/.test(c)) { // fin de mot / ponctuation
      flushWord();
      if (c !== ' ') out.push(c);
      else if (out.length && out[out.length - 1] !== ' ') out.push(' ');
      continue;
    }
    if (isHaraka(c)) continue; // traitées avec leur consonne

    // groupe : lettre + ses signes
    let j = i + 1, marks = '';
    while (j < chars.length && isHaraka(chars[j])) { marks += chars[j]; j++; }
    const next = chars[j];

    const shadda = marks.includes(SHADDA);
    let vowel = marks.includes(FATHA) ? 'a'
      : marks.includes(KASRA) ? 'i'
      : marks.includes(DAMMA) ? 'ou'
      : marks.includes(TAN_FATH) ? 'an'
      : marks.includes(TAN_KASR) ? 'in'
      : marks.includes(TAN_DAMM) ? 'oun'
      : '';
    if (marks.includes(DAGGER)) vowel = 'â'; // alif suscrit : voyelle longue

    // ---- voyelles / lettres spéciales ----
    if (c === ALIF || c === WASLA) {
      // article après préposition attachée (bi-, wa-, fa-, li-, ka-) :
      // l'alif est muet, et « al » s'assimile devant lettre solaire chaddée
      if (latin && !marks && chars[j] === 'ل' && /(a|i|ou)$/.test(latin)) {
        let k = j + 1, mLam = '';
        // harakat portées par le lam lui-même
        let jj = j + 1, lamMarks = '';
        while (jj < chars.length && isHaraka(chars[jj])) { lamMarks += chars[jj]; jj++; }
        let after = jj, afterMarks = '';
        let a2 = after + 1;
        while (a2 < chars.length && isHaraka(chars[a2])) { afterMarks += chars[a2]; a2++; }
        if (!lamMarks && chars[after] && SUN.has(chars[after]) && afterMarks.includes(SHADDA)) {
          i = j; // article assimilé : saute alif + lam
          continue;
        }
        if (!lamMarks || lamMarks === SUKUN) {
          latin += 'l'; i = j; // article lunaire : alif muet, garde le lam
          continue;
        }
      }
      if (!latin && (!out.length || out[out.length - 1] === ' ')) {
        // début de mot : article ou hamza portée
        latin += vowel || 'a';
        // article « al » assimilé devant lettre solaire portant shadda
        if (chars[j] === 'ل') {
          let k = j + 1, m2 = '';
          while (k < chars.length && isHaraka(chars[k])) { m2 += chars[k]; k++; }
          // ال + lettre solaire chaddée : on saute le lam
          let k2 = k, m3 = '';
          k2 = k + 1;
          while (k2 < chars.length && isHaraka(chars[k2])) { m3 += chars[k2]; k2++; }
          if (!m2 && chars[k] && SUN.has(chars[k]) && m3.includes(SHADDA)) {
            i = j; // saute le lam, la shadda doublera la solaire
            continue;
          }
        }
      } else if (latin.endsWith('a')) {
        latin = latin.slice(0, -1) + 'â'; // alif de prolongation
      } else {
        latin += 'â';
      }
      i = j - 1;
      continue;
    }
    if (c === MADDA) { latin += 'â'; i = j - 1; continue; }
    if (c === ALIF_MAQ) {
      if (latin.endsWith('a')) latin = latin.slice(0, -1);
      latin += 'â'; i = j - 1; continue;
    }
    if (c === TA_MARB) {
      latin += vowel ? 't' + vowel : 'h';
      i = j - 1; continue;
    }

    // ---- consonnes ----
    let base = CONS[c] || '';
    if (c === 'و' && !marks && next !== ALIF) {
      // waw de prolongation après damma
      if (/(ou)$/.test(latin)) { latin = latin.slice(0, -2) + 'oû'; i = j - 1; continue; }
    }
    if (c === 'ي' && !marks) {
      // ya de prolongation après kasra
      if (/i$/.test(latin)) { latin = latin.slice(0, -1) + 'î'; i = j - 1; continue; }
    }
    if (shadda) base = base + base;

    latin += base + vowel;

    // voyelle longue : fatha suivie d'alif
    if (vowel === 'a' && (next === ALIF || next === ALIF_MAQ)) {
      let k = j + 1;
      // vérifie que l'alif n'a pas ses propres harakat (sinon c'est une hamza portée)
      let hasMarks = false;
      while (k < chars.length && isHaraka(chars[k])) { hasMarks = true; k++; }
      if (!hasMarks || chars[j] === ALIF_MAQ) {
        latin = latin.slice(0, -1) + 'â';
        i = j; // consomme l'alif
        continue;
      }
    }
    i = j - 1;
  }
  flushWord();

  return out.join('')
    .replace(/''/g, "'")
    .replace(/(^| )'/g, '$1') // hamza initiale implicite
    .replace(/ +/g, ' ')
    .trim();
}
