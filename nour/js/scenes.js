// Scènes cinématographiques pour l'en-tête de recherche (accueil).
// Illustrations vectorielles ORIGINALES de grands lieux de l'islam — silhouettes
// stylisées, pas des photographies : 100 % légales, hors-ligne, sans dépendance
// externe. Le ciel s'adapte à l'heure réelle (aube / jour / coucher / nuit) ;
// mouvement de caméra très lent, particules discrètes ; les lieux défilent
// toutes les ~5,5 min avec un fondu enchaîné. La barre de recherche reste
// intacte et parfaitement lisible (voile dégradé sous le contenu).

// palettes de ciel selon le moment de la journée
const SKY = {
  dawn:   { top: '#243A6E', mid: '#7C5A86', low: '#E4976B', orb: '#FFE6A8', glow: 'rgba(255,220,150,.5)', sil: '#2A2540', star: .35 },
  day:    { top: '#1E6FA6', mid: '#3F9AC9', low: '#BFE2EE', orb: '#FFF6D8', glow: 'rgba(255,240,180,.55)', sil: '#123A4A', star: 0 },
  sunset: { top: '#37244F', mid: '#8C3F5C', low: '#E08650', orb: '#FFD9A0', glow: 'rgba(226,135,76,.5)', sil: '#241830', star: .15 },
  night:  { top: '#070E22', mid: '#122048', low: '#1F3A63', orb: '#F2ECDC', glow: 'rgba(240,236,220,.3)', sil: '#050B18', star: .9 },
};

// silhouettes (viewBox 0 0 400 200, posées sur la ligne du bas y=200)
// chaque tracé est rempli d'une couleur unie (silhouette) — reconnaissable par
// ses traits distinctifs (Kaaba, dôme vert, dôme doré, minarets…).
const MOSQUES = {
  haram: { name: 'Masjid al-Harâm — La Mecque', build: c => `
    <g fill="${c.sil}">
      <rect x="40" y="70" width="16" height="130"/><rect x="344" y="70" width="16" height="130"/>
      <rect x="120" y="90" width="12" height="110"/><rect x="268" y="90" width="12" height="110"/>
      <path d="M40 70a8 8 0 0 1 16 0Z"/><path d="M344 70a8 8 0 0 1 16 0Z"/>
      <path d="M120 90a6 6 0 0 1 12 0Z"/><path d="M268 90a6 6 0 0 1 12 0Z"/>
      <rect x="70" y="120" width="260" height="80"/>
      <path d="M70 120q130 -46 260 0Z"/>
    </g>
    <g fill="#0E0E10" stroke="${c.orb}" stroke-width="1.2" opacity=".95">
      <rect x="176" y="150" width="48" height="50" rx="2"/>
    </g>
    <rect x="176" y="150" width="48" height="10" fill="${c.orb}" opacity=".85"/>` },
  nabawi: { name: 'Masjid an-Nabawî — Médine', build: c => `
    <g fill="${c.sil}">
      <rect x="60" y="60" width="13" height="140"/><rect x="327" y="60" width="13" height="140"/>
      <path d="M60 60a6.5 6.5 0 0 1 13 0Z"/><path d="M327 60a6.5 6.5 0 0 1 13 0Z"/>
      <rect x="90" y="130" width="220" height="70"/>
    </g>
    <path d="M170 130a30 26 0 0 1 60 0Z" fill="#1E7A54"/>
    <rect x="198" y="86" width="4" height="18" fill="#1E7A54"/><circle cx="200" cy="84" r="4" fill="${c.orb}"/>
    <g fill="${c.sil}"><path d="M120 130a16 16 0 0 1 32 0Z"/><path d="M248 130a16 16 0 0 1 32 0Z"/></g>` },
  aqsa: { name: 'Al-Aqsâ & Dôme du Rocher — Jérusalem', build: c => `
    <g fill="${c.sil}">
      <rect x="250" y="96" width="120" height="104"/>
      <path d="M250 96l60 -26 60 26Z"/>
      <rect x="40" y="150" width="150" height="50"/>
    </g>
    <path d="M70 150a45 40 0 0 1 90 0Z" fill="#C9A24B"/>
    <rect x="113" y="96" width="4" height="16" fill="#C9A24B"/><circle cx="115" cy="94" r="4.5" fill="${c.orb}"/>
    <path d="M250 96l60 -26 60 26" fill="none" stroke="${c.orb}" stroke-width="1.4" opacity=".7"/>` },
  zayed: { name: 'Cheikh Zâyed — Abou Dhabi', build: c => `
    <g fill="${c.sil}">
      <rect x="30" y="70" width="11" height="130"/><rect x="120" y="70" width="11" height="130"/>
      <rect x="269" y="70" width="11" height="130"/><rect x="359" y="70" width="11" height="130"/>
      <path d="M30 70a5.5 5.5 0 0 1 11 0Z"/><path d="M120 70a5.5 5.5 0 0 1 11 0Z"/>
      <path d="M269 70a5.5 5.5 0 0 1 11 0Z"/><path d="M359 70a5.5 5.5 0 0 1 11 0Z"/>
      <rect x="70" y="140" width="260" height="60"/>
      <path d="M150 140q20 -34 40 0Z"/><path d="M210 140q20 -34 40 0Z"/>
      <path d="M120 148q30 -40 60 0Z"/><path d="M220 148q30 -40 60 0Z"/>
      <path d="M170 118q30 -46 60 0Z"/>
    </g>` },
  sultanahmet: { name: 'Sultanahmet (Mosquée Bleue) — Istanbul', build: c => `
    <g fill="${c.sil}">
      <rect x="34" y="46" width="9" height="154"/><rect x="96" y="60" width="9" height="140"/>
      <rect x="295" y="60" width="9" height="140"/><rect x="357" y="46" width="9" height="154"/>
      <path d="M34 46a4.5 4.5 0 0 1 9 0Z"/><path d="M96 60a4.5 4.5 0 0 1 9 0Z"/>
      <path d="M295 60a4.5 4.5 0 0 1 9 0Z"/><path d="M357 46a4.5 4.5 0 0 1 9 0Z"/>
      <rect x="120" y="150" width="160" height="50"/>
      <path d="M150 150q10 -22 20 0Z"/><path d="M230 150q10 -22 20 0Z"/>
      <path d="M162 150a38 34 0 0 1 76 0Z"/>
      <rect x="198" y="104" width="4" height="14"/><circle cx="200" cy="102" r="4" fill="${c.orb}"/>
    </g>` },
  hassan2: { name: 'Hassan II — Casablanca', build: c => `
    <g fill="${c.sil}">
      <rect x="150" y="18" width="34" height="182"/>
      <path d="M150 18h34v-6h-34Z"/><rect x="158" y="4" width="18" height="10"/>
      <rect x="210" y="130" width="150" height="70"/>
      <path d="M210 130h150v-12l-14 -10h-122l-14 10Z" fill="#1E7A54"/>
      <rect x="40" y="150" width="90" height="50"/>
    </g>
    <g fill="none" stroke="${c.orb}" stroke-width="1.1" opacity=".55">
      <path d="M156 40h22M156 66h22M156 92h22M156 118h22"/>
    </g>` },
};
const ORDER = ['haram', 'nabawi', 'aqsa', 'zayed', 'sultanahmet', 'hassan2'];

function starsField(density) {
  if (density <= 0) return '';
  const n = Math.round(46 * density);
  let s = '';
  // positions déterministes (pas de scintillement aléatoire à chaque frame)
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) {
    const x = (rnd() * 400).toFixed(1), y = (rnd() * 120).toFixed(1), r = (rnd() * 0.9 + 0.3).toFixed(2);
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${(rnd() * 0.6 + 0.3).toFixed(2)}"/>`;
  }
  return `<g class="scene-stars">${s}</g>`;
}

function sceneSVG(key, period) {
  const c = SKY[period] || SKY.day;
  const orbY = period === 'night' || period === 'dawn' ? 46 : 60;
  const orbX = period === 'dawn' ? 300 : period === 'sunset' ? 96 : 200;
  return `<svg class="scene-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="sky-${key}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.top}"/><stop offset="55%" stop-color="${c.mid}"/><stop offset="100%" stop-color="${c.low}"/>
      </linearGradient>
      <radialGradient id="orb-${key}" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="${c.orb}"/><stop offset="60%" stop-color="${c.orb}" stop-opacity=".9"/><stop offset="100%" stop-color="${c.orb}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="-40" y="0" width="480" height="200" fill="url(#sky-${key})"/>
    ${starsField(c.star)}
    <g class="scene-orb"><circle cx="${orbX}" cy="${orbY}" r="34" fill="url(#orb-${key})"/><circle cx="${orbX}" cy="${orbY}" r="15" fill="${c.orb}"/></g>
    <g class="scene-city">${MOSQUES[key].build(c)}</g>
  </svg>`;
}

// période depuis les horaires de prière si disponibles, sinon l'heure
export function scenePeriod(times, now = new Date()) {
  if (times && times.fajr) {
    if (now >= times.fajr && now < times.sunrise) return 'dawn';
    if (now >= times.sunrise && now < new Date(times.maghrib - 50 * 60000)) return 'day';
    if (now >= new Date(times.maghrib - 50 * 60000) && now < times.isha) return 'sunset';
    return 'night';
  }
  const h = now.getHours();
  return h >= 5 && h < 7 ? 'dawn' : h >= 7 && h < 18 ? 'day' : h >= 18 && h < 21 ? 'sunset' : 'night';
}

let sceneTimer = null;

// installe la scène derrière le contenu du hero ; renvoie le nom du lieu courant
export function mountHeroScene(hero, period) {
  clearInterval(sceneTimer);
  const layer = document.createElement('div');
  layer.className = 'hero-scene';
  layer.innerHTML = `
    <div class="scene-frame" data-a></div>
    <div class="scene-frame" data-b></div>
    <div class="scene-scrim"></div>`;
  hero.insertBefore(layer, hero.firstChild);
  const fa = layer.querySelector('[data-a]');
  const fb = layer.querySelector('[data-b]');
  const cap = document.createElement('div');
  cap.className = 'scene-caption';
  hero.appendChild(cap);

  let i = Math.floor(Date.now() / (5.5 * 60000)) % ORDER.length; // stable au chargement
  let showA = true;

  const paint = idx => {
    const key = ORDER[idx];
    const front = showA ? fa : fb;
    const back = showA ? fb : fa;
    back.innerHTML = sceneSVG(key, period);
    back.classList.add('on');
    front.classList.remove('on');
    showA = !showA;
    cap.textContent = MOSQUES[key].name;
  };
  paint(i);

  sceneTimer = setInterval(() => {
    if (!document.body.contains(hero)) { clearInterval(sceneTimer); return; }
    i = (i + 1) % ORDER.length;
    paint(i);
  }, 5.5 * 60000);

  return MOSQUES[ORDER[i]].name;
}

export function stopHeroScene() { clearInterval(sceneTimer); }
