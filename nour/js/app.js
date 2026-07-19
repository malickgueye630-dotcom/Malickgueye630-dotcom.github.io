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
      try { await fn(m); }
      catch (err) {
        console.error(err);
        $view.innerHTML = `<div class="empty">${icon('close', 30)}<br>Impossible de charger ce contenu.<br><small>${esc(err.message)}</small><br><br><button class="btn" onclick="location.reload()">Réessayer</button></div>`;
      }
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
  ['hadith', 'Hadiths', 'library'],
  ['duas', 'Invocations', 'hands'],
];
function buildTabbar() {
  document.getElementById('tabbar').innerHTML = TABS.map(([tab, label, ic]) =>
    `<a href="#/${tab}" data-tab="${tab}"><span class="ic">${icon(ic, 23)}</span><span>${label}</span></a>`).join('');
}
function updateTabs(hash) {
  const tab = hash.startsWith('#/quran') ? 'quran'
    : hash.startsWith('#/search') ? 'search'
    : hash.startsWith('#/hadith') ? 'hadith'
    : hash.startsWith('#/duas') ? 'duas'
    : 'home';
  document.querySelectorAll('#tabbar a').forEach(a =>
    a.classList.toggle('active', a.dataset.tab === tab));
}

// ---------- réglages complets (AFFICHAGE / TEXTE / AUDIO) ----------
export function openSettings(tab = 'affichage') {
  const s = state.settings;
  const seg = (id, opts, cur) => `<div class="seg" data-seg="${id}">
    ${opts.map(([v, lab]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${lab}</button>`).join('')}</div>`;
  const row = (lab, sub, ctrl) => `<div class="setrow"><div class="lab">${lab}${sub ? `<small>${sub}</small>` : ''}</div>${ctrl}</div>`;
  const sw = (k, checked) => `<label class="switch"><input type="checkbox" data-k="${k}" ${checked ? 'checked' : ''}><span class="tr"></span></label>`;

  const panels = {
    affichage: () => `
      ${row('Thème', 'Clair, sombre ou selon l’iPhone', seg('theme', [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']], s.theme))}
      ${row('Couleurs', '', seg('palette', [['emeraude', 'Émeraude'], ['sable', 'Sable'], ['nuit', 'Nuit']], s.palette))}
      ${row('Taille de l’interface', '', seg('uiScale', [[0.92, 'A'], [1, 'A'], [1.1, 'A'], [1.2, 'A']], s.uiScale))}
      ${row('Format de l’heure', '', seg('timeFmt', [['24', '24 h'], ['12', '12 h']], s.timeFmt))}
      ${row('Police arabe', 'Amiri (coranique), intégrée hors-ligne', '<span class="tiny">Amiri</span>')}
    `,
    texte: () => `
      ${row('Texte arabe', '', sw('showAr', s.showAr))}
      ${row('Phonétique française', 'Transcription lisible pour francophone', sw('showTl', s.showTl))}
      ${row('Traduction française', 'Muhammad Hamidullah', sw('showFr', s.showFr))}
      ${row('Taille du texte arabe', '', seg('arSize', [[1.5, 'A'], [1.9, 'A'], [2.4, 'A'], [3, 'A']], s.arSize))}
      ${row('Taille de la phonétique', '', seg('tlSize', [[0.8, 'A'], [0.92, 'A'], [1.06, 'A'], [1.2, 'A']], s.tlSize))}
      ${row('Taille de la traduction', '', seg('frSize', [[0.85, 'A'], [0.98, 'A'], [1.12, 'A'], [1.28, 'A']], s.frSize))}
      ${row('Espacement des lignes (arabe)', '', seg('lineSpace', [[1.8, '−'], [2.05, '⋯'], [2.4, '+']], s.lineSpace))}
      ${row('Script arabe', 'Othmani (QuranEnc) — seul script disponible', '<span class="tiny">Othmani</span>')}
      ${row('Couleurs du tajwid', 'Pas encore disponible : aucune source fiable et libre intégrée', '<span class="tiny">—</span>')}
    `,
    audio: () => `
      ${row('Récitateur', '', `<select id="selReciter" style="font:inherit;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--bg-soft);color:var(--ink);max-width:170px">
        ${data.RECITERS.map(r => `<option value="${r.id}" ${r.id === s.reciter ? 'selected' : ''}>${r.name}</option>`).join('')}</select>`)}
      ${row('Vitesse de lecture', '', seg('speed', [[0.5, '0,5×'], [0.75, '0,75×'], [1, '1×'], [1.25, '1,25×'], [1.5, '1,5×']], s.audio.speed))}
      ${row('Enchaîner les versets', 'Lecture automatique du suivant', sw('a.autoNext', s.audio.autoNext))}
      ${row('Défilement automatique', 'Suivre la récitation à l’écran', sw('a.autoScroll', s.audio.autoScroll))}
      ${row('Répétition de chaque verset', 'Pour l’apprentissage', seg('repeatVerse', [[1, '1×'], [2, '2×'], [3, '3×'], [5, '5×'], [10, '10×']], s.audio.repeatVerse))}
      ${row('Répéter la sourate', '', sw('a.repeatSurah', s.audio.repeatSurah))}
      ${row('Sourate suivante automatique', 'Sinon, arrêt à la fin de la sourate', sw('a.continueSurah', s.audio.continueSurah))}
      ${row('Télécharger le Coran', 'Accès hors-ligne complet', '<button class="btn btn-ghost" id="btnOffline">Télécharger</button>')}
    `,
  };

  sheet(`
    <h3>Réglages</h3>
    <div class="sheet-tabs" id="setTabs">
      <button data-t="affichage">Affichage</button>
      <button data-t="texte">Texte</button>
      <button data-t="audio">Audio</button>
    </div>
    <div id="setPanel"></div>
    <div class="setrow"><div class="lab">Prières, Qibla &amp; notifications</div><a class="backlink" href="#/prayer" onclick="document.getElementById('sheet-root').innerHTML=''">Ouvrir ${icon('chevR', 14)}</a></div>
    <div class="setrow"><div class="lab">Sources &amp; à propos</div><a class="backlink" href="#/about" onclick="document.getElementById('sheet-root').innerHTML=''">Voir ${icon('chevR', 14)}</a></div>
  `, (el) => {
    const tabs = el.querySelector('#setTabs');
    const panel = el.querySelector('#setPanel');
    let cur = tab;

    const bindPanel = () => {
      // segments
      panel.querySelectorAll('[data-seg]').forEach(segEl => {
        segEl.onclick = e => {
          const v = e.target.dataset?.v;
          if (v === undefined) return;
          const key = segEl.dataset.seg;
          const num = parseFloat(v);
          const val = isNaN(num) || String(num) !== v ? v : num;
          if (key === 'speed') { s.audio.speed = val; player.audio.playbackRate = val; }
          else if (key === 'repeatVerse') s.audio.repeatVerse = val;
          else s[key] = val;
          save(); applyTheme(); applySizes();
          segEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.target));
          if (location.hash.includes('/quran/s/') && ['arSize','tlSize','frSize','lineSpace'].includes(key) === false && ['theme','palette','uiScale','timeFmt'].includes(key) === false) route();
        };
      });
      // interrupteurs
      panel.querySelectorAll('input[data-k]').forEach(inp => inp.onchange = () => {
        const k = inp.dataset.k;
        if (k.startsWith('a.')) s.audio[k.slice(2)] = inp.checked;
        else s[k] = inp.checked;
        save();
        if (location.hash.includes('/quran/s/') || location.hash.includes('/hadith') || location.hash.includes('/duas')) route();
      });
      panel.querySelector('#selReciter')?.addEventListener('change', e => { s.reciter = e.target.value; save(); });
      panel.querySelector('#btnOffline')?.addEventListener('click', async e => {
        const btn = e.target;
        btn.textContent = '0 %'; btn.disabled = true;
        try {
          const urls = ['data/quran/search-fr.json', 'data/quran/search-ar.json', 'data/quran/phonetic.json'];
          for (let i = 1; i <= 114; i++) urls.push(`data/quran/s/${i}.json`);
          for (let i = 0; i < urls.length; i += 10) {
            await Promise.all(urls.slice(i, i + 10).map(u => fetch(u)));
            btn.textContent = Math.round(Math.min(urls.length, i + 10) / urls.length * 100) + ' %';
          }
          btn.textContent = 'Téléchargé ✓';
          toast('Coran disponible hors-ligne');
        } catch {
          btn.textContent = 'Réessayer'; btn.disabled = false;
          toast('Échec — vérifiez la connexion');
        }
      });
    };

    const show = t => {
      cur = t;
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
      panel.innerHTML = panels[t]();
      bindPanel();
    };
    tabs.onclick = e => { const t = e.target.dataset?.t; if (t) show(t); };
    show(cur);
  });
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
