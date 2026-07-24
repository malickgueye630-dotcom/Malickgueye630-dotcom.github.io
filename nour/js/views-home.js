// Accueil premium : salutation + dates + ville, grande carte « prochaine
// prière » avec ciel animé selon le moment de la journée et compte à rebours
// en direct, 8 raccourcis, reprise de lecture, contenus du jour, favoris,
// progression de lecture.
import { $view, esc, openSettings, hijriDate, frDate, fmtClock } from './app.js';
import { icon } from './icons.js';
import { state } from './state.js';
import * as data from './data.js';
import { hasLocation, nextPrayer, timesFor, fmtCountdown, PRAYERS, prayerSettings } from './prayer.js';
import { mountHeroScene, scenePeriod } from './scenes.js';

const DAILY_VERSES = [
  [2, 152], [2, 186], [2, 255], [2, 286], [3, 139], [3, 159], [3, 173],
  [13, 28], [14, 7], [16, 97], [17, 23], [21, 87], [24, 35], [25, 74],
  [29, 69], [31, 17], [33, 41], [39, 53], [40, 60], [49, 13], [55, 60],
  [57, 4], [59, 22], [65, 3], [93, 5], [94, 5], [103, 1], [112, 1],
];
const dayIndex = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

// moment de la journée pour le ciel de la carte prière
function skyPeriod(now, times) {
  if (times) {
    if (now >= times.fajr && now < times.sunrise) return 'dawn';
    if (now >= times.sunrise && now < new Date(times.maghrib - 45 * 60000)) return 'day';
    if (now >= new Date(times.maghrib - 45 * 60000) && now < times.isha) return 'sunset';
    return 'night';
  }
  const h = now.getHours();
  return h >= 5 && h < 7 ? 'dawn' : h >= 7 && h < 18 ? 'day' : h >= 18 && h < 21 ? 'sunset' : 'night';
}

let cdTimer = null;

export async function viewHome() {
  const di = dayIndex();
  const vRef = DAILY_VERSES[di % DAILY_VERSES.length];
  const [surahData, hfr, duasDb, idx] = await Promise.all([
    data.surah(vRef[0]), data.hadithsFr(), data.duas(), data.quranIndex(),
  ]);
  const verse = surahData.verses[vRef[1] - 1];
  const hadith = hfr.hadiths[di % hfr.hadiths.length];
  const allDuas = duasDb.categories.flatMap(c => c.duas.map(d => ({ ...d, catName: c.name, cat: c.id })));
  const dua = allDuas[di % allDuas.length];
  const cfg = state.settings;

  const last = state.lastRead;
  const lastMeta = last ? idx.surahs[last.s - 1] : null;
  const p = prayerSettings();

  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Qu\'Allah bénisse votre nuit' : hour < 12 ? 'Sabâh al-khayr — bonne matinée' : hour < 18 ? 'Qu\'Allah bénisse votre journée' : 'Masâ al-khayr — bonne soirée';

  const shortcuts = [
    ['book', 'Coran', '#/quran'],
    ['sparkle', 'Assistant Nour', '#/search'],
    ['mosque', 'Prières', '#/prayer'],
    ['kaaba', 'Qibla', '#/qibla'],
    ['hands', 'Douas', '#/duas'],
    ['library', 'Hadiths', '#/hadith'],
    ['learn', 'Apprendre', '#/learn'],
    ['beads', 'Tasbih', '#/tasbih'],
  ];

  // progression : aujourd'hui + 7 derniers jours
  const today = new Date().toISOString().slice(0, 10);
  const readToday = state.readLog[today] || 0;
  const goal = cfg.dailyGoal || 10;
  const pct = Math.min(100, Math.round(readToday / goal * 100));
  const week = [...Array(7)].map((_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10);
    return state.readLog[d] || 0;
  });
  const weekMax = Math.max(goal, ...week);
  const favCount = state.favorites.verses.length + state.favorites.duas.length +
    state.favorites.hadithsFr.length + state.favorites.hadiths.length;

  $view.innerHTML = `
    <div class="hero">
      <div class="row" style="justify-content:space-between">
        <div>
          <div class="salam">As-salâmou 'alaykoum${state.settings.userName ? ` <b style="font-weight:800;text-transform:none;letter-spacing:0">${esc(state.settings.userName)}</b>` : ''}</div>
          <div style="font-size:.74rem;opacity:.85;margin-top:3px">${esc(frDate())} · ${esc(hijriDate())}</div>
          ${p.city ? `<div style="font-size:.72rem;opacity:.72;margin-top:1px">${icon('location', 11)} ${esc(p.city)}</div>` : ''}
        </div>
        <div class="row" style="gap:0">
          <button class="btn-icon" style="color:#f3efe2" aria-label="Favoris" onclick="location.hash='#/favorites'">${icon('star', 20)}</button>
          <button class="btn-icon" style="color:#f3efe2" aria-label="Paramètres" id="btnSettingsHero">${icon('settings', 20)}</button>
        </div>
      </div>
      <div class="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
      <div class="sub">${greet}</div>
      <div class="searchbox" id="homeSearch" role="button" tabindex="0" aria-label="Ouvrir l’assistant Nour">
        <span>${icon('sparkle', 17)}</span><span class="ph">Posez une question à l’assistant Nour…</span>
      </div>
    </div>

    ${hasLocation() ? (() => {
      const now = new Date();
      const np = nextPrayer(now);
      const t = timesFor(now);
      const sky = skyPeriod(now, t);
      return `<a class="prayer-hero" data-sky="${sky}" href="#/prayer">
        ${sky === 'night' || sky === 'dawn' ? '<div class="stars"></div>' : ''}
        <div class="sky-orb"></div>
        <div style="position:relative">
          <div style="font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;opacity:.8">Prochaine prière</div>
          <div style="font-size:1.45rem;font-weight:800;margin-top:2px">${esc(np.name)} — ${fmtClock(np.time)}</div>
          <div class="cd" style="font-size:.84rem;opacity:.9">Dans <b id="cdVal">${fmtCountdown(np.time - now)}</b></div>
          <div class="row" style="justify-content:space-between;margin-top:12px;font-size:.72rem;opacity:.92">
            ${PRAYERS.map(([k, n]) => `<span style="text-align:center${np.key === k ? ';font-weight:800' : ';opacity:.72'}">${n.slice(0, 4)}<br>${fmtClock(t[k])}</span>`).join('')}
          </div>
        </div>
      </a>`;
    })() : `
    <a class="card" style="display:block;text-decoration:none;color:inherit" href="#/prayer">
      <div class="row"><span style="color:var(--brand)">${icon('mosque', 26)}</span>
      <div class="grow"><b>Horaires de prière</b><br><span class="tiny">Activez la localisation pour voir vos cinq prières</span></div>
      ${icon('chevR', 17)}</div>
    </a>`}

    <div class="shortcuts">
      ${shortcuts.map(([ic, lab, href]) => `
        <a class="shortcut" href="${href}"><span class="bub">${icon(ic, 24)}</span>${lab}</a>`).join('')}
    </div>

    ${lastMeta ? `
    <a class="list-item" href="#/quran/s/${last.s}?v=${last.v}">
      <div class="num">${icon('book', 18)}</div>
      <div class="t"><b>Continuer ma lecture</b>
        <small>Sourate ${esc(lastMeta.phonetic)} — verset ${last.v}</small></div>
      ${icon('chevR', 17)}
    </a>` : ''}

    <div class="card" style="padding:13px 16px">
      <div class="row" style="justify-content:space-between">
        <b style="font-size:.9rem">${icon('check', 15)} Ma progression de lecture</b>
        <span class="tiny">${readToday} / ${goal} versets aujourd'hui</span>
      </div>
      <div style="height:6px;background:var(--bg-soft);border-radius:3px;margin:9px 0 10px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--brand),var(--brand-3));border-radius:3px;transition:width .4s var(--ease)"></div>
      </div>
      <div class="row" style="gap:5px;align-items:flex-end;height:26px">
        ${week.map((v, i) => `<div style="flex:1;height:${Math.max(8, Math.round(v / weekMax * 100))}%;background:${i === 6 ? 'var(--brand)' : 'var(--bg-soft)'};border-radius:3px" title="${v} versets"></div>`).join('')}
      </div>
      <div class="row" style="justify-content:space-between"><span class="tiny">il y a 7 jours</span><span class="tiny">aujourd'hui</span></div>
    </div>

    <div class="section-head"><h2>Verset du jour</h2><a href="#/quran/s/${vRef[0]}?v=${vRef[1]}">Ouvrir ${icon('chevR', 13)}</a></div>
    <div class="card">
      ${cfg.showAr ? `<div class="ar">${esc(verse[0])}</div>` : ''}
      ${cfg.showTl ? `<div class="tl" style="color:var(--ink-2);font-style:italic;margin:6px 0">${esc(verse[2])}</div>` : ''}
      <p class="fr" style="margin:8px 0 4px">${esc(verse[1])}</p>
      <div class="tiny">Coran — sourate ${esc(surahData.phonetic)} (${vRef[0]}), verset ${vRef[1]}</div>
    </div>

    <div class="section-head"><h2>Hadith du jour</h2><a href="#/hadith">Bibliothèque ${icon('chevR', 13)}</a></div>
    <div class="card hcard">
      ${cfg.showAr ? `<div class="ar">${esc(hadith.ar)}</div>` : ''}
      <p class="fr">${esc(hadith.fr)}</p>
      <div class="src">
        <span class="badge ${hadith.grade.toLowerCase().startsWith('sahih') ? 'sahih' : 'hasan'}">${esc(hadith.grade)}</span>
        <span class="s">${esc(hadith.source)}${hadith.narrator ? ' — rapporté par ' + esc(hadith.narrator) : ''}</span>
      </div>
    </div>

    <div class="section-head"><h2>Invocation du jour</h2><a href="#/duas/${dua.cat}">Ouvrir ${icon('chevR', 13)}</a></div>
    <div class="card hcard">
      <div class="dua-title">${esc(dua.title)}${dua.repeat ? `<span class="repeat-pill">× ${dua.repeat}</span>` : ''}</div>
      ${cfg.showAr ? `<div class="ar">${esc(dua.ar)}</div>` : ''}
      ${cfg.showTl ? `<p class="tl" style="color:var(--ink-2);font-style:italic;margin:6px 0">${esc(dua.translit)}</p>` : ''}
      <p class="fr">${esc(dua.fr)}</p>
      <div class="tiny">${esc(dua.source)}</div>
    </div>

    <a class="list-item" href="#/favorites">
      <div class="num">${icon('star', 17)}</div>
      <div class="t"><b>Mes favoris</b>
        <small>${favCount ? `${favCount} élément${favCount > 1 ? 's' : ''} enregistré${favCount > 1 ? 's' : ''}` : 'Touchez l\'étoile sur un verset, un hadith ou une doua'}</small></div>
      ${icon('chevR', 17)}
    </a>

    <p class="tiny center" style="margin-top:26px">
      Nour — Coran, hadiths &amp; invocations. <a href="#/about" style="color:var(--brand)">Sources &amp; crédits</a>
    </p>
    <p class="signature">Conçu par Malick Gueye, alias Lecce</p>
  `;
  // scène cinématographique derrière la recherche (adaptée à l'heure réelle)
  try {
    const hero = $view.querySelector('.hero');
    const t = hasLocation() ? timesFor(new Date()) : null;
    mountHeroScene(hero, scenePeriod(t));
  } catch {}
  document.getElementById('homeSearch').onclick = () => { location.hash = '#/search'; };
  document.getElementById('btnSettingsHero').onclick = () => openSettings();

  // compte à rebours en direct
  clearInterval(cdTimer);
  if (hasLocation()) {
    cdTimer = setInterval(() => {
      const el = document.getElementById('cdVal');
      if (!el) { clearInterval(cdTimer); return; }
      const np = nextPrayer(new Date());
      el.textContent = fmtCountdown(np.time - new Date());
    }, 1000);
  }
}
