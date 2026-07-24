// Paramètres — page dédiée, organisée en catégories :
// Apparence / Coran / Prières / Qibla / Recherche.
// Chaque contrôle est fonctionnel et persisté immédiatement.
import { $view, esc, toast, player } from './app.js';
import { icon } from './icons.js';
import { state, save, applyTheme, applySizes } from './state.js';
import * as data from './data.js';
import { METHODS, prayerSettings, geolocate, hasLocation } from './prayer.js';

const seg = (id, opts, cur) => `<div class="seg" data-seg="${id}" style="flex-wrap:wrap;justify-content:flex-end">
  ${opts.map(([v, lab]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${lab}</button>`).join('')}</div>`;
const row = (lab, sub, ctrl) => `<div class="setrow"><div class="lab">${lab}${sub ? `<small>${sub}</small>` : ''}</div>${ctrl}</div>`;
const sw = (k, checked) => `<label class="switch"><input type="checkbox" data-k="${k}" ${checked ? 'checked' : ''}><span class="tr"></span></label>`;

// thèmes de couleurs prédéfinis (au-delà des 4 palettes de base)
const PRESETS = [
  ['Océan', { primary: '#1E7FA6', secondary: '#0C2E45', accent: '#E0B45C' }],
  ['Rubis', { primary: '#B23A55', secondary: '#521424', accent: '#D9A441' }],
  ['Forêt', { primary: '#2E7D4F', secondary: '#123024', accent: '#CBA14B' }],
  ['Indigo', { primary: '#4B4F9E', secondary: '#20214A', accent: '#D6A55A' }],
  ['Turquoise', { primary: '#0E9E8E', secondary: '#083B39', accent: '#E4B45E' }],
  ['Rose sable', { primary: '#C86B7A', secondary: '#5A2E38', accent: '#D9A441' }],
  ['Ambre nuit', { primary: '#C08A2E', secondary: '#2A2010', accent: '#E9C766' }],
  ['Ardoise', { primary: '#4A5568', secondary: '#1E2530', accent: '#C99A53' }],
];
const CUR = (c, k, d) => (c && c[k]) || d;

// panneau de personnalisation avancée des couleurs
function customPanel(s) {
  const c = s.colors || {};
  const picker = (k, lab, def) => `<div class="colorpick">
    <input type="color" data-color="${k}" value="${CUR(c, k, def)}">
    <span>${lab}</span></div>`;
  return `
    <div class="setrow" style="display:block;border-bottom:none;padding-bottom:2px">
      <div class="lab" style="margin-bottom:8px">Thèmes prédéfinis</div>
      <div class="preset-row">
        ${PRESETS.map((p, i) => `<button class="preset" data-preset="${i}" title="${esc(p[0])}"
          style="background:linear-gradient(135deg, ${p[1].secondary}, ${p[1].primary})"><span style="background:${p[1].accent}"></span></button>`).join('')}
      </div>
    </div>
    <div class="setrow" style="display:block">
      <div class="lab" style="margin-bottom:8px">Couleurs personnalisées<small>Lisibilité ajustée automatiquement</small></div>
      <div class="color-grid">
        ${picker('primary', 'Principale', '#0F8B6D')}
        ${picker('secondary', 'Secondaire', '#073B3A')}
        ${picker('accent', 'Accent', '#D4AF6A')}
        ${picker('bg', 'Fond', '#F7F2E8')}
        ${picker('card', 'Cartes', '#FFFDFC')}
        ${picker('button', 'Boutons', '#0F8B6D')}
      </div>
      <div class="row" style="gap:10px;margin-top:12px">
        <button class="btn btn-ghost" id="btnHue" style="flex:1">Mode teinte simple</button>
        <button class="btn btn-ghost" id="btnResetColors" style="flex:1">Réinitialiser</button>
      </div>
    </div>`;
}

export function viewSettings(section) {
  const s = state.settings;
  const p = prayerSettings();

  $view.innerHTML = `
    <a class="backlink" href="#/more">${icon('chevL', 15)} Plus</a>
    <h1 style="margin:6px 2px 10px">Paramètres</h1>

    <div class="setgroup" id="sec-apparence">
      <h2>${icon('sun', 15)} Apparence</h2>
      ${row('Votre prénom', 'Affiché dans la salutation d’accueil',
        `<input type="text" id="userName" value="${esc(s.userName || '')}" maxlength="24" placeholder="Prénom"
          style="font:inherit;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg-soft);color:var(--ink);max-width:130px">`)}
      ${row('Mode sombre', 'Clair, sombre ou selon l’iPhone', seg('theme', [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']], s.theme))}
      ${row('Thème de couleurs', '', seg('palette', [['emeraude', 'Émeraude'], ['sable', 'Sable'], ['nuit', 'Nuit'], ['lavande', 'Lavande'], ['custom', 'Perso']], s.palette))}
      <div id="hueRow">${s.palette === 'custom' ? customPanel(s) : ''}</div>
      ${row('Taille de l’interface', '', seg('uiScale', [[0.92, 'A'], [1, 'A'], [1.1, 'A'], [1.2, 'A']], s.uiScale))}
      ${row('Format de l’heure', '', seg('timeFmt', [['24', '24 h'], ['12', '12 h']], s.timeFmt))}
      ${row('Vibrations', 'Retour au toucher : Tasbih, Qibla…', sw('haptics', s.haptics))}
    </div>

    <div class="setgroup" id="sec-coran">
      <h2>${icon('book', 15)} Coran</h2>
      ${row('Texte arabe', '', sw('showAr', s.showAr))}
      ${row('Police arabe', '', seg('arFont', [['amiri', 'Amiri'], ['system', 'Système']], s.arFont))}
      ${row('Taille du texte arabe', '', seg('arSize', [[1.5, 'A'], [1.9, 'A'], [2.4, 'A'], [3, 'A']], s.arSize))}
      ${row('Espacement des lignes', '', seg('lineSpace', [[1.8, '−'], [2.05, '⋯'], [2.4, '+']], s.lineSpace))}
      ${row('Phonétique française', 'Transcription lisible pour francophone', sw('showTl', s.showTl))}
      ${row('Taille de la phonétique', '', seg('tlSize', [[0.8, 'A'], [0.92, 'A'], [1.06, 'A'], [1.2, 'A']], s.tlSize))}
      ${row('Traduction française', 'Muhammad Hamidullah', sw('showFr', s.showFr))}
      ${row('Taille de la traduction', '', seg('frSize', [[0.85, 'A'], [0.98, 'A'], [1.12, 'A'], [1.28, 'A']], s.frSize))}
      ${row('Tajwid simplifié', 'Colore uniquement les règles sûres : qalqala, ghunna, madd', sw('tajwid', s.tajwid))}
      ${row('Thème de lecture', 'Fond de la page des sourates', seg('readingTheme', [['normal', 'Normal'], ['sepia', 'Sépia'], ['vert', 'Vert']], s.readingTheme))}
      ${row('Traduction anglaise de secours', 'Recueils sans traduction française (Sunnah.com), repliée', sw('showEnFallback', s.showEnFallback))}
      ${row('Récitateur', '', `<select id="selReciter" style="font:inherit;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--bg-soft);color:var(--ink);max-width:170px">
        ${data.RECITERS.map(r => `<option value="${r.id}" ${r.id === s.reciter ? 'selected' : ''}>${r.name}</option>`).join('')}</select>`)}
      ${row('Vitesse de récitation', '', seg('speed', [[0.5, '0,5×'], [0.75, '0,75×'], [1, '1×'], [1.25, '1,25×'], [1.5, '1,5×']], s.audio.speed))}
      ${row('Répétition de chaque verset', 'Pour l’apprentissage', seg('repeatVerse', [[1, '1×'], [2, '2×'], [3, '3×'], [5, '5×'], [10, '10×']], s.audio.repeatVerse))}
      ${row('Enchaîner les versets', '', sw('a.autoNext', s.audio.autoNext))}
      ${row('Défilement automatique', 'Suivre la récitation à l’écran', sw('a.autoScroll', s.audio.autoScroll))}
      ${row('Répéter la sourate', '', sw('a.repeatSurah', s.audio.repeatSurah))}
      ${row('Sourate suivante automatique', '', sw('a.continueSurah', s.audio.continueSurah))}
      ${row('Télécharger le Coran', 'Accès hors-ligne complet', '<button class="btn btn-ghost" id="btnOffline">Télécharger</button>')}
    </div>

    <div class="setgroup" id="sec-prieres">
      <h2>${icon('mosque', 15)} Prières</h2>
      ${row('Méthode de calcul', '', `<select id="selMethod" style="font:inherit;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--bg-soft);color:var(--ink);max-width:180px">
        ${METHODS.map(m => `<option value="${m.id}" ${m.id === p.method ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>`)}
      ${row('École pour le ’Asr', 'Chafiite, malikite, hanbalite / hanafite', seg('madhab', [['shafi', 'Standard'], ['hanafi', 'Hanafite']], p.madhab))}
      ${row('Localisation', p.city ? esc(p.city) : 'Non définie', `<button class="btn btn-ghost" id="btnGeoSet">${hasLocation() ? 'Actualiser' : 'Activer'}</button>`)}
      <div class="setrow"><div class="lab">Ajustements manuels &amp; notifications<small>Minutes par prière, rappels, adhan, export calendrier</small></div>
        <a class="backlink" href="#/prayer">Ouvrir ${icon('chevR', 14)}</a></div>
    </div>

    <div class="setgroup" id="sec-qibla">
      <h2>${icon('kaaba', 15)} Qibla</h2>
      ${row('Vibration à l’alignement', 'Petite vibration face à la Kaaba', sw('haptics', s.haptics))}
      ${row('Sensibilité de l’alignement', 'Marge autour de la direction exacte', seg('qiblaSens', [[2, 'Précise (±2°)'], [4, 'Normale (±4°)'], [8, 'Souple (±8°)']], s.qiblaSens))}
      <div class="setrow"><div class="lab">Calibration<small>Si la direction semble fausse, dessinez un « 8 » avec le téléphone, loin des objets métalliques</small></div>
        <a class="backlink" href="#/qibla">Boussole ${icon('chevR', 14)}</a></div>
    </div>

    <div class="setgroup" id="sec-recherche">
      <h2>${icon('search', 15)} Recherche</h2>
      ${row('Recherche intelligente', 'Compréhension des questions, sujets, réponse directe', sw('searchSmart', s.searchSmart))}
      ${row('Recherche phonétique', 'Arabe écrit en lettres latines (« laqad jaakoum »)', sw('searchPhonetic', s.searchPhonetic))}
      ${row('Suggestions pendant la saisie', '', sw('searchSuggest', s.searchSuggest))}
      ${row('Historique des recherches', 'Mémoriser les recherches récentes sur cet appareil', sw('searchHistoryOn', s.searchHistoryOn))}
      ${row('Effacer l’historique', `${state.searchHistory.length} recherche${state.searchHistory.length > 1 ? 's' : ''} mémorisée${state.searchHistory.length > 1 ? 's' : ''}`,
        '<button class="btn btn-ghost" id="btnClearHist">Effacer</button>')}
    </div>

    <div class="setgroup" id="sec-ia">
      <h2>${icon('search', 15)} Moteur local de réponse</h2>
      <div class="setrow" style="display:block;border-bottom:none">
        <div class="lab">Actif, privé et sans clé API
          <small style="line-height:1.55;margin-top:6px">La recherche combine plein texte, correction orthographique,
          synonymes, phonétique arabe/française, sujets vérifiés, TF-IDF conceptuel et BM25. Les questions et les
          passages ne quittent jamais l’appareil.</small>
        </div>
        <div class="notice" style="margin:12px 0 0">Limite honnête : Nour n’embarque pas de grand modèle de langage.
          La synthèse est extractive et éditoriale, construite uniquement avec les contenus locaux. Si les sources
          sont insuffisantes, l’application refuse de conclure.</div>
      </div>
    </div>

    <div class="setgroup">
      <h2>${icon('note', 15)} À propos</h2>
      <div class="setrow"><div class="lab">Sources, traductions &amp; licences</div>
        <a class="backlink" href="#/about">Voir ${icon('chevR', 14)}</a></div>
    </div>
  `;

  // ---------- liaisons ----------
  const root = $view;
  root.querySelectorAll('[data-seg]').forEach(segEl => {
    segEl.onclick = e => {
      const v = e.target.dataset?.v;
      if (v === undefined) return;
      const key = segEl.dataset.seg;
      const num = parseFloat(v);
      const val = isNaN(num) || String(num) !== v ? v : num;
      if (key === 'speed') { s.audio.speed = val; player.audio.playbackRate = val; }
      else if (key === 'repeatVerse') s.audio.repeatVerse = val;
      else if (key === 'madhab') p.madhab = val;
      else s[key] = val;
      save(); applyTheme(); applySizes();
      segEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.target));
      if (key === 'palette') {
        document.getElementById('hueRow').innerHTML = val === 'custom' ? customPanel(s) : '';
        bindColorPanel();
      }
    };
  });
  root.querySelectorAll('input[data-k]').forEach(inp => inp.onchange = () => {
    const k = inp.dataset.k;
    if (k.startsWith('a.')) s.audio[k.slice(2)] = inp.checked;
    else s[k] = inp.checked;
    save();
    // les deux interrupteurs « vibrations » (Apparence / Qibla) restent synchronisés
    if (k === 'haptics') root.querySelectorAll('input[data-k="haptics"]').forEach(i => { i.checked = inp.checked; });
  });
  const bindColorPanel = () => {
    document.getElementById('hueSlider')?.addEventListener('input', e => {
      s.customHue = +e.target.value; save(); applyTheme();
    });
    root.querySelectorAll('[data-color]').forEach(inp => inp.oninput = () => {
      s.colors = { ...(s.colors || {}), [inp.dataset.color]: inp.value };
      save(); applyTheme();
    });
    root.querySelectorAll('[data-preset]').forEach(btn => btn.onclick = () => {
      s.colors = { ...PRESETS[+btn.dataset.preset][1] };
      save(); applyTheme(); viewSettings('apparence');
    });
    document.getElementById('btnResetColors')?.addEventListener('click', () => {
      s.colors = null; save(); applyTheme(); viewSettings('apparence');
    });
    document.getElementById('btnHue')?.addEventListener('click', () => {
      s.colors = null; save();
      document.getElementById('hueRow').innerHTML = row('Ma couleur', 'Glissez pour choisir la teinte principale',
        `<input type="range" id="hueSlider" min="0" max="359" value="${s.customHue ?? 165}" style="width:150px;accent-color:var(--brand)">`);
      applyTheme(); bindColorPanel();
    });
  };
  bindColorPanel();
  const uname = document.getElementById('userName');
  if (uname) uname.oninput = () => { s.userName = uname.value.trim().slice(0, 24); save(); };
  root.querySelector('#selReciter').onchange = e => { s.reciter = e.target.value; save(); };
  root.querySelector('#selMethod').onchange = e => { p.method = e.target.value; save(); toast('Méthode enregistrée'); };
  root.querySelector('#btnGeoSet').onclick = async e => {
    e.target.textContent = '…';
    try { await geolocate(); toast('Position mise à jour'); viewSettings('prieres'); }
    catch { e.target.textContent = 'Réessayer'; toast('Géolocalisation refusée — choisissez une ville dans Prières'); }
  };
  root.querySelector('#btnClearHist').onclick = e => {
    state.searchHistory = []; save();
    e.target.closest('.setrow').querySelector('small').textContent = '0 recherche mémorisée';
    toast('Historique effacé');
  };
  root.querySelector('#btnOffline').onclick = async e => {
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
  };

  if (section) {
    requestAnimationFrame(() => document.getElementById(`sec-${section}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }
}
