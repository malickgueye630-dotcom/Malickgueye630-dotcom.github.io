// Hadiths : sélection française par thèmes (avec filtres) + les six recueils
// complets. Présentation 100 % francophone : titres de chapitres traduits,
// arabe + phonétique française en premier ; la traduction anglaise (Sunnah.com)
// n'apparaît qu'en secondaire, repliée et clairement étiquetée.
import { $view, esc, toast, topbar, bindTopbar, copyText, shareText } from './app.js';
import { icon, iconFilled } from './icons.js';
import { state, toggleFav, isFav } from './state.js';
import * as data from './data.js';
import { fold } from './search.js';
import { arToLatin } from './translit.js';

let CH_FR = null;
async function chaptersFr() {
  if (!CH_FR) CH_FR = await fetch('data/hadith/chapters_fr.json').then(r => r.json());
  return CH_FR;
}
const chFr = (en) => (CH_FR && CH_FR[en]) || en;

const tlLine = ar => state.settings.showTl
  ? `<div class="tl" style="color:var(--ink-2);font-style:italic;margin:4px 0">${esc(arToLatin(ar))}</div>` : '';

const gradeClass = g => {
  const t = (g || '').toLowerCase();
  if (t.startsWith('sahih')) return 'sahih';
  if (t.startsWith('hasan')) return 'hasan';
  if (t.startsWith('da')) return 'daif';
  return '';
};

// ---------------- carte hadith (sélection FR) ----------------
export function hadithFrCard(h, themes) {
  return `<div class="card hcard" id="hfr${h.id}">
    <div class="row" style="justify-content:space-between;margin-bottom:6px">
      <span class="badge">${esc(h.source.split(';')[0].trim())}</span>
      <span class="badge ${gradeClass(h.grade)}">Authenticité : ${esc(h.grade)}</span>
    </div>
    ${state.settings.showAr ? `<div class="ar">${esc(h.ar)}</div>` : ''}
    ${tlLine(h.ar)}
    <p class="fr">${esc(h.fr)}</p>
    <div class="src">
      <span class="s">${esc(h.source)}${h.narrator ? ' — rapporté par ' + esc(h.narrator) : ''}</span>
    </div>
    <div class="row" style="margin-top:8px;justify-content:space-between">
      <div class="chiprow" style="padding:0">${h.themes.map(t => `<a class="chip" href="#/hadith/theme/${t}" style="font-size:.72rem;padding:4px 10px">${esc(themes[t] || t)}</a>`).join('')}</div>
      <div class="row" style="gap:0">
        <button class="btn-icon ${isFav('hadithsFr', h.id) ? 'on' : ''}" data-fav="${h.id}">${isFav('hadithsFr', h.id) ? iconFilled('star', 18) : icon('star', 18)}</button>
        <button class="btn-icon" data-copy="${h.id}">${icon('copy', 17)}</button>
        <button class="btn-icon" data-share="${h.id}">${icon('share', 17)}</button>
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
      fav.classList.toggle('on', on);
      fav.innerHTML = on ? iconFilled('star', 18) : icon('star', 18);
      toast(on ? 'Ajouté aux favoris' : 'Retiré des favoris');
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
  await chaptersFr();
  $view.innerHTML = `
    ${topbar('Hadiths')}
    <div class="search-input">
      <span>${icon('search', 18)}</span>
      <input id="hSearch" type="search" placeholder="Chercher dans la sélection française…" autocomplete="off">
    </div>
    <div id="hResults"></div>
    <h2>Par thème — traduits en français</h2>
    <div class="catgrid">
      ${Object.entries(hfr.themes).map(([id, name]) => {
        const count = hfr.hadiths.filter(h => h.themes.includes(id)).length;
        const p = count > 1 ? 's' : '';
        return `<a class="catcard" href="#/hadith/theme/${id}"><b>${esc(name)}</b><small>${count} hadith${p} traduit${p}</small></a>`;
      }).join('')}
    </div>

    <h2 style="margin-top:26px">Les grands recueils</h2>
    <p class="muted" style="margin:0 2px 10px">Texte intégral en arabe avec phonétique française.
    Une traduction française complète et libre de ces recueils n'existe pas encore : pour chaque hadith,
    la traduction anglaise (Sunnah.com) reste consultable en secondaire, clairement signalée.</p>
    ${cat.map(c => `
      <a class="list-item" href="#/hadith/${c.key}">
        <div class="num">${icon('library', 19)}</div>
        <div class="t"><b>${esc(c.name)}</b>
          <small>${c.total.toLocaleString('fr-FR')} hadiths · ${c.chapters.length} livres
          ${c.grade === 'sahih' ? ' · recueil entièrement authentique (sahih)' : ''}</small></div>
        <div class="arname">${esc(c.nameAr)}</div>
      </a>`).join('')}
    <div class="notice">Sahih al-Bukhari et Sahih Muslim ne contiennent que des hadiths authentiques.
      Pour les quatre Sunan, le degré varie selon le hadith ; cette base n'inclut pas le jugement
      hadith par hadith. La sélection française indique, elle, toujours le degré et la référence.</div>
  `;
  bindTopbar();

  // recherche rapide dans la sélection FR
  const res = document.getElementById('hResults');
  document.getElementById('hSearch').oninput = e => {
    const q = fold(e.target.value);
    if (!q || q.length < 2) { res.innerHTML = ''; return; }
    const found = hfr.hadiths.filter(h => fold(h.fr + ' ' + (h.narrator || '')).includes(q)).slice(0, 10);
    res.innerHTML = found.length ? found.map(h => hadithFrCard(h, hfr.themes)).join('') : `<div class="empty">Aucun hadith de la sélection française ne correspond.</div>`;
  };
  bindFrCards(res, hfr.hadiths);
}

// ---------------- vue thème (avec filtres) ----------------
export async function viewTheme(themeId) {
  const hfr = await data.hadithsFr();
  const name = hfr.themes[themeId] || themeId;
  const all = hfr.hadiths.filter(h => h.themes.includes(themeId));
  const grades = [...new Set(all.map(h => h.grade.split(' ')[0]))];
  const collections = [...new Set(all.map(h => h.collection))];
  const narrators = [...new Set(all.map(h => h.narrator).filter(Boolean))];
  const colNames = { bukhari: 'Bukhari', muslim: 'Muslim', abudawud: 'Abu Dawud', tirmidhi: 'Tirmidhi', nasai: "Nasa'i", ibnmajah: 'Ibn Majah' };

  const filters = { grade: null, col: null, narr: null };
  $view.innerHTML = `
    <a class="backlink" href="#/hadith">${icon('chevL', 15)} Hadiths</a>
    <h1>${esc(name)}</h1>
    <p class="muted">${all.length} hadith${all.length > 1 ? 's' : ''} authentiques, traduits en français.</p>
    <div class="chiprow" id="fGrade">${grades.length > 1 ? grades.map(g => `<button class="chip" data-g="${esc(g)}">${esc(g)}</button>`).join('') : ''}</div>
    <div class="chiprow" id="fCol">${collections.length > 1 ? collections.map(c => `<button class="chip" data-c="${esc(c)}">${esc(colNames[c] || c)}</button>`).join('') : ''}</div>
    <div class="chiprow" id="fNarr">${narrators.length > 1 ? narrators.slice(0, 8).map(nr => `<button class="chip" data-n="${esc(nr)}">${esc(nr)}</button>`).join('') : ''}</div>
    <div id="themeList"></div>
  `;
  const listEl = document.getElementById('themeList');
  const draw = () => {
    const filtered = all.filter(h =>
      (!filters.grade || h.grade.startsWith(filters.grade)) &&
      (!filters.col || h.collection === filters.col) &&
      (!filters.narr || h.narrator === filters.narr));
    listEl.innerHTML = filtered.length ? filtered.map(h => hadithFrCard(h, hfr.themes)).join('')
      : `<div class="empty">Aucun hadith avec ces filtres.</div>`;
  };
  const bindFilter = (id, key, attr) => {
    const el = document.getElementById(id);
    el?.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const val = b.dataset[attr];
      filters[key] = filters[key] === val ? null : val;
      el.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', filters[key] && c === b));
      draw();
    });
  };
  bindFilter('fGrade', 'grade', 'g');
  bindFilter('fCol', 'col', 'c');
  bindFilter('fNarr', 'narr', 'n');
  draw();
  bindFrCards(listEl, all);
}

// ---------------- résolveur ----------------
export async function viewFindHadith(key, refId) {
  const cat = await data.hadithIndex();
  const col = cat.find(c => c.key === key);
  const ch = col?.chapters.find(c => c.first <= refId && refId <= c.last);
  if (ch) location.replace(`#/hadith/${key}/${ch.id}?h=${refId}`);
  else location.replace(`#/hadith/${key}`);
}

// ---------------- vue recueil ----------------
export async function viewCollection(key) {
  const [cat] = await Promise.all([data.hadithIndex(), chaptersFr()]);
  const col = cat.find(c => c.key === key);
  if (!col) { location.hash = '#/hadith'; return; }
  $view.innerHTML = `
    <a class="backlink" href="#/hadith">${icon('chevL', 15)} Hadiths</a>
    <div class="surah-head">
      <div class="arname">${esc(col.nameAr)}</div>
      <div class="frname">${esc(col.name)}</div>
      <div class="meta">${col.total.toLocaleString('fr-FR')} hadiths — ${col.chapters.length} livres</div>
    </div>
    <div class="search-input">
      <span>${icon('search', 18)}</span>
      <input id="chFilter" type="search" placeholder="Filtrer les livres, ou n° de hadith (ex : 1234)" autocomplete="off">
      <button class="btn" id="chGo" style="display:none">Ouvrir</button>
    </div>
    <div id="chList"></div>
  `;
  const listEl = document.getElementById('chList');
  const row = ch => `
    <a class="list-item" href="#/hadith/${key}/${ch.id}">
      <div class="num">${ch.id}</div>
      <div class="t"><b>${esc(chFr(ch.en))}</b><small>Hadiths n° ${ch.first} à ${ch.last}</small></div>
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
    const filtered = f ? col.chapters.filter(c => fold(chFr(c.en)).includes(f) || c.ar.includes(q)) : col.chapters;
    listEl.innerHTML = filtered.length ? filtered.map(row).join('') : `<div class="empty">Aucun livre trouvé.</div>`;
  };
}

// ---------------- vue chapitre ----------------
export async function viewChapter(key, chId) {
  let target = null;
  const mHash = location.hash.match(/\?h=(\d+)/);
  if (mHash) target = +mHash[1];

  const [cat, items] = await Promise.all([data.hadithIndex(), data.hadithChapter(key, chId), chaptersFr()]);
  const col = cat.find(c => c.key === key);
  const ch = col.chapters.find(c => c.id === chId);

  const PAGE = 20;
  let shown = 0;

  $view.innerHTML = `
    <a class="backlink" href="#/hadith/${key}">${icon('chevL', 15)} ${esc(col.name)}</a>
    <h1 style="font-size:1.15rem">${esc(chFr(ch.en))}</h1>
    <div class="row"><div class="arname" style="font-size:1.15rem">${esc(ch.ar)}</div></div>
    <p class="muted">${items.length} hadiths — n° ${ch.first} à ${ch.last}</p>
    <div class="notice">Traduction française complète non disponible pour ce recueil dans une source libre :
      l'arabe fait foi, la phonétique aide à la lecture, et la traduction anglaise (Sunnah.com)
      est consultable ci-dessous dans chaque hadith.</div>
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
          <button class="btn-icon ${isFav('hadiths', `${key}:${id}`) ? 'on' : ''}" data-fav="${id}">${isFav('hadiths', `${key}:${id}`) ? iconFilled('star', 18) : icon('star', 18)}</button>
          <button class="btn-icon" data-copy="${id}">${icon('copy', 17)}</button>
        </div>
      </div>
      ${state.settings.showAr ? `<div class="ar">${esc(ar)}</div>` : ''}
      ${tlLine(ar)}
      ${narrator || text ? `<details class="en-tr">
        <summary>Afficher la traduction anglaise (source : Sunnah.com)</summary>
        <p>${narrator ? `<b>${esc(narrator)}</b> ` : ''}${esc(text)}</p>
      </details>` : `<p class="tiny">Traduction non disponible pour ce hadith.</p>`}
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
      fav.classList.toggle('on', on);
      fav.innerHTML = on ? iconFilled('star', 18) : icon('star', 18);
      toast(on ? 'Ajouté aux favoris' : 'Retiré des favoris');
    } else if (cp) {
      const it = items.find(x => x[0] === +cp.dataset.copy);
      copyText(`${it[1]}\n\n(${col.name}, n° ${it[0]} de la base)`);
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
