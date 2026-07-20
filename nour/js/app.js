// Nour — routeur & noyau applicatif
import { state, save, applyTheme, applySizes } from './state.js';
import * as data from './data.js';
import { icon } from './icons.js';
import { viewHome } from './views-home.js';
import { viewQuranList, viewSurah } from './views-quran.js';
import { viewSearch } from './views-search.js';
import { viewHadithHome, viewCollection, viewChapter, viewTheme, viewFindHadith } from './views-hadith.js';
import { viewDuas, viewDuaCategory } from './views-duas.js';
import { viewFavorites } from './views-favorites.js';
import { viewAbout } from './views-about.js';
import { viewPrayer } from './views-prayer.js';
import { viewQibla } from './views-qibla.js';
import { viewTasbih } from './views-tasbih.js';
import { viewMore } from './views-more.js';
import { viewSettings } from './views-settings.js';
import { viewLearn, viewLearnGuide } from './views-learn.js';
import { startScheduler, notifGranted } from './notify.js';

export const $view = document.getElementById('view');

// ---------- utilitaires ----------
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

export function sheet(html, onOpen) {
  const root = document.getElementById('sheet-root');
  root.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog"><div class="grab"></div>${html}</div>`;
  root.querySelector('.sheet-backdrop').onclick = closeSheet;
  onOpen?.(root.querySelector('.sheet'));
}
export function closeSheet() {
  document.getElementById('sheet-root').innerHTML = '';
}

export async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); toast('Copié'); }
  catch { toast('Copie impossible'); }
}
export async function shareText(title, text) {
  if (navigator.share) { try { await navigator.share({ title, text }); } catch {} }
  else copyText(text);
}

export function vibrate(ms = 12) {
  if (!state.settings.haptics) return;
  try { navigator.vibrate?.(ms); } catch {}
}

// date hégirienne en français (calendrier Umm al-Qura)
export function hijriDate(d = new Date(), opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  try {
    return new Intl.DateTimeFormat('fr-u-ca-islamic-umalqura', opts).format(d).replace(' ère de l’Hégire', ' AH').replace(' AH', ' H');
  } catch { return ''; }
}
export const frDate = (d = new Date()) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);

export const fmtClock = d => d.toLocaleTimeString('fr-FR',
  state.settings.timeFmt === '12' ? { hour: 'numeric', minute: '2-digit', hour12: true } : { hour: '2-digit', minute: '2-digit' });

// ---------- lecteur audio ----------
export const player = {
  audio: new Audio(),
  queue: [], pos: 0, urlIdx: 0, playing: false,
  repeatLeft: 0,
  onchange: null,

  start(queue, pos = 0) {
    this.queue = queue;
    this.pos = pos;
    this.repeatLeft = Math.max(0, (state.settings.audio.repeatVerse || 1) - 1);
    this.load();
  },
  load() {
    const item = this.queue[this.pos];
    if (!item) return this.stop();
    this.urlIdx = 0;
    this._urls = data.audioUrls(state.settings.reciter, item.gid);
    this.audio.src = this._urls[0];
    this.audio.playbackRate = state.settings.audio.speed || 1;
    this.audio.play().then(() => { this.playing = true; this.render(); this.onchange?.(item); })
      .catch(() => { this.playing = false; this.render(); });
  },
  toggle() {
    if (this.audio.paused) { this.audio.play(); this.playing = true; }
    else { this.audio.pause(); this.playing = false; }
    this.render();
  },
  next() {
    this.repeatLeft = Math.max(0, (state.settings.audio.repeatVerse || 1) - 1);
    if (this.pos < this.queue.length - 1) { this.pos++; this.load(); }
    else this.finishSurah();
  },
  prev() {
    this.repeatLeft = Math.max(0, (state.settings.audio.repeatVerse || 1) - 1);
    if (this.pos > 0) { this.pos--; this.load(); }
    else { this.audio.currentTime = 0; }
  },
  finishSurah() {
    const a = state.settings.audio;
    const item = this.queue[this.pos];
    if (a.repeatSurah && this.queue.length) { this.pos = 0; this.load(); return; }
    if (a.continueSurah && item?.s && item.s < 114) {
      this.stop();
      location.hash = `#/quran/s/${item.s + 1}?autoplay=1`;
      return;
    }
    this.stop();
  },
  cycleSpeed() {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5];
    const cur = state.settings.audio.speed || 1;
    const nx = speeds[(speeds.indexOf(cur) + 1) % speeds.length];
    state.settings.audio.speed = nx;
    save();
    this.audio.playbackRate = nx;
    this.render();
  },
  stop() {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.queue = []; this.playing = false;
    this.onchange?.(null);
    document.getElementById('player').hidden = true;
  },
  render() {
    const el = document.getElementById('player');
    const item = this.queue[this.pos];
    if (!item) { el.hidden = true; return; }
    const rec = data.RECITERS.find(r => r.id === state.settings.reciter);
    el.hidden = false;
    el.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="prow">
          <button class="pbtn" data-a="prev" aria-label="Verset précédent">${icon('prev', 17)}</button>
          <button class="pbtn" data-a="toggle" aria-label="Lecture / pause">${icon(this.playing ? 'pause' : 'play', 19)}</button>
          <button class="pbtn" data-a="next" aria-label="Verset suivant">${icon('next', 17)}</button>
          <div class="pinfo" style="flex:1;min-width:0;margin-left:4px">
            <b>${esc(item.label)}</b>${esc(rec?.name || '')}
          </div>
          <button class="pbtn pspeed" data-a="cycleSpeed" aria-label="Vitesse">${(state.settings.audio.speed || 1).toString().replace('.', ',')}×</button>
          <button class="pbtn" data-a="stop" aria-label="Fermer">${icon('close', 16)}</button>
        </div>
        <div class="pbar"><div id="pprog"></div></div>
      </div>`;
    el.querySelectorAll('button').forEach(b => b.onclick = () => this[b.dataset.a]());
  },
};
player.audio.addEventListener('timeupdate', () => {
  const p = document.getElementById('pprog');
  if (p && player.audio.duration) p.style.width = (player.audio.currentTime / player.audio.duration * 100) + '%';
});
player.audio.addEventListener('ended', () => {
  if (player.repeatLeft > 0) { player.repeatLeft--; player.audio.currentTime = 0; player.audio.play().catch(() => {}); return; }
  player.next();
});
player.audio.addEventListener('error', () => {
  if (player._urls && player.urlIdx < player._urls.length - 1) {
    player.urlIdx++;
    player.audio.src = player._urls[player.urlIdx];
    player.audio.playbackRate = state.settings.audio.speed || 1;
    player.audio.play().catch(() => {});
  } else if (player.queue.length) {
    toast('Audio indisponible (connexion ?)');
    player.stop();
  }
});

// répéter un verset précis (bouton 🔁 du lecteur de sourate)
export function repeatVerse(queue, pos, times) {
  player.queue = queue;
  player.pos = pos;
  player.repeatLeft = Math.max(0, times - 1);
  player.load();
}

// ---------- routeur ----------
const routes = [
  [/^#?\/?$/, () => viewHome()],
  [/^#\/home$/, () => viewHome()],
  [/^#\/quran$/, () => viewQuranList()],
  [/^#\/quran\/s\/(\d+)(?:\?.*)?$/, (m) => viewSurah(+m[1], (location.hash.match(/[?&]v=(\d+)/) || [])[1] ? +(location.hash.match(/[?&]v=(\d+)/) || [])[1] : null)],
  [/^#\/search(?:\?q=(.*))?$/, (m) => viewSearch(m[1] ? decodeURIComponent(m[1]) : '')],
  [/^#\/hadith$/, () => viewHadithHome()],
  [/^#\/hadith\/theme\/([\w-]+)$/, (m) => viewTheme(m[1])],
  [/^#\/hadith\/([\w-]+)\/find\/(\d+)$/, (m) => viewFindHadith(m[1], +m[2])],
  [/^#\/prayer$/, () => viewPrayer()],
  [/^#\/qibla$/, () => viewQibla()],
  [/^#\/tasbih$/, () => viewTasbih()],
  [/^#\/more$/, () => viewMore()],
  [/^#\/learn$/, () => viewLearn()],
  [/^#\/learn\/([\w-]+)$/, (m) => viewLearnGuide(m[1])],
  [/^#\/settings(?:\?.*)?$/, () => viewSettings((location.hash.match(/[?&]sec=([\w-]+)/) || [])[1] || null)],
  [/^#\/hadith\/([\w-]+)\/(\d+)(?:\?.*)?$/, (m) => viewChapter(m[1], +m[2])],
  [/^#\/hadith\/([\w-]+)$/, (m) => viewCollection(m[1])],
  [/^#\/duas$/, () => viewDuas()],
  [/^#\/duas\/([\w-]+)(?:\?.*)?$/, (m) => viewDuaCategory(m[1])],
  [/^#\/favorites$/, () => viewFavorites()],
  [/^#\/about$/, () => viewAbout()],
];

async function route() {
  closeSheet(); // une navigation ferme toute feuille ouverte
  const h = location.hash || '#/home';
  for (const [re, fn] of routes) {
    const m = h.match(re);
    if (m) {
      updateTabs(h);
      // relance la transition de page à chaque navigation
      $view.classList.remove('pagein');
      try { await fn(m); }
      catch (err) {
        console.error(err);
        $view.innerHTML = `<div class="empty">${icon('close', 30)}<br>Impossible de charger ce contenu.<br><small>${esc(err.message)}</small><br><br><button class="btn" onclick="location.reload()">Réessayer</button></div>`;
      }
      void $view.offsetWidth;
      $view.classList.add('pagein');
      window.scrollTo({ top: 0 });
      return;
    }
  }
  location.hash = '#/home';
}

const TABS = [
  ['home', 'Accueil', 'home'],
  ['quran', 'Coran', 'book'],
  ['search', 'Recherche', 'search'],
  ['prayer', 'Prières', 'mosque'],
  ['more', 'Plus', 'grid'],
];
function buildTabbar() {
  document.getElementById('tabbar').innerHTML = TABS.map(([tab, label, ic]) =>
    `<a href="#/${tab}" data-tab="${tab}"><span class="ic">${icon(ic, 23)}</span><span>${label}</span></a>`).join('');
}
function updateTabs(hash) {
  const tab = hash.startsWith('#/quran') ? 'quran'
    : hash.startsWith('#/search') ? 'search'
    : hash.startsWith('#/prayer') ? 'prayer'
    : /^#\/(hadith|duas|more|tasbih|qibla|favorites|settings|about|learn)/.test(hash) ? 'more'
    : 'home';
  document.querySelectorAll('#tabbar a').forEach(a =>
    a.classList.toggle('active', a.dataset.tab === tab));
}

// ---------- réglages : page dédiée (#/settings), organisée par catégories ----------
// compatibilité : les anciens appels openSettings('texte'|'audio'|'affichage')
// ouvrent la bonne section de la page.
export function openSettings(tab = 'apparence') {
  const sec = { affichage: 'apparence', texte: 'coran', audio: 'coran' }[tab] || tab;
  location.hash = `#/settings?sec=${sec}`;
}

// ---------- entête commun ----------
export function topbar(title) {
  return `<div class="row" style="justify-content:space-between;margin:2px 0 4px">
    <h1 style="margin:8px 0">${esc(title)}</h1>
    <div class="row" style="gap:2px">
      <button class="btn-icon" aria-label="Favoris" onclick="location.hash='#/favorites'">${icon('star', 21)}</button>
      <button class="btn-icon" aria-label="Réglages" id="btnSettings">${icon('settings', 21)}</button>
    </div>
  </div>`;
}
export function bindTopbar() {
  document.getElementById('btnSettings')?.addEventListener('click', () => openSettings());
}

// ---------- bannière d'installation iOS ----------
function iosInstallHint() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!isIOS || standalone || localStorage.getItem('nour:ioshint')) return;
  const div = document.createElement('div');
  div.className = 'iosbanner';
  div.innerHTML = `<span class="em">${icon('download', 26)}</span><div><b>Installer Nour</b><br>
    Touchez <b>Partager</b> puis « <b>Sur l'écran d'accueil</b> » pour utiliser Nour comme une application.</div>
    <button class="btn-icon" aria-label="Fermer">${icon('close', 18)}</button>`;
  div.querySelector('button').onclick = () => { div.remove(); localStorage.setItem('nour:ioshint', '1'); };
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 15000);
}

// ---------- démarrage ----------
applyTheme();
applySizes();
buildTabbar();
window.addEventListener('hashchange', route);
route();
iosInstallHint();
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
if (notifGranted()) startScheduler();
