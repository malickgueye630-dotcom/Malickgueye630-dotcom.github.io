// Accueil : salutation, recherche, prochaine prière, reprise de lecture, contenus du jour.
import { $view, esc, bindTopbar, openSettings } from './app.js';
import { state } from './state.js';
import * as data from './data.js';
import { hasLocation, nextPrayer, timesFor, fmtTime, fmtCountdown, PRAYERS } from './prayer.js';

// versets choisis pour « le verset du jour » (références connues et porteuses de sens)
const DAILY_VERSES = [
  [2, 152], [2, 186], [2, 255], [2, 286], [3, 139], [3, 159], [3, 173],
  [13, 28], [14, 7], [16, 97], [17, 23], [21, 87], [24, 35], [25, 74],
  [29, 69], [31, 17], [33, 41], [39, 53], [40, 60], [49, 13], [55, 60],
  [57, 4], [59, 22], [65, 3], [93, 5], [94, 5], [103, 1], [112, 1],
];

const dayIndex = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

export async function viewHome() {
  const di = dayIndex();
  const [vRef] = [DAILY_VERSES[di % DAILY_VERSES.length]];
  const [surahData, hfr, duasDb, idx] = await Promise.all([
    data.surah(vRef[0]), data.hadithsFr(), data.duas(), data.quranIndex(),
  ]);
  const verse = surahData.verses[vRef[1] - 1];
  const hadith = hfr.hadiths[di % hfr.hadiths.length];
  const allDuas = duasDb.categories.flatMap(c => c.duas.map(d => ({ ...d, catName: c.name, cat: c.id })));
  const dua = allDuas[di % allDuas.length];

  const last = state.lastRead;
  const lastMeta = last ? idx.surahs[last.s - 1] : null;

  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Qu\'Allah bénisse votre nuit' : hour < 12 ? 'Sabah al-khayr — bonne matinée' : hour < 18 ? 'Qu\'Allah bénisse votre journée' : 'Masa al-khayr — bonne soirée';

  $view.innerHTML = `
    <div class="hero">
      <div class="row" style="justify-content:space-between">
        <div class="salam">As-salamu alaykum</div>
        <div class="row" style="gap:0">
          <button class="btn-icon" style="color:#f3efe2" aria-label="Favoris" onclick="location.hash='#/favorites'">⭐</button>
          <button class="btn-icon" style="color:#f3efe2" aria-label="Réglages" id="btnSettingsHero">⚙️</button>
        </div>
      </div>
      <div class="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
      <div class="sub">${greet}</div>
      <div class="searchbox" id="homeSearch" role="button" tabindex="0" aria-label="Rechercher">
        <span>🔍</span><span class="ph">Verset, hadith, invocation… ex : « doua avant de dormir »</span>
      </div>
    </div>

    ${hasLocation() ? (() => {
      const now = new Date();
      const np = nextPrayer(now);
      const t = timesFor(now);
      return `<a class="card" style="display:block;text-decoration:none;color:inherit;background:var(--hero-grad);color:#f3efe2;border:none" href="#/prayer">
        <div class="row" style="justify-content:space-between">
          <div><div style="font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;opacity:.75">Prochaine prière</div>
          <div style="font-size:1.35rem;font-weight:800">${esc(np.name)} — ${fmtTime(np.time)}</div>
          <div style="font-size:.8rem;opacity:.85">Dans ${fmtCountdown(np.time - now)}</div></div>
          <div style="font-size:1.8rem">🕌</div>
        </div>
        <div class="row" style="justify-content:space-between;margin-top:10px;font-size:.72rem;opacity:.9">
          ${PRAYERS.map(([k, n]) => `<span style="text-align:center${np.key === k ? ';font-weight:800' : ';opacity:.75'}">${n.slice(0, 4)}<br>${fmtTime(t[k])}</span>`).join('')}
        </div>
      </a>`;
    })() : `
    <a class="card" style="display:block;text-decoration:none;color:inherit" href="#/prayer">
      <div class="row"><span style="font-size:1.5rem">🕌</span>
      <div class="grow"><b>Horaires de prière</b><br><span class="tiny">Activez la localisation pour voir vos cinq prières et la prochaine à venir</span></div>
      <span style="color:var(--brand);font-weight:700">→</span></div>
    </a>`}

    ${lastMeta ? `
    <a class="list-item" href="#/quran/s/${last.s}?v=${last.v}">
      <div class="num">📖</div>
      <div class="t"><b>Reprendre la lecture</b>
        <small>Sourate ${esc(lastMeta.phonetic)} — verset ${last.v}</small></div>
      <span style="color:var(--brand);font-weight:700">→</span>
    </a>` : `
    <a class="list-item" href="#/quran/s/1">
      <div class="num">📖</div>
      <div class="t"><b>Commencer la lecture</b><small>Sourate Al-Fatihah</small></div>
      <span style="color:var(--brand);font-weight:700">→</span>
    </a>`}

    <div class="tilegrid">
      <a class="tile" href="#/duas/matin-soir"><span class="em">🌅</span><b>Adhkar du matin</b><span>Protection quotidienne</span></a>
      <a class="tile" href="#/duas/reveil-sommeil"><span class="em">🌙</span><b>Adhkar du soir</b><span>Avant de dormir</span></a>
    </div>

    <div class="section-head"><h2>Verset du jour</h2><a href="#/quran/s/${vRef[0]}?v=${vRef[1]}">Ouvrir →</a></div>
    <div class="card">
      <div class="ar">${esc(verse[0])}</div>
      <p class="fr" style="margin:10px 0 4px">${esc(verse[1])}</p>
      <div class="tiny">Coran — sourate ${esc(surahData.phonetic)} (${vRef[0]}), verset ${vRef[1]}</div>
    </div>

    <div class="section-head"><h2>Hadith du jour</h2><a href="#/hadith">Bibliothèque →</a></div>
    <div class="card hcard">
      <div class="ar">${esc(hadith.ar)}</div>
      <p class="fr">${esc(hadith.fr)}</p>
      <div class="src">
        <span class="badge ${hadith.grade.toLowerCase().startsWith('sahih') ? 'sahih' : 'hasan'}">${esc(hadith.grade)}</span>
        <span class="s">${esc(hadith.source)}${hadith.narrator ? ' — rapporté par ' + esc(hadith.narrator) : ''}</span>
      </div>
    </div>

    <div class="section-head"><h2>Invocation du jour</h2><a href="#/duas/${dua.cat}">Ouvrir →</a></div>
    <div class="card hcard">
      <div class="dua-title">${esc(dua.title)}${dua.repeat ? `<span class="repeat-pill">× ${dua.repeat}</span>` : ''}</div>
      <div class="ar">${esc(dua.ar)}</div>
      <p class="tl" style="color:var(--ink-2);font-style:italic;font-size:.86rem">${esc(dua.translit)}</p>
      <p class="fr">${esc(dua.fr)}</p>
      <div class="tiny">${esc(dua.source)}</div>
    </div>

    <h2>Catégories populaires</h2>
    <div class="chiprow">
      <a class="chip" href="#/hadith/theme/priere">🕌 Prière</a>
      <a class="chip" href="#/hadith/theme/parents">👵 Parents</a>
      <a class="chip" href="#/hadith/theme/famille">💍 Mariage</a>
      <a class="chip" href="#/hadith/theme/jeune">🌙 Ramadan</a>
      <a class="chip" href="#/hadith/theme/aumone">🤝 Aumône</a>
      <a class="chip" href="#/hadith/theme/comportement">✨ Comportement</a>
      <a class="chip" href="#/hadith/theme/mort">🌿 La mort</a>
      <a class="chip" href="#/hadith/theme/paradis">🌸 Paradis</a>
    </div>

    <p class="tiny center" style="margin-top:26px">
      Nour — Coran, hadiths & invocations. <a href="#/about" style="color:var(--brand)">Sources & crédits</a>
    </p>
  `;
  document.getElementById('homeSearch').onclick = () => { location.hash = '#/search'; };
  document.getElementById('btnSettingsHero').onclick = openSettings;
  bindTopbar();
}
