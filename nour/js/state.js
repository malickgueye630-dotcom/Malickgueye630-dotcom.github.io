// État persistant (localStorage) — favoris, réglages, reprise de lecture.
const KEY = 'nour:v1';

const defaults = {
  settings: {
    theme: 'auto',          // auto | light | dark
    arSize: 1.9,            // rem
    showAr: true,
    showFr: true,
    showTl: false,
    reciter: 'ar.alafasy',
  },
  favorites: {
    verses: [],             // "s:v"
    duas: [],               // id de dua
    hadithsFr: [],          // id de la sélection FR
    hadiths: [],            // "collection:refId"
  },
  bookmarks: [],            // { s, v, ts }
  lastRead: null,           // { s, v, ts }
  searchHistory: [],        // chaînes récentes
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(defaults);
    const d = JSON.parse(raw);
    return {
      ...structuredClone(defaults),
      ...d,
      settings: { ...defaults.settings, ...(d.settings || {}) },
      favorites: { ...structuredClone(defaults.favorites), ...(d.favorites || {}) },
    };
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
  state.lastRead = { s, v, ts: Date.now() };
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
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

export function applyArSize() {
  document.documentElement.style.setProperty('--ar-size', state.settings.arSize + 'rem');
}
