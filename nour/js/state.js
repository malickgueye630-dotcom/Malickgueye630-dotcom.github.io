// État persistant (localStorage) — réglages, favoris, notes, reprise, tasbih.
const KEY = 'nour:v1';

const defaults = {
  v: 2,
  settings: {
    theme: 'auto',            // auto | light | dark
    palette: 'emeraude',      // emeraude | sable | nuit
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
    // migration v1 → v2 : la phonétique devient active par défaut
    if (!d.v || d.v < 2) {
      merged.settings.showTl = true;
      merged.v = 2;
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

export function applyTheme() {
  const t = state.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.palette = state.settings.palette || 'emeraude';
  // couleur personnalisée : dérive les couleurs de marque de la teinte choisie
  const r = document.documentElement.style;
  if (state.settings.palette === 'custom') {
    const h = state.settings.customHue ?? 165;
    r.setProperty('--brand', `hsl(${h} 62% ${dark ? 55 : 34}%)`);
    r.setProperty('--brand-2', `hsl(${h} 55% 18%)`);
    r.setProperty('--hero-grad', `linear-gradient(140deg, hsl(${h} 55% 15%) 0%, hsl(${h} 58% 30%) 55%, hsl(${(h + 22) % 360} 50% 42%) 100%)`);
  } else {
    r.removeProperty('--brand'); r.removeProperty('--brand-2'); r.removeProperty('--hero-grad');
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
}
export const applyArSize = applySizes; // compatibilité
