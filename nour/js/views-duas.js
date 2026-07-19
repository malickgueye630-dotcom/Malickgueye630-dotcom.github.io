// Invocations (du'â) par situation, avec arabe, phonétique, français et source.
import { $view, esc, toast, topbar, bindTopbar, copyText, shareText } from './app.js';
import { state, toggleFav, isFav } from './state.js';
import { icon, iconFilled } from './icons.js';
import * as data from './data.js';
import { fold } from './search.js';

const gradeClass = g => {
  const t = (g || '').toLowerCase();
  if (t.startsWith('sahih') || t.startsWith('verset')) return 'sahih';
  if (t.startsWith('hasan')) return 'hasan';
  return '';
};

export function duaCard(d) {
  const cfg = state.settings;
  return `<div class="card hcard" id="dua-${esc(d.id)}">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div class="dua-title">${esc(d.title)}${d.repeat ? `<span class="repeat-pill">× ${d.repeat}</span>` : ''}</div>
      <div class="row" style="gap:0">
        <button class="btn-icon ${isFav('duas', d.id) ? 'on' : ''}" data-fav="${esc(d.id)}">${isFav('duas', d.id) ? iconFilled('star', 18) : icon('star', 18)}</button>
        <button class="btn-icon" data-copy="${esc(d.id)}">${icon('copy', 17)}</button>
        <button class="btn-icon" data-share="${esc(d.id)}">${icon('share', 17)}</button>
      </div>
    </div>
    <div class="ar">${esc(d.ar)}</div>
    ${cfg.showTl !== false ? `<p class="tl" style="color:var(--ink-2);font-style:italic;font-size:.87rem;margin:6px 0">${esc(d.translit)}</p>` : ''}
    <p class="fr" style="margin:6px 0">${esc(d.fr)}</p>
    ${d.note ? `<p class="tiny" style="margin:6px 0">💡 ${esc(d.note)}</p>` : ''}
    <div class="src">
      ${d.grade ? `<span class="badge ${gradeClass(d.grade)}">${esc(d.grade)}</span>` : ''}
      <span class="s">${esc(d.source)}</span>
    </div>
  </div>`;
}

export function bindDuaCards(container, all) {
  container.addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]');
    const cp = e.target.closest('[data-copy]');
    const sh = e.target.closest('[data-share]');
    if (fav) {
      const on = toggleFav('duas', fav.dataset.fav);
      fav.classList.toggle('on', on); fav.innerHTML = on ? iconFilled('star', 18) : icon('star', 18);
      toast(on ? 'Ajouté aux favoris ★' : 'Retiré des favoris');
    } else if (cp || sh) {
      const d = all.find(x => x.id === (cp || sh).dataset[cp ? 'copy' : 'share']);
      const txt = `${d.title}\n\n${d.ar}\n\n${d.translit}\n\n« ${d.fr} »\n(${d.source})`;
      cp ? copyText(txt) : shareText(d.title, txt);
    }
  });
}

export async function viewDuas() {
  const db = await data.duas();
  const total = db.categories.reduce((n, c) => n + c.duas.length, 0);
  $view.innerHTML = `
    ${topbar('Invocations')}
    <div class="search-input">
      <span>🔍</span>
      <input id="dFilter" type="search" placeholder="Chercher une invocation (« dormir », « voyage »…)" autocomplete="off">
    </div>
    <p class="muted" style="margin:2px 2px 10px">${total} invocations authentiques du Coran et de la Sunna, classées par situation, avec leurs sources.</p>
    <div class="catgrid" id="dCats">
      ${db.categories.map(c => `
        <a class="catcard" href="#/duas/${c.id}">
          <span class="em">${c.icon}</span>
          <b>${esc(c.name)}</b>
          <small>${c.duas.length} invocation${c.duas.length > 1 ? 's' : ''}</small>
        </a>`).join('')}
    </div>
    <div id="dResults"></div>
  `;
  bindTopbar();

  const allDuas = db.categories.flatMap(c => c.duas.map(d => ({ ...d, catName: c.name })));
  const resEl = document.getElementById('dResults');
  const catsEl = document.getElementById('dCats');
  document.getElementById('dFilter').oninput = e => {
    const q = fold(e.target.value);
    if (!q) { catsEl.style.display = ''; resEl.innerHTML = ''; return; }
    catsEl.style.display = 'none';
    const found = allDuas.filter(d => fold(`${d.title} ${d.fr} ${d.translit} ${d.catName}`).includes(q));
    resEl.innerHTML = found.length ? found.map(duaCard).join('')
      : `<div class="empty"><span class="em">🕊️</span>Aucune invocation trouvée pour « ${esc(e.target.value)} »</div>`;
  };
  bindDuaCards(resEl, allDuas);
}

export async function viewDuaCategory(catId) {
  const db = await data.duas();
  const cat = db.categories.find(c => c.id === catId);
  if (!cat) { location.hash = '#/duas'; return; }
  const mHash = location.hash.match(/\?d=([\w-]+)/);
  $view.innerHTML = `
    <a class="backlink" href="#/duas">← Invocations</a>
    <h1>${cat.icon} ${esc(cat.name)}</h1>
    <div id="dList">${cat.duas.map(duaCard).join('')}</div>
    <div class="notice">${esc(db.note)}</div>
  `;
  bindDuaCards(document.getElementById('dList'), cat.duas);
  if (mHash) {
    requestAnimationFrame(() => {
      const el = document.getElementById('dua-' + mHash[1]);
      if (el) { el.scrollIntoView({ block: 'start' }); el.style.outline = '2px solid var(--gold)'; setTimeout(() => el.style.outline = '', 2500); }
    });
  }
}
