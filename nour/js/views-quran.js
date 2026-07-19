// Coran : bibliothèque (sourates, juz, hizb, pages, marque-pages, récents,
// progression) et lecteur professionnel (arabe + phonétique française +
// traduction, audio complet, répétition, notes, favoris, marque-pages).
import { $view, esc, toast, topbar, bindTopbar, player, repeatVerse, sheet, closeSheet, copyText, shareText, openSettings } from './app.js';
import { icon, iconFilled } from './icons.js';
import { state, save, setLastRead, pushRecent, toggleFav, isFav, toggleBookmark, isBookmarked, setNote, getNote } from './state.js';
import * as data from './data.js';
import { fold } from './search.js';

// ---------------- bibliothèque ----------------
export async function viewQuranList() {
  const idx = await data.quranIndex();
  const s0 = state.settings;

  const surahRow = s => `
    <a class="list-item" href="#/quran/s/${s.n}">
      <div class="num">${s.n}</div>
      <div class="t"><b>${esc(s.phonetic)}</b>
        <small>${esc(s.fr)} · ${s.verses} versets · ${s.type === 'meccan' ? 'Mecquoise' : 'Médinoise'}</small></div>
      <div class="arname">${esc(s.name)}</div>
    </a>`;

  const last = state.lastRead;
  const lastMeta = last ? idx.surahs[last.s - 1] : null;
  const today = new Date().toISOString().slice(0, 10);
  const readToday = state.readLog[today] || 0;
  const goal = s0.dailyGoal || 10;
  const pct = Math.min(100, Math.round(readToday / goal * 100));

  $view.innerHTML = `
    ${topbar('Le Coran')}
    <div class="search-input">
      <span>${icon('search', 18)}</span>
      <input id="qFilter" type="search" placeholder="Sourate (nom ou numéro), ex : Kahf, 18…" autocomplete="off">
    </div>

    ${lastMeta ? `
    <a class="list-item" href="#/quran/s/${last.s}?v=${last.v}" style="background:var(--hero-grad);color:#f3efe2;border:none">
      <div class="num" style="background:rgba(255,255,255,.15);color:#fff">${icon('book', 20)}</div>
      <div class="t"><b style="color:#fff">Continuer ma lecture</b>
        <small style="color:rgba(255,255,255,.75)">${esc(lastMeta.phonetic)} — verset ${last.v}</small></div>
      ${icon('chevR', 18)}
    </a>` : ''}

    <div class="card" style="padding:12px 16px">
      <div class="row" style="justify-content:space-between">
        <b style="font-size:.9rem">Ma progression du jour</b>
        <span class="tiny">${readToday} / ${goal} versets <button class="btn-icon" id="btnGoal" style="padding:2px 6px">${icon('settings', 15)}</button></span>
      </div>
      <div class="pbar" style="height:6px;background:var(--bg-soft);border-radius:3px;margin-top:8px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:var(--brand);border-radius:3px"></div>
      </div>
    </div>

    ${state.recents.length ? `
    <div class="section-head"><h2>Récemment consultées</h2></div>
    <div class="chiprow">${state.recents.map(r => {
      const m = idx.surahs[r.s - 1];
      return `<a class="chip" href="#/quran/s/${r.s}">${r.s}. ${esc(m.phonetic)}</a>`;
    }).join('')}</div>` : ''}

    <div class="chiprow" id="modeChips" style="margin-top:6px">
      <button class="chip on" data-m="surah">Sourates</button>
      <button class="chip" data-m="juz">Juz'</button>
      <button class="chip" data-m="hizb">Hizb</button>
      <button class="chip" data-m="pages">Pages</button>
      <button class="chip" data-m="bookmarks">${icon('bookmark', 13)} Marque-pages</button>
      <button class="chip" data-m="favs">${icon('star', 13)} Favoris</button>
    </div>
    <div id="qList">${idx.surahs.map(surahRow).join('')}</div>
  `;
  bindTopbar();

  document.getElementById('btnGoal').onclick = () => {
    sheet(`<h3>Objectif quotidien de lecture</h3>
      <div class="seg" id="goalSeg" style="justify-content:center">
        ${[5, 10, 20, 50].map(g => `<button data-v="${g}" class="${goal === g ? 'on' : ''}">${g} versets</button>`).join('')}
      </div>`, el => {
      el.querySelector('#goalSeg').onclick = e => {
        const v = +e.target.dataset?.v;
        if (!v) return;
        state.settings.dailyGoal = v; save(); closeSheet(); viewQuranList();
      };
    });
  };

  const list = document.getElementById('qList');
  const chips = document.getElementById('modeChips');
  let mode = 'surah';

  const rangeRow = (label, gid, sub) => data.surahOfGlobal(gid).then(({ s, v }) => {
    const m = idx.surahs[s - 1];
    return `<a class="list-item" href="#/quran/s/${s}?v=${v}">
      <div class="num">${sub}</div>
      <div class="t"><b>${label}</b><small>Commence à ${esc(m.phonetic)} ${s}:${v}</small></div>
      <div class="arname">${esc(m.name)}</div></a>`;
  });

  async function renderMode() {
    if (mode === 'surah') list.innerHTML = idx.surahs.map(surahRow).join('');
    else if (mode === 'juz') {
      const rows = [];
      for (let j = 1; j <= 30; j++) rows.push(await rangeRow(`Juz' ${j}`, idx.juz[j], j));
      list.innerHTML = rows.join('');
    } else if (mode === 'hizb') {
      const rows = [];
      for (let h = 1; h <= 60; h++) rows.push(await rangeRow(`Hizb ${h}`, idx.hizbQuarters[(h - 1) * 4 + 1], h));
      list.innerHTML = rows.join('');
    } else if (mode === 'pages') {
      list.innerHTML = `<div class="search-input"><span>${icon('search', 16)}</span>
        <input id="pageJump" type="number" min="1" max="604" placeholder="Aller à la page (1 – 604)"></div>
        <div id="pageRows"></div>`;
      const rowsEl = list.querySelector('#pageRows');
      const drawPages = async (from = 1) => {
        const rows = [];
        for (let p = from; p <= Math.min(604, from + 29); p++) rows.push(await rangeRow(`Page ${p}`, idx.pages[p], p));
        rowsEl.innerHTML = rows.join('') + (from + 30 <= 604 ? `<button class="btn btn-ghost" id="morePages" style="width:100%">Pages suivantes</button>` : '');
        rowsEl.querySelector('#morePages')?.addEventListener('click', () => drawPages(from + 30));
      };
      drawPages(1);
      list.querySelector('#pageJump').onchange = async e => {
        const p = Math.max(1, Math.min(604, +e.target.value || 1));
        const { s, v } = await data.surahOfGlobal(idx.pages[p]);
        location.hash = `#/quran/s/${s}?v=${v}`;
      };
    } else if (mode === 'bookmarks') {
      list.innerHTML = state.bookmarks.length ? state.bookmarks.map(b => {
        const m = idx.surahs[b.s - 1];
        return `<a class="list-item" href="#/quran/s/${b.s}?v=${b.v}">
          <div class="num">${icon('bookmark', 17)}</div>
          <div class="t"><b>${esc(m.phonetic)} — verset ${b.v}</b>
            <small>${new Date(b.ts).toLocaleDateString('fr-FR')}</small></div>
          <div class="arname">${esc(m.name)}</div></a>`;
      }).join('') : `<div class="empty">${icon('bookmark', 30)}<br>Aucun marque-page.<br><small>Dans le lecteur, touchez l'icône marque-page d'un verset.</small></div>`;
    } else if (mode === 'favs') {
      list.innerHTML = state.favorites.verses.length ? state.favorites.verses.map(ref => {
        const [s, v] = ref.split(':').map(Number);
        const m = idx.surahs[s - 1];
        return `<a class="list-item" href="#/quran/s/${s}?v=${v}">
          <div class="num">${icon('star', 17)}</div>
          <div class="t"><b>${esc(m.phonetic)} — verset ${v}</b><small>${esc(m.fr)}</small></div>
          <div class="arname">${esc(m.name)}</div></a>`;
      }).join('') : `<div class="empty">${icon('star', 30)}<br>Aucun verset favori.</div>`;
    }
  }

  chips.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    mode = b.dataset.m;
    chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
    renderMode();
  };

  document.getElementById('qFilter').oninput = e => {
    const q = fold(e.target.value);
    if (mode !== 'surah') { mode = 'surah'; chips.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('on', i === 0)); }
    if (!q) { list.innerHTML = idx.surahs.map(surahRow).join(''); return; }
    const filtered = idx.surahs.filter(s =>
      String(s.n) === q || fold(s.phonetic).includes(q) || fold(s.fr).includes(q));
    list.innerHTML = filtered.length ? filtered.map(surahRow).join('')
      : `<div class="empty">${icon('search', 28)}<br>Aucune sourate trouvée</div>`;
  };
}

// ---------------- tajwid simplifié ----------------
// Colore UNIQUEMENT des règles déterministes et sûres, sans interprétation :
//  - qalqala : ق ط ب ج د portant un soukoun explicite ;
//  - ghunna : ن ou م portant une chadda ;
//  - madd obligatoire : maddah (ٓ) ou alif madda (آ).
// Le texte arabe lui-même n'est jamais modifié — seule la couleur change.
const TJ_QALQALA = 'قطبجد';
const TJ_MARKS = /[ً-ٰٟۖ-ۭ]/;
function tajwidHtml(t) {
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    let j = i + 1, marks = '';
    while (j < t.length && TJ_MARKS.test(t[j])) { marks += t[j]; j++; }
    const seg = esc(c + marks);
    let cls = '';
    if (TJ_QALQALA.includes(c) && /[ْۡ]/.test(marks)) cls = 'tj-q';
    else if ((c === 'ن' || c === 'م') && marks.includes('ّ')) cls = 'tj-g';
    else if (marks.includes('ٓ') || c === 'آ') cls = 'tj-m';
    out += cls ? `<span class="${cls}">${seg}</span>` : seg;
    i = j - 1;
  }
  return out;
}

// ---------------- lecteur de sourate ----------------
export async function viewSurah(n, gotoVerse) {
  if (n < 1 || n > 114) { location.hash = '#/quran'; return; }
  const [s, idx] = await Promise.all([data.surah(n), data.quranIndex()]);
  const meta = idx.surahs[n - 1];
  const cfg = state.settings;
  const showBasmala = n !== 1 && n !== 9;
  const autoplay = /[?&]autoplay=1/.test(location.hash);
  pushRecent(n);

  // juz de la sourate (au premier verset)
  let juzN = 1;
  for (let j = 1; j <= 30; j++) if (idx.juz[j] <= meta.start + 1) juzN = j;
  const juzEnd = (() => { let je = 1; for (let j = 1; j <= 30; j++) if (idx.juz[j] <= meta.start + meta.verses) je = j; return je; })();

  const act = (a, vn, ic, on, label) =>
    `<button class="btn-icon ${on ? 'on' : ''}" data-a="${a}" data-v="${vn}" aria-label="${label}">${ic}</button>`;

  const verseHtml = (v, i) => {
    const vn = i + 1;
    const favId = `${n}:${vn}`;
    const note = getNote(n, vn);
    return `<div class="verse" id="v${vn}" data-v="${vn}">
      ${cfg.showAr ? `<div class="ar">${cfg.tajwid ? tajwidHtml(v[0]) : esc(v[0])} <span class="vnum">${vn}</span></div>` : `<div><span class="vnum">${vn}</span></div>`}
      ${cfg.showTl ? `<div class="tl" style="color:var(--ink-2);font-style:italic;margin:4px 0">${esc(v[2])}</div>` : ''}
      ${cfg.showFr ? `<div class="fr">${esc(v[1])}</div>` : ''}
      ${note ? `<div class="notice" style="margin:6px 0 2px">${icon('note', 14)} ${esc(note)}</div>` : ''}
      <div class="vactions">
        ${act('play', vn, icon('play', 18), false, 'Écouter')}
        ${act('repeat', vn, icon('repeat', 17), false, 'Répéter')}
        ${act('fav', vn, isFav('verses', favId) ? iconFilled('star', 18) : icon('star', 18), isFav('verses', favId), 'Favori')}
        ${act('bm', vn, isBookmarked(n, vn) ? iconFilled('bookmark', 17) : icon('bookmark', 17), isBookmarked(n, vn), 'Marque-page')}
        ${act('note', vn, icon('note', 17), !!note, 'Note personnelle')}
        ${act('copy', vn, icon('copy', 17), false, 'Copier')}
        ${act('share', vn, icon('share', 17), false, 'Partager')}
      </div>
    </div>`;
  };

  $view.innerHTML = `
    <div class="reader-bar">
      <a class="btn-icon" href="#/quran" aria-label="Retour">${icon('chevL', 20)}</a>
      <b class="grow">${n}. ${esc(meta.phonetic)}</b>
      <button class="btn-icon" id="btnPlayAll" aria-label="Écouter la sourate">${icon('play', 20)}</button>
      <button class="btn-icon" id="btnJump" aria-label="Aller au verset">#</button>
      <button class="btn-icon" id="btnCfg" aria-label="Réglages">${icon('settings', 19)}</button>
    </div>
    <div class="surah-head">
      <div class="arname">${esc(meta.name)}</div>
      <div class="frname">${esc(meta.phonetic)} · ${esc(meta.fr)}</div>
      <div class="meta">Sourate ${n} — ${meta.type === 'meccan' ? 'Mecquoise' : 'Médinoise'} — ${meta.verses} versets — Juz' ${juzN}${juzEnd !== juzN ? '-' + juzEnd : ''}</div>
    </div>
    ${showBasmala ? `<div class="basmala-line">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
      ${cfg.showTl ? `<div class="tl center" style="color:var(--ink-2);font-style:italic;margin:-2px 0 10px">Bismi Llâhi r-Rahmâni r-Rahîm</div>` : ''}` : ''}
    ${cfg.tajwid && cfg.showAr ? `<p class="tiny center" style="margin:0 0 8px">Tajwid simplifié :
      <span class="tj-q">qalqala</span> · <span class="tj-g">ghunna</span> · <span class="tj-m">madd</span></p>` : ''}
    <div id="verses">${s.verses.map(verseHtml).join('')}</div>
    <div class="row" style="margin:20px 0; gap:10px">
      ${n > 1 ? `<a class="btn btn-ghost" style="flex:1;text-align:center;text-decoration:none" href="#/quran/s/${n - 1}">${icon('chevL', 15)} ${esc(idx.surahs[n - 2].phonetic)}</a>` : ''}
      ${n < 114 ? `<a class="btn btn-ghost" style="flex:1;text-align:center;text-decoration:none" href="#/quran/s/${n + 1}">${esc(idx.surahs[n].phonetic)} ${icon('chevR', 15)}</a>` : ''}
    </div>
  `;

  document.getElementById('btnCfg').onclick = () => openSettings('texte');

  const makeQueue = () => s.verses.map((_, i) => ({
    gid: meta.start + i + 1, s: n, v: i + 1,
    label: `${meta.phonetic} — verset ${i + 1}/${meta.verses}`,
  }));

  function attachHighlight() {
    player.onchange = item => {
      document.querySelectorAll('.verse.playing').forEach(x => x.classList.remove('playing'));
      if (item && item.s === n) {
        const el = document.getElementById('v' + item.v);
        if (el) {
          el.classList.add('playing');
          if (state.settings.audio.autoScroll) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    };
  }

  function playFrom(pos) {
    attachHighlight();
    player.start(makeQueue(), pos);
    player.render();
  }
  document.getElementById('btnPlayAll').onclick = () => playFrom(0);
  if (autoplay) setTimeout(() => playFrom(0), 300);

  document.getElementById('verses').onclick = async e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const vn = +b.dataset.v;
    const v = s.verses[vn - 1];
    const refText = `${v[0]}\n\n${v[2]}\n\n« ${v[1]} »\n(Coran, sourate ${meta.phonetic} ${n}:${vn})`;
    switch (b.dataset.a) {
      case 'fav': {
        const on = toggleFav('verses', `${n}:${vn}`);
        b.classList.toggle('on', on);
        b.innerHTML = on ? iconFilled('star', 18) : icon('star', 18);
        toast(on ? 'Ajouté aux favoris' : 'Retiré des favoris');
        break;
      }
      case 'bm': {
        const on = toggleBookmark(n, vn);
        b.classList.toggle('on', on);
        b.innerHTML = on ? iconFilled('bookmark', 17) : icon('bookmark', 17);
        toast(on ? 'Marque-page ajouté' : 'Marque-page retiré');
        break;
      }
      case 'note': {
        const existing = getNote(n, vn);
        sheet(`<h3>${icon('note', 18)} Note — ${esc(meta.phonetic)} ${n}:${vn}</h3>
          <textarea id="noteTxt" rows="5" style="width:100%;font:inherit;padding:12px;border-radius:12px;border:1.5px solid var(--line);background:var(--bg-soft);color:var(--ink)"
            placeholder="Votre réflexion personnelle sur ce verset…">${esc(existing)}</textarea>
          <div class="row" style="margin-top:12px;gap:10px">
            ${existing ? `<button class="btn btn-ghost" id="noteDel" style="flex:1">Supprimer</button>` : ''}
            <button class="btn" id="noteSave" style="flex:2">Enregistrer</button>
          </div>`, el => {
          el.querySelector('#noteSave').onclick = () => {
            setNote(n, vn, el.querySelector('#noteTxt').value);
            closeSheet(); toast('Note enregistrée'); viewSurah(n, vn);
          };
          el.querySelector('#noteDel')?.addEventListener('click', () => {
            setNote(n, vn, ''); closeSheet(); toast('Note supprimée'); viewSurah(n, vn);
          });
        });
        break;
      }
      case 'copy': copyText(refText); break;
      case 'share': shareText(`Coran ${n}:${vn}`, refText); break;
      case 'play': playFrom(vn - 1); break;
      case 'repeat': {
        const times = state.settings.audio.repeatVerse > 1 ? state.settings.audio.repeatVerse : 3;
        attachHighlight();
        repeatVerse(makeQueue(), vn - 1, times);
        player.render();
        toast(`Verset répété ${times} fois`);
        break;
      }
    }
  };

  // aller à un verset
  document.getElementById('btnJump').onclick = () => {
    sheet(`<h3>Aller au verset</h3>
      <div class="row"><input id="jumpV" type="number" min="1" max="${meta.verses}" placeholder="1 – ${meta.verses}"
        style="flex:1;font:inherit;padding:12px;border-radius:12px;border:1.5px solid var(--line);background:var(--bg-soft);color:var(--ink)">
      <button class="btn" id="jumpGo">Aller</button></div>`, el => {
      const inp = el.querySelector('#jumpV'); inp.focus();
      const go = () => {
        const v = Math.max(1, Math.min(meta.verses, +inp.value || 1));
        closeSheet();
        document.getElementById('v' + v)?.scrollIntoView({ block: 'start' });
      };
      el.querySelector('#jumpGo').onclick = go;
      inp.onkeydown = e => { if (e.key === 'Enter') go(); };
    });
  };

  // reprise de lecture
  const observer = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (en.isIntersecting) setLastRead(n, +en.target.dataset.v);
    }
  }, { rootMargin: '-30% 0px -60% 0px' });
  document.querySelectorAll('.verse').forEach(el => observer.observe(el));

  if (gotoVerse) {
    requestAnimationFrame(() => {
      const el = document.getElementById('v' + gotoVerse);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        el.style.background = 'rgba(201,162,39,.14)';
        setTimeout(() => { el.style.background = ''; }, 2400);
      }
    });
  } else {
    setLastRead(n, 1);
  }
}
