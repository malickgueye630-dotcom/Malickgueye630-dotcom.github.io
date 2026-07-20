// État persistant (localStorage) — réglages, favoris, notes, reprise, tasbih.
const KEY = 'nour:v1';

const defaults = {
  v: 3,
  settings: {
    theme: 'auto',            // auto | light | dark
    palette: 'emeraude',      // emeraude | sable | nuit | lavande | custom
    arSize: 1.9,              // rem — texte arabe
    tlSize: 0.92,             // rem — phonétique
    frSize: 0.98,             // rem — traduction
    lineSpace: 2.05,          // interligne arabe
    uiScale: 1,               // taille générale
    showAr: true,
    showFr: true,
    showTl: true,             // phonétique française activée par défaut
    translitStyle: 'fr',      // fr (française) | dmg (académique, hadiths seulement)
    timeFmt: '24',            // 24 | 12
    haptics: true,            // vibrations (tasbih, qibla)
    showEnFallback: false,    // traduction anglaise de secours dans les recueils
    customHue: 165,           // teinte de la couleur personnalisée
    userName: 'Malick',       // prénom affiché dans la salutation
    colors: null,             // personnalisation avancée {primary,accent,bgHue,...}
    arFont: 'amiri',          // amiri | system — police du texte arabe
    tajwid: false,            // coloration tajwid simplifiée (qalqala, ghunna, madd)
    readingTheme: 'normal',   // normal | sepia | vert — fond du lecteur Coran
    qiblaSens: 4,             // seuil d'alignement Qibla en degrés (2 | 4 | 8)
    searchHistoryOn: true,    // mémoriser les recherches récentes
    searchSuggest: true,      // suggestions pendant la saisie
    searchPhonetic: true,     // recherche phonétique arabe
    searchSmart: true,        // compréhension intelligente (sujets, réponse directe)
    ai: {                     // assistant IA en ligne
      enabled: true,          // actif : une carte « Réponse IA » complète les résultats
      mode: 'simple',         // 'simple' = service public gratuit sans clé ; 'proxy' = votre serveur
      endpoint: '',           // (mode proxy) URL du Worker Cloudflare — voir nour/server/README-IA.md
      token: '',              // (mode proxy) jeton partagé optionnel
    },
    reciter: 'ar.alafasy',
    audio: {
      autoNext: true,         // enchaîner les versets
      autoScroll: true,       // suivre la récitation
      repeatVerse: 1,         // répétitions par verset (1 = aucune)
      repeatSurah: false,
      continueSurah: false,   // passer à la sourate suivante
      speed: 1,
    },
    dailyGoal: 10,            // versets par jour
  },
  favorites: { verses: [], duas: [], hadithsFr: [], hadiths: [] },
  bookmarks: [],              // { s, v, ts }
  notes: {},                  // "s:v" → texte
  lastRead: null,             // { s, v, ts }
  recents: [],                // [{ s, ts }]
  readLog: {},                // "YYYY-MM-DD" → nb versets lus
  searchHistory: [],
  tasbih: { current: 0, target: 33, dhikrId: 0, totals: {}, custom: [] },
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(defaults);
    const d = JSON.parse(raw);
    const merged = {
      ...structuredClone(defaults),
      ...d,
      settings: { ...structuredClone(defaults.settings), ...(d.settings || {}) },
      favorites: { ...structuredClone(defaults.favorites), ...(d.favorites || {}) },
      tasbih: { ...structuredClone(defaults.tasbih), ...(d.tasbih || {}) },
    };
    merged.settings.audio = { ...structuredClone(defaults.settings.audio), ...((d.settings || {}).audio || {}) };
    merged.settings.ai = { ...structuredClone(defaults.settings.ai), ...((d.settings || {}).ai || {}) };
    // migration v1 → v2 : la phonétique devient active par défaut
    if (!d.v || d.v < 2) {
      merged.settings.showTl = true;
      merged.v = 2;
    }
    // migration v2 → v3 : la palette Violet devient Lavande
    if (merged.v < 3) {
      if (merged.settings.palette === 'violet') merged.settings.palette = 'lavande';
      merged.v = 3;
    }
    return merged;
  } catch {
    return structuredClone(defaults);
  }
}

export const state = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export function toggleFav(list, id) {
  const arr = state.favorites[list];
  const i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1); else arr.unshift(id);
  save();
  return i < 0;
}
export const isFav = (list, id) => state.favorites[list].includes(id);

export function setLastRead(s, v) {
  const prev = state.lastRead;
  state.lastRead = { s, v, ts: Date.now() };
  // journal de lecture (progression / objectif quotidien)
  if (!prev || prev.s !== s || prev.v !== v) {
    const day = new Date().toISOString().slice(0, 10);
    state.readLog[day] = (state.readLog[day] || 0) + 1;
    const days = Object.keys(state.readLog).sort();
    for (const k of days.slice(0, -60)) delete state.readLog[k];
  }
  save();
}

export function pushRecent(s) {
  state.recents = [{ s, ts: Date.now() }, ...state.recents.filter(r => r.s !== s)].slice(0, 8);
  save();
}

export function toggleBookmark(s, v) {
  const i = state.bookmarks.findIndex(b => b.s === s && b.v === v);
  if (i >= 0) state.bookmarks.splice(i, 1);
  else state.bookmarks.unshift({ s, v, ts: Date.now() });
  save();
  return i < 0;
}
export const isBookmarked = (s, v) => state.bookmarks.some(b => b.s === s && b.v === v);

export function setNote(s, v, text) {
  const k = `${s}:${v}`;
  if (text && text.trim()) state.notes[k] = text.trim();
  else delete state.notes[k];
  save();
}
export const getNote = (s, v) => state.notes[`${s}:${v}`] || '';

export function pushHistory(q) {
  const h = state.searchHistory.filter(x => x !== q);
  h.unshift(q);
  state.searchHistory = h.slice(0, 12);
  save();
}

// ---------- utilitaires couleur (personnalisation avancée) ----------
const CUSTOM_VARS = ['--brand', '--brand-2', '--brand-3', '--gold', '--gold-soft',
  '--bg', '--bg-soft', '--card', '--card-2', '--ink', '--ink-2', '--ink-3', '--line',
  '--hero-grad', '--btn-bg', '--btn-ink'];
const hex2rgb = h => {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const rgb2hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex([0, 1, 2].map(i => A[i] + (B[i] - A[i]) * t)); };
// luminance relative perçue (0 sombre → 1 clair)
const lum = h => { const [r, g, b] = hex2rgb(h).map(v => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const readableInk = bg => lum(bg) > 0.55 ? '#17211F' : '#F3F1EA';

// applique une personnalisation complète et TOUJOURS lisible à partir de
// quelques couleurs choisies par l'utilisateur
export function applyColors(dark) {
  const c = state.settings.colors;
  const r = document.documentElement.style;
  if (!c) { CUSTOM_VARS.forEach(v => r.removeProperty(v)); return; }
  const primary = c.primary || '#0F8B6D';
  const secondary = c.secondary || mix(primary, '#000000', 0.5);
  const accent = c.accent || '#D4AF6A';
  const bg = c.bg || (dark ? '#0A1412' : '#F7F2E8');
  const card = c.card || (dark ? '#13211E' : '#FFFDFC');
  const btn = c.button || primary;
  const ink = readableInk(bg);
  const cardInk = readableInk(card);
  r.setProperty('--brand', primary);
  r.setProperty('--brand-2', secondary);
  r.setProperty('--brand-3', mix(primary, '#ffffff', 0.28));
  r.setProperty('--gold', accent);
  r.setProperty('--gold-soft', mix(accent, card, 0.75));
  r.setProperty('--bg', bg);
  r.setProperty('--bg-soft', mix(bg, ink, 0.07));
  r.setProperty('--card', card);
  r.setProperty('--card-2', mix(card, cardInk, 0.045));
  r.setProperty('--ink', cardInk);
  r.setProperty('--ink-2', mix(cardInk, card, 0.32));
  r.setProperty('--ink-3', mix(cardInk, card, 0.52));
  r.setProperty('--line', mix(card, cardInk, 0.14));
  r.setProperty('--hero-grad', `linear-gradient(150deg, ${secondary} 0%, ${primary} 60%, ${mix(primary, '#ffffff', 0.22)} 100%)`);
  r.setProperty('--btn-bg', btn);
  r.setProperty('--btn-ink', lum(btn) > 0.6 ? '#17211F' : '#FFFFFF');
}

export function applyTheme() {
  const t = state.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.palette = state.settings.palette || 'emeraude';
  const r = document.documentElement.style;
  // 1) personnalisation avancée (prioritaire)
  if (state.settings.palette === 'custom' && state.settings.colors) {
    applyColors(dark);
  } else if (state.settings.palette === 'custom') {
    // 2) mode « une seule teinte » (curseur)
    CUSTOM_VARS.forEach(v => r.removeProperty(v));
    const h = state.settings.customHue ?? 165;
    r.setProperty('--brand', `hsl(${h} 62% ${dark ? 55 : 34}%)`);
    r.setProperty('--brand-2', `hsl(${h} 55% 18%)`);
    r.setProperty('--hero-grad', `linear-gradient(140deg, hsl(${h} 55% 15%) 0%, hsl(${h} 58% 30%) 55%, hsl(${(h + 22) % 360} 50% 42%) 100%)`);
  } else {
    CUSTOM_VARS.forEach(v => r.removeProperty(v));
  }
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

export function applySizes() {
  const r = document.documentElement.style;
  const s = state.settings;
  r.setProperty('--ar-size', s.arSize + 'rem');
  r.setProperty('--tl-size', s.tlSize + 'rem');
  r.setProperty('--fr-size', s.frSize + 'rem');
  r.setProperty('--ar-line', s.lineSpace);
  r.setProperty('--ui-scale', s.uiScale);
  r.setProperty('--ar-font', s.arFont === 'system' ? "'Geeza Pro', 'Scheherazade New', serif" : "'Amiri', 'Scheherazade New', 'Geeza Pro', serif");
  document.documentElement.dataset.reading = s.readingTheme || 'normal';
}
export const applyArSize = applySizes; // compatibilité
