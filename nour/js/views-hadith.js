// Hadiths : sélection thématique FR + les six recueils complets (AR/EN).
import { $view, esc, toast, topbar, bindTopbar, copyText, shareText } from './app.js';
import { state, toggleFav, isFav } from './state.js';
import * as data from './data.js';
import { fold } from './search.js';
import { arToLatin } from './translit.js';

const tlLine = ar => state.settings.showTl
  ? `<div class="tl" style="color:var(--ink-2);font-style:italic;font-size:.85rem;margin:4px 0">${esc(arToLatin(ar))}</div>` : '';

const gradeClass = g => {
  const t = (g || '').toLowerCase();
  if (t.startsWith('sahih')) return 'sahih';
  if (t.startsWith('hasan')) return 'hasan';
  if (t.startsWith('da')) return 'daif';
  return '';
};

export function hadithFrCard(h, themes, q = '') {
  return `<div class="card hcard" id="hfr${h.id}">
    <div class="ar">${esc(h.ar)}</div>
    ${tlLine(h.ar)}
    <p class="fr">${esc(h.fr)}</p>
    <div class="src">
      <span class="badge ${gradeClass(h.grade)}">${esc(h.grade)}</span>
      <span class="s">${esc(h.source)}${h.narrator ? ' — rapporté par ' + esc(h.narrator) : ''}</span>
    </div>
    <div class="row" style="margin-top:8px;justify-content:space-between">
      <div class="chiprow" style="padding:0">${h.themes.map(t => `<a class="chip" href="#/hadith/theme/${t}" style="font-size:.72rem;padding:4px 10px">${esc(themes[t] || t)}</a>`).join('')}</div>
      <div class="row" style="gap:0">
        <button class="btn-icon ${isFav('hadithsFr', h.id) ? 'on' : ''}" data-fav="${h.id}">${isFav('hadithsFr', h.id) ? '★' : '☆'}</button>
        <button class="btn-icon" data-copy="${h.id}">📋</button>
        <button class="btn-icon" data-share="${h.id}">📤</button>
      </div>
    </div>
  </div>`;
}

export function bindFrCards(container, hadiths) {
  container.addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]');
    const cp = e.target.closest('[data-copy]');
    const sh = e.target.closest('[data-share]');
    if (fav) {
      const on = toggleFav('hadithsFr', +fav.dataset.fav);
      fav.classList.toggle('on', on); fav.textContent = on ? '★' : '☆';
      toast(on ? 'Ajouté aux favoris ★' : 'Retiré des favoris');
    } else if (cp || sh) {
      const h = hadiths.find(x => x.id === +(cp || sh).dataset[cp ? 'copy' : 'share']);
      const txt = `${h.ar}\n\n« ${h.fr} »\n(${h.source} — ${h.grade})`;
      cp ? copyText(txt) : shareText('Hadith', txt);
    }
  });
}

// ---------------- accueil hadiths ----------------
export async function viewHadithHome() {
  const [cat, hfr] = await Promise.all([data.hadithIndex(), data.hadithsFr()]);
  $view.innerHTML = `
    ${topbar('Hadiths')}
    <h2>Par thème (en français)</h2>
    <div class="catgrid">
      ${Object.entries(hfr.themes).map(([id, name]) => {
        const count = hfr.hadiths.filter(h => h.themes.includes(id)).length;
        const s = count > 1 ? 's' : '';
        return `<a class="catcard" href="#/hadith/theme/${id}"><b>${esc(name)}</b><small>${count} hadith${s} traduit${s}</small></a>`;
      }).join('')}
    </div>

    <h2 style="margin-top:26px">Les grands recueils</h2>
    <p class="muted" style="margin:0 2px 10px">Texte intégral en arabe avec traduction anglaise. Chaque hadith est numéroté dans sa base et cité avec son recueil.</p>
    ${cat.map(c => `
      <a class="list-item" href="#/hadith/${c.key}">
        <div class="num">📚</div>
        <div class="t"><b>${esc(c.name)}</b>
          <small>${c.total.toLocaleString('fr-FR')} hadiths · ${c.chapters.length} livres
          ${c.grade === 'sahih' ? ' · recueil entièrement authentique (sahih)' : ''}</small></div>
        <div class="arname">${esc(c.nameAr)}</div>
      </a>`).join('')}
    <div class="notice">Sahih al-Bukhari et Sahih Muslim ne contiennent que des hadiths authentiques.
      Pour les quatre Sunan (Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah), le degré d'authenticité varie selon le hadith ;
      cette base n'inclut pas le jugement hadith par hadith. La sélection thématique en français indique, elle,
      toujours le degré (Sahih / Hasan) et la référence.</div>
  `;
  bindTopbar();
}

// ---------------- vue thème ----------------
export async function viewTheme(themeId) {
  const hfr = await data.hadithsFr();
  const name = hfr.themes[themeId] || themeId;
  const list = hfr.hadiths.filter(h => h.themes.includes(themeId));
  $view.innerHTML = `
    <a class="backlink" href="#/hadith">← Hadiths</a>
    <h1>${esc(name)}</h1>
    <p class="muted">${list.length} hadith${list.length > 1 ? 's' : ''} authentiques, traduits en français.</p>
    <div id="themeList">${list.map(h => hadithFrCard(h, hfr.themes)).join('')}</div>
  `;
  bindFrCards(document.getElementById('themeList'), list);
}

// ---------------- vue recueil ----------------
export async function viewCollection(key) {
  const cat = await data.hadithIndex();
  const col = cat.find(c => c.key === key);
  if (!col) { location.hash = '#/hadith'; return; }
  $view.innerHTML = `
    <a class="backlink" href="#/hadith">← Hadiths</a>
    <div class="surah-head">
      <div class="arname">${esc(col.nameAr)}</div>
      <div class="frname">${esc(col.name)}</div>
      <div class="meta">${col.total.toLocaleString('fr-FR')} hadiths — ${col.chapters.length} livres</div>
    </div>
    <div class="search-input">
      <span>🔍</span>
      <input id="chFilter" type="search" placeholder="Filtrer les livres, ou n° de hadith (ex : 1234)" autocomplete="off">
      <button class="btn" id="chGo" style="display:none">Ouvrir</button>
    </div>
    <div id="chList"></div>
  `;
  const listEl = document.getElementById('chList');
  const row = ch => `
    <a class="list-item" href="#/hadith/${key}/${ch.id}">
      <div class="num">${ch.id}</div>
      <div class="t"><b>${esc(ch.en)}</b><small>Hadiths n° ${ch.first} à ${ch.last}</small></div>
      <div class="arname" style="font-size:1rem">${esc(ch.ar)}</div>
    </a>`;
  listEl.innerHTML = col.chapters.map(row).join('');

  const inp = document.getElementById('chFilter');
  const go = document.getElementById('chGo');
  inp.oninput = () => {
    const q = inp.value.trim();
    if (/^\d+$/.test(q)) {
      const num = +q;
      const ch = col.chapters.find(c => c.first <= num && num <= c.last);
      go.style.display = ch ? '' : 'none';
      go.onclick = () => { location.hash = `#/hadith/${key}/${ch.id}?h=${num}`; };
      listEl.innerHTML = ch ? row(ch) : `<div class="empty">Numéro hors de la base (1 – ${col.total}).</div>`;
      return;
    }
    go.style.display = 'none';
    const f = fold(q);
    const filtered = f ? col.chapters.filter(c => fold(c.en).includes(f) || c.ar.includes(q)) : col.chapters;
    listEl.innerHTML = filtered.length ? filtered.map(row).join('') : `<div class="empty">Aucun livre trouvé.</div>`;
  };
}

// ---------------- résolveur : ouvre un hadith par son numéro de base ----------------
export async function viewFindHadith(key, refId) {
  const cat = await data.hadithIndex();
  const col = cat.find(c => c.key === key);
  const ch = col?.chapters.find(c => c.first <= refId && refId <= c.last);
  if (ch) location.replace(`#/hadith/${key}/${ch.id}?h=${refId}`);
  else location.replace(`#/hadith/${key}`);
}

// ---------------- vue chapitre ----------------
export async function viewChapter(key, chId) {
  // supporte #/hadith/col/12?h=345
  let target = null;
  const mHash = location.hash.match(/\?h=(\d+)/);
  if (mHash) target = +mHash[1];

  const [cat, items] = await Promise.all([data.hadithIndex(), data.hadithChapter(key, chId)]);
  const col = cat.find(c => c.key === key);
  const ch = col.chapters.find(c => c.id === chId);

  const PAGE = 25;
  let shown = 0;

  $view.innerHTML = `
    <a class="backlink" href="#/hadith/${key}">← ${esc(col.name)}</a>
    <h1 style="font-size:1.15rem">${esc(ch.en)}</h1>
    <div class="row"><div class="arname" style="font-size:1.15rem">${esc(ch.ar)}</div></div>
    <p class="muted">${items.length} hadiths — n° ${ch.first} à ${ch.last}</p>
    <div id="hList"></div>
    <button class="btn btn-ghost" id="more" style="width:100%">Afficher plus</button>
  `;
  const listEl = document.getElementById('hList');
  const more = document.getElementById('more');

  const card = ([id, ar, narrator, text]) => `
    <div class="card hcard" id="h${id}">
      <div class="row" style="justify-content:space-between">
        <span class="badge">${esc(col.name)} · n° ${id}</span>
        <div class="row" style="gap:0">
          <button class="btn-icon ${isFav('hadiths', `${key}:${id}`) ? 'on' : ''}" data-fav="${id}">${isFav('hadiths', `${key}:${id}`) ? '★' : '☆'}</button>
          <button class="btn-icon" data-copy="${id}">📋</button>
        </div>
      </div>
      <div class="ar">${esc(ar)}</div>
      ${tlLine(ar)}
      ${narrator || text ? `<p class="en">${narrator ? `<b>${esc(narrator)}</b> ` : ''}${esc(text)}</p>` : ''}
    </div>`;

  function renderMore() {
    const slice = items.slice(shown, shown + PAGE);
    listEl.insertAdjacentHTML('beforeend', slice.map(card).join(''));
    shown += slice.length;
    more.style.display = shown >= items.length ? 'none' : '';
  }
  renderMore();
  more.onclick = renderMore;

  listEl.addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]');
    const cp = e.target.closest('[data-copy]');
    if (fav) {
      const id = `${key}:${fav.dataset.fav}`;
      const on = toggleFav('hadiths', id);
      fav.classList.toggle('on', on); fav.textContent = on ? '★' : '☆';
      toast(on ? 'Ajouté aux favoris ★' : 'Retiré des favoris');
    } else if (cp) {
      const it = items.find(x => x[0] === +cp.dataset.copy);
      copyText(`${it[1]}\n\n${[it[2], it[3]].filter(Boolean).join(' ')}\n(${col.name}, n° ${it[0]} de la base)`);
    }
  });

  if (target) {
    while (shown < items.length && !items.slice(0, shown).some(x => x[0] === target)) renderMore();
    requestAnimationFrame(() => {
      const el = document.getElementById('h' + target);
      if (el) { el.scrollIntoView({ block: 'start' }); el.style.outline = '2px solid var(--gold)'; setTimeout(() => el.style.outline = '', 2500); }
    });
  }
}
