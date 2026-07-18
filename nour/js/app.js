// Nour — routeur & noyau applicatif
import { state, save, applyTheme, applyArSize } from './state.js';
import * as data from './data.js';
import { viewHome } from './views-home.js';
import { viewQuranList, viewSurah } from './views-quran.js';
import { viewSearch } from './views-search.js';
import { viewHadithHome, viewCollection, viewChapter, viewTheme, viewFindHadith } from './views-hadith.js';
import { viewDuas, viewDuaCategory } from './views-duas.js';
import { viewFavorites } from './views-favorites.js';
import { viewAbout } from './views-about.js';
import { viewPrayer } from './views-prayer.js';
import { startScheduler, notifGranted } from './notify.js';

export const $view = document.getElementById('view');

// ---------- petits utilitaires DOM ----------
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
  try { await navigator.clipboard.writeText(txt); toast('Copié ✓'); }
  catch { toast('Copie impossible'); }
}

export async function shareText(title, text) {
  if (navigator.share) {
    try { await navigator.share({ title, text }); } catch {}
  } else copyText(text);
}

// ---------- lecteur audio ----------
export const player = {
  audio: new Audio(),
  queue: [],      // [{gid, s, v, label}]
  pos: 0,
  urlIdx: 0,
  playing: false,
  onchange: null, // callback vue lecteur

  start(queue, pos = 0) {
    this.queue = queue;
    this.pos = pos;
    this.load();
  },
  load() {
    const item = this.queue[this.pos];
    if (!item) return this.stop();
    this.urlIdx = 0;
    const urls = data.audioUrls(state.settings.reciter, item.gid);
    this._urls = urls;
    this.audio.src = urls[0];
    this.audio.play().then(() => { this.playing = true; this.render(); this.onchange?.(item); })
      .catch(() => { this.playing = false; this.render(); });
  },
  toggle() {
    if (this.audio.paused) { this.audio.play(); this.playing = true; }
    else { this.audio.pause(); this.playing = false; }
    this.render();
  },
  next() { if (this.pos < this.queue.length - 1) { this.pos++; this.load(); } else this.stop(); },
  prev() { if (this.pos > 0) { this.pos--; this.load(); } },
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
      <button data-a="prev" aria-label="Précédent">⏮</button>
      <button data-a="toggle" aria-label="Lecture / pause">${this.playing ? '⏸' : '▶️'}</button>
      <div class="pinfo"><b>${esc(item.label)}</b>${esc(rec?.name || '')}</div>
      <button data-a="stop" aria-label="Fermer">✕</button>`;
    el.querySelectorAll('button').forEach(b => b.onclick = () => this[b.dataset.a]());
  },
};
player.audio.addEventListener('ended', () => player.next());
player.audio.addEventListener('error', () => {
  // essaie le débit suivant, sinon passe au verset suivant
  if (player._urls && player.urlIdx < player._urls.length - 1) {
    player.urlIdx++;
    player.audio.src = player._urls[player.urlIdx];
    player.audio.play().catch(() => {});
  } else if (player.queue.length) {
    toast('Audio indisponible (connexion ?)');
    player.stop();
  }
});

// ---------- routeur ----------
const routes = [
  [/^#?\/?$/, () => viewHome()],
  [/^#\/home$/, () => viewHome()],
  [/^#\/quran$/, () => viewQuranList()],
  [/^#\/quran\/s\/(\d+)(?:\?v=(\d+))?$/, (m) => viewSurah(+m[1], m[2] ? +m[2] : null)],
  [/^#\/search(?:\?q=(.*))?$/, (m) => viewSearch(m[1] ? decodeURIComponent(m[1]) : '')],
  [/^#\/hadith$/, () => viewHadithHome()],
  [/^#\/hadith\/theme\/([\w-]+)$/, (m) => viewTheme(m[1])],
  [/^#\/hadith\/([\w-]+)\/find\/(\d+)$/, (m) => viewFindHadith(m[1], +m[2])],
  [/^#\/prayer$/, () => viewPrayer()],
  [/^#\/hadith\/([\w-]+)\/(\d+)(?:\?.*)?$/, (m) => viewChapter(m[1], +m[2])],
  [/^#\/hadith\/([\w-]+)$/, (m) => viewCollection(m[1])],
  [/^#\/duas$/, () => viewDuas()],
  [/^#\/duas\/([\w-]+)(?:\?.*)?$/, (m) => viewDuaCategory(m[1])],
  [/^#\/favorites$/, () => viewFavorites()],
  [/^#\/about$/, () => viewAbout()],
];

async function route() {
  const h = location.hash || '#/home';
  for (const [re, fn] of routes) {
    const m = h.match(re);
    if (m) {
      updateTabs(h);
      try { await fn(m); }
      catch (err) {
        console.error(err);
        $view.innerHTML = `<div class="empty"><span class="em">⚠️</span>Impossible de charger ce contenu.<br><small>${esc(err.message)}</small><br><br><button class="btn" onclick="location.reload()">Réessayer</button></div>`;
      }
      window.scrollTo({ top: 0 });
      return;
    }
  }
  location.hash = '#/home';
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

// ---------- réglages (feuille partagée) ----------
export function openSettings() {
  const s = state.settings;
  sheet(`
    <h3>Réglages</h3>
    <div class="setrow">
      <div class="lab">Thème</div>
      <div class="seg" id="segTheme">
        <button data-v="auto">Auto</button><button data-v="light">Clair</button><button data-v="dark">Sombre</button>
      </div>
    </div>
    <div class="setrow">
      <div class="lab">Taille du texte arabe<small>Aperçu : <span class="ar" style="font-size:1.2em">بِسْمِ اللَّهِ</span></small></div>
      <div class="seg" id="segSize">
        <button data-v="1.5">A</button><button data-v="1.9" style="font-size:1rem">A</button><button data-v="2.4" style="font-size:1.15rem">A</button>
      </div>
    </div>
    ${['showAr:Texte arabe', 'showFr:Traduction française', 'showTl:Translittération phonétique'].map(x => {
      const [k, lab] = x.split(':');
      return `<div class="setrow"><div class="lab">${lab}</div>
        <label class="switch"><input type="checkbox" data-k="${k}" ${s[k] ? 'checked' : ''}><span class="tr"></span></label></div>`;
    }).join('')}
    <div class="setrow">
      <div class="lab">Récitateur<small>Audio en ligne (nécessite une connexion)</small></div>
      <select id="selReciter" style="font:inherit;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--bg-soft);color:var(--ink);max-width:170px">
        ${data.RECITERS.map(r => `<option value="${r.id}" ${r.id === s.reciter ? 'selected' : ''}>${r.name}</option>`).join('')}
      </select>
    </div>
    <div class="setrow">
      <div class="lab">Hors-ligne<small>Télécharger tout le Coran pour un accès sans connexion</small></div>
      <button class="btn btn-ghost" id="btnOffline">Télécharger</button>
    </div>
    <div class="setrow"><div class="lab">Horaires de prière & notifications</div><a class="backlink" href="#/prayer" onclick="document.getElementById('sheet-root').innerHTML=''">Ouvrir →</a></div>
    <div class="setrow"><div class="lab">Sources & à propos</div><a class="backlink" href="#/about" onclick="document.getElementById('sheet-root').innerHTML=''">Voir →</a></div>
  `, (el) => {
    const segT = el.querySelector('#segTheme');
    const setSeg = (seg, v) => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
    setSeg(segT, s.theme);
    segT.onclick = e => {
      const v = e.target.dataset?.v; if (!v) return;
      s.theme = v; save(); applyTheme(); setSeg(segT, v);
    };
    const segS = el.querySelector('#segSize');
    setSeg(segS, s.arSize);
    segS.onclick = e => {
      const v = e.target.dataset?.v; if (!v) return;
      s.arSize = parseFloat(v); save(); applyArSize(); setSeg(segS, s.arSize);
    };
    el.querySelectorAll('input[data-k]').forEach(i => i.onchange = () => {
      s[i.dataset.k] = i.checked; save();
      if (location.hash.includes('/quran/s/')) route();
    });
    el.querySelector('#selReciter').onchange = e => { s.reciter = e.target.value; save(); };
    el.querySelector('#btnOffline').onclick = async (e) => {
      const btn = e.target;
      btn.textContent = '0 %'; btn.disabled = true;
      try {
        const urls = ['data/quran/search-fr.json', 'data/quran/search-ar.json', 'data/quran/phonetic.json'];
        for (let i = 1; i <= 114; i++) urls.push(`data/quran/s/${i}.json`);
        let done = 0;
        // par lots de 10
        for (let i = 0; i < urls.length; i += 10) {
          await Promise.all(urls.slice(i, i + 10).map(u => fetch(u)));
          done = Math.min(urls.length, i + 10);
          btn.textContent = Math.round(done / urls.length * 100) + ' %';
        }
        btn.textContent = 'Téléchargé ✓';
        toast('Coran disponible hors-ligne ✓');
      } catch {
        btn.textContent = 'Réessayer';
        btn.disabled = false;
        toast('Échec — vérifiez la connexion');
      }
    };
  });
}

// ---------- entête commun ----------
export function topbar(title) {
  return `<div class="row" style="justify-content:space-between;margin:2px 0 4px">
    <h1 style="margin:8px 0">${esc(title)}</h1>
    <div class="row" style="gap:2px">
      <button class="btn-icon" aria-label="Favoris" onclick="location.hash='#/favorites'">⭐</button>
      <button class="btn-icon" aria-label="Réglages" id="btnSettings">⚙️</button>
    </div>
  </div>`;
}
export function bindTopbar() {
  document.getElementById('btnSettings')?.addEventListener('click', openSettings);
}

// ---------- bannière d'installation iOS ----------
function iosInstallHint() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!isIOS || standalone || localStorage.getItem('nour:ioshint')) return;
  const div = document.createElement('div');
  div.className = 'iosbanner';
  div.innerHTML = `<span class="em">📲</span><div><b>Installer Nour</b><br>
    Touchez <b>Partager</b> puis « <b>Sur l'écran d'accueil</b> » pour utiliser Nour comme une application.</div>
    <button class="btn-icon" aria-label="Fermer">✕</button>`;
  div.querySelector('button').onclick = () => { div.remove(); localStorage.setItem('nour:ioshint', '1'); };
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 15000);
}

// ---------- démarrage ----------
applyTheme();
applyArSize();
window.addEventListener('hashchange', route);
route();
iosInstallHint();
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
if (notifGranted()) startScheduler();
