// Coran : liste des sourates (+ juz), lecteur avec audio, favoris, marque-pages.
import { $view, esc, toast, topbar, bindTopbar, player, sheet, closeSheet, copyText, shareText, openSettings } from './app.js';
import { state, save, setLastRead, toggleFav, isFav, toggleBookmark, isBookmarked } from './state.js';
import * as data from './data.js';
import { fold } from './search.js';

// ---------------- liste des sourates ----------------
export async function viewQuranList() {
  const idx = await data.quranIndex();
  const surahRow = s => `
    <a class="list-item" href="#/quran/s/${s.n}">
      <div class="num">${s.n}</div>
      <div class="t"><b>${esc(s.phonetic)}</b>
        <small>${esc(s.fr)} · ${s.verses} versets · ${s.type === 'meccan' ? 'Mecquoise' : 'Médinoise'}</small></div>
      <div class="arname">${esc(s.name)}</div>
    </a>`;

  $view.innerHTML = `
    ${topbar('Le Coran')}
    <div class="search-input">
      <span>🔍</span>
      <input id="qFilter" type="search" placeholder="Sourate (nom ou numéro), ex : Kahf, 18…" autocomplete="off">
    </div>
    <div class="chiprow" id="modeChips">
      <button class="chip on" data-m="surah">Sourates</button>
      <button class="chip" data-m="juz">Juz'</button>
      <button class="chip" data-m="hizb">Hizb</button>
      <button class="chip" data-m="bookmarks">Marque-pages</button>
    </div>
    <div id="qList">${idx.surahs.map(surahRow).join('')}</div>
  `;
  bindTopbar();

  const list = document.getElementById('qList');
  const chips = document.getElementById('modeChips');
  let mode = 'surah';

  async function renderMode() {
    if (mode === 'surah') {
      list.innerHTML = idx.surahs.map(surahRow).join('');
    } else if (mode === 'juz') {
      const rows = [];
      for (let j = 1; j <= 30; j++) {
        const gid = idx.juz[j];
        const { s, v } = await data.surahOfGlobal(gid);
        const m = idx.surahs[s - 1];
        rows.push(`<a class="list-item" href="#/quran/s/${s}?v=${v}">
          <div class="num star"><span>${j}</span></div>
          <div class="t"><b>Juz' ${j}</b><small>Commence à ${esc(m.phonetic)} ${s}:${v}</small></div>
          <div class="arname">${esc(m.name)}</div></a>`);
      }
      list.innerHTML = rows.join('');
    } else if (mode === 'hizb') {
      const rows = [];
      for (let h = 1; h <= 60; h++) {
        const gid = idx.hizbQuarters[(h - 1) * 4 + 1];
        const { s, v } = await data.surahOfGlobal(gid);
        const m = idx.surahs[s - 1];
        rows.push(`<a class="list-item" href="#/quran/s/${s}?v=${v}">
          <div class="num">${h}</div>
          <div class="t"><b>Hizb ${h}</b><small>Commence à ${esc(m.phonetic)} ${s}:${v}</small></div>
          <div class="arname">${esc(m.name)}</div></a>`);
      }
      list.innerHTML = rows.join('');
    } else {
      if (!state.bookmarks.length) {
        list.innerHTML = `<div class="empty"><span class="em">🔖</span>Aucun marque-page pour l'instant.<br>Dans le lecteur, touchez 🔖 sur un verset.</div>`;
      } else {
        list.innerHTML = state.bookmarks.map(b => {
          const m = idx.surahs[b.s - 1];
          return `<a class="list-item" href="#/quran/s/${b.s}?v=${b.v}">
            <div class="num">🔖</div>
            <div class="t"><b>${esc(m.phonetic)} — verset ${b.v}</b>
              <small>${new Date(b.ts).toLocaleDateString('fr-FR')}</small></div>
            <div class="arname">${esc(m.name)}</div></a>`;
        }).join('');
      }
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
      : `<div class="empty"><span class="em">🔍</span>Aucune sourate trouvée</div>`;
  };
}

// ---------------- lecteur de sourate ----------------
export async function viewSurah(n, gotoVerse) {
  if (n < 1 || n > 114) { location.hash = '#/quran'; return; }
  const [s, idx] = await Promise.all([data.surah(n), data.quranIndex()]);
  const meta = idx.surahs[n - 1];
  const cfg = state.settings;
  const showBasmala = n !== 1 && n !== 9;

  const verseHtml = (v, i) => {
    const vn = i + 1;
    const favId = `${n}:${vn}`;
    return `<div class="verse" id="v${vn}" data-v="${vn}">
      ${cfg.showAr ? `<div class="ar">${esc(v[0])} <span class="vnum">${vn}</span></div>` : `<div><span class="vnum">${vn}</span></div>`}
      ${cfg.showTl ? `<div class="tl">${esc(v[2])}</div>` : ''}
      ${cfg.showFr ? `<div class="fr">${esc(v[1])}</div>` : ''}
      <div class="vactions">
        <button class="btn-icon" data-a="play" data-v="${vn}" aria-label="Écouter">▶️</button>
        <button class="btn-icon ${isFav('verses', favId) ? 'on' : ''}" data-a="fav" data-v="${vn}" aria-label="Favori">${isFav('verses', favId) ? '★' : '☆'}</button>
        <button class="btn-icon ${isBookmarked(n, vn) ? 'on' : ''}" data-a="bm" data-v="${vn}" aria-label="Marque-page">🔖</button>
        <button class="btn-icon" data-a="copy" data-v="${vn}" aria-label="Copier">📋</button>
        <button class="btn-icon" data-a="share" data-v="${vn}" aria-label="Partager">📤</button>
      </div>
    </div>`;
  };

  $view.innerHTML = `
    <div class="reader-bar">
      <a class="btn-icon" href="#/quran" aria-label="Retour">←</a>
      <b class="grow">${n}. ${esc(meta.phonetic)} — ${esc(meta.fr)}</b>
      <button class="btn-icon" id="btnPlayAll" aria-label="Écouter la sourate">🎧</button>
      <button class="btn-icon" id="btnJump" aria-label="Aller au verset">#</button>
      <button class="btn-icon" id="btnCfg" aria-label="Réglages">⚙️</button>
    </div>
    <div class="surah-head">
      <div class="arname">${esc(meta.name)}</div>
      <div class="frname">${esc(meta.phonetic)} · ${esc(meta.fr)}</div>
      <div class="meta">${meta.type === 'meccan' ? 'Mecquoise' : 'Médinoise'} — ${meta.verses} versets</div>
    </div>
    ${showBasmala ? `<div class="basmala-line">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>` : ''}
    <div id="verses">${s.verses.map(verseHtml).join('')}</div>
    <div class="row" style="margin:20px 0; gap:10px">
      ${n > 1 ? `<a class="btn btn-ghost" style="flex:1;text-align:center;text-decoration:none" href="#/quran/s/${n - 1}">← ${esc(idx.surahs[n - 2].phonetic)}</a>` : ''}
      ${n < 114 ? `<a class="btn btn-ghost" style="flex:1;text-align:center;text-decoration:none" href="#/quran/s/${n + 1}">${esc(idx.surahs[n].phonetic)} →</a>` : ''}
    </div>
  `;

  document.getElementById('btnCfg').onclick = openSettings;

  // actions par verset
  document.getElementById('verses').onclick = async e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const vn = +b.dataset.v;
    const v = s.verses[vn - 1];
    const refText = `${v[0]}\n\n« ${v[1]} »\n(Coran, sourate ${meta.phonetic} ${n}:${vn})`;
    if (b.dataset.a === 'fav') {
      const on = toggleFav('verses', `${n}:${vn}`);
      b.classList.toggle('on', on); b.textContent = on ? '★' : '☆';
      toast(on ? 'Ajouté aux favoris ★' : 'Retiré des favoris');
    } else if (b.dataset.a === 'bm') {
      const on = toggleBookmark(n, vn);
      b.classList.toggle('on', on);
      toast(on ? 'Marque-page ajouté 🔖' : 'Marque-page retiré');
    } else if (b.dataset.a === 'copy') {
      copyText(refText);
    } else if (b.dataset.a === 'share') {
      shareText(`Coran ${n}:${vn}`, refText);
    } else if (b.dataset.a === 'play') {
      playFrom(vn - 1);
    }
  };

  function playFrom(pos) {
    const queue = s.verses.map((_, i) => ({
      gid: meta.start + i + 1, s: n, v: i + 1,
      label: `${meta.phonetic} — verset ${i + 1}/${meta.verses}`,
    }));
    player.onchange = item => {
      document.querySelectorAll('.verse.playing').forEach(x => x.classList.remove('playing'));
      if (item && item.s === n) {
        const el = document.getElementById('v' + item.v);
        if (el) { el.classList.add('playing'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      }
    };
    player.start(queue, pos);
    player.render();
  }
  document.getElementById('btnPlayAll').onclick = () => playFrom(0);

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

  // reprise de lecture : mémorise le verset le plus visible
  const observer = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (en.isIntersecting) {
        const vn = +en.target.dataset.v;
        setLastRead(n, vn);
      }
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
