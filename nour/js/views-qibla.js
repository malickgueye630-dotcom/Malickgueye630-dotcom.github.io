// Qibla : boussole plein écran, précise et animée. La rose (graduations,
// cardinaux, marqueur Kaaba doré) tourne avec l'orientation de l'iPhone ;
// l'aiguille fixe représente le haut du téléphone. Alignement → halo + vibration.
import { $view, esc, toast, vibrate } from './app.js';
import { icon } from './icons.js';
import { state } from './state.js';
import { prayerSettings, hasLocation, geolocate } from './prayer.js';

const KAABA = { lat: 21.4225, lon: 39.8262 };
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;

function qiblaBearing(lat, lon) {
  const φ = rad(lat), φk = rad(KAABA.lat), Δλ = rad(KAABA.lon - lon);
  const θ = Math.atan2(Math.sin(Δλ) * Math.cos(φk),
    Math.cos(φ) * Math.sin(φk) - Math.sin(φ) * Math.cos(φk) * Math.cos(Δλ));
  return (deg(θ) + 360) % 360;
}
function kaabaDistance(lat, lon) {
  const R = 6371;
  const dφ = rad(KAABA.lat - lat), dλ = rad(KAABA.lon - lon);
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(KAABA.lat)) * Math.sin(dλ / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// rose des vents SVG : graduations fines, chiffres tous les 30°, cardinaux
function roseSVG(bearing) {
  const C = 150, R = 150;
  let ticks = '';
  for (let a = 0; a < 360; a += 3) {
    const major = a % 30 === 0, mid = a % 15 === 0;
    const len = major ? 14 : mid ? 9 : 5;
    const r1 = R - 6, r2 = r1 - len;
    const x1 = C + r1 * Math.sin(rad(a)), y1 = C - r1 * Math.cos(rad(a));
    const x2 = C + r2 * Math.sin(rad(a)), y2 = C - r2 * Math.cos(rad(a));
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
      stroke="${major ? 'var(--ink-2)' : 'var(--ink-3)'}" stroke-width="${major ? 2 : 1}" opacity="${major ? .9 : .45}"/>`;
  }
  let nums = '';
  for (let a = 0; a < 360; a += 30) {
    if (a % 90 === 0) continue;
    const r = R - 32;
    const x = C + r * Math.sin(rad(a)), y = C - r * Math.cos(rad(a));
    nums += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central"
      font-size="11" fill="var(--ink-3)" transform="rotate(${a} ${x.toFixed(1)} ${y.toFixed(1)})">${a}</text>`;
  }
  const card = [['N', 0, 'var(--danger)'], ['E', 90, 'var(--ink-2)'], ['S', 180, 'var(--ink-2)'], ['O', 270, 'var(--ink-2)']]
    .map(([l, a, col]) => {
      const r = R - 34;
      const x = C + r * Math.sin(rad(a)), y = C - r * Math.cos(rad(a));
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central"
        font-size="19" font-weight="800" fill="${col}" transform="rotate(${a} ${x.toFixed(1)} ${y.toFixed(1)})">${l}</text>`;
    }).join('');
  // marqueur Kaaba : pastille dorée sur le cercle, à l'azimut de la qibla
  const kx = C + (R - 6) * Math.sin(rad(bearing)), ky = C - (R - 6) * Math.cos(rad(bearing));
  const lx = C + 26 * Math.sin(rad(bearing)), ly = C - 26 * Math.cos(rad(bearing));
  const kaaba = `
    <line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${kx.toFixed(1)}" y2="${ky.toFixed(1)}"
      stroke="var(--gold)" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7" opacity=".9"/>
    <g transform="translate(${kx.toFixed(1)} ${ky.toFixed(1)})">
      <circle r="17" fill="var(--gold)"/>
      <circle r="17" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/>
      <g transform="translate(-9 -9) scale(.75)" stroke="#3c2f05" stroke-width="1.9" fill="none"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 2.8 8 3.4v11.6l-8 3.4-8-3.4V6.2Z"/><path d="M4 6.2l8 3.4 8-3.4"/><path d="M12 9.6v11.6"/><path d="M4 9.5l8 3.3 8-3.3"/>
      </g>
    </g>`;
  return `<svg viewBox="0 0 300 300" style="position:absolute;inset:0;width:100%;height:100%">
    ${ticks}${nums}${card}${kaaba}</svg>`;
}

let orientationHandler = null;

export async function viewQibla() {
  if (orientationHandler) {
    removeEventListener('deviceorientation', orientationHandler, true);
    removeEventListener('deviceorientationabsolute', orientationHandler, true);
    orientationHandler = null;
  }
  const p = prayerSettings();

  if (!hasLocation()) {
    $view.innerHTML = `
      <a class="backlink" href="#/home">${icon('chevL', 15)} Accueil</a>
      <h1>${icon('kaaba', 24)} Qibla</h1>
      <div class="card center" style="padding:26px 18px">
        <p style="margin:0 0 14px"><b>Localisation nécessaire</b><br>
        <span class="muted">pour calculer la direction de la Kaaba depuis chez vous</span></p>
        <div class="row" style="justify-content:center;gap:10px">
          <button class="btn" id="btnGeo">${icon('location', 16)} Ma position</button>
          <a class="btn btn-ghost" href="#/prayer" style="text-decoration:none">Choisir une ville</a>
        </div>
      </div>`;
    document.getElementById('btnGeo').onclick = async e => {
      e.target.textContent = '…';
      try { await geolocate(); viewQibla(); }
      catch { toast('Géolocalisation refusée — choisissez une ville dans Prières'); }
    };
    return;
  }

  const bearing = qiblaBearing(p.lat, p.lon);
  const dist = kaabaDistance(p.lat, p.lon);

  $view.innerHTML = `
    <div class="qibla-hero">
      <div class="row" style="justify-content:space-between;width:100%">
        <a class="backlink" href="#/home" style="color:#f3efe2">${icon('chevL', 15)} Accueil</a>
        <b style="font-size:1.05rem">Qibla</b>
        <span style="width:70px"></span>
      </div>
      <div class="row" style="justify-content:center;flex-wrap:wrap;gap:8px;margin:8px 0 4px">
        <span class="qchip">${icon('location', 13)} ${esc(p.city || `${p.lat}, ${p.lon}`)}</span>
        <span class="qchip">${icon('compass', 13)} ${Math.round(bearing)}°</span>
        <span class="qchip">${icon('kaaba', 13)} ${dist.toLocaleString('fr-FR')} km</span>
        <span class="qchip" id="qSigChip" hidden>Signal <span class="qsignal" id="qSig"><i></i><i></i><i></i></span></span>
      </div>

      <div class="compass-wrap">
        <div class="qneedle">${icon('chevR', 22)}</div>
        <div class="compass" id="compass">
          <div class="rose" id="rose">${roseSVG(bearing)}</div>
          <div class="hub-face">
            <div class="qdeg" id="qDeg">—°</div>
            <div class="qsub" id="qSub">Activez la boussole</div>
          </div>
        </div>
      </div>

      <div class="center" style="margin:6px 0 4px">
        <button class="btn" id="btnCompass" style="background:var(--gold);color:#3c2f05;font-weight:800">${icon('compass', 16)} Activer la boussole</button>
      </div>
      <p class="center" id="qStatus" style="opacity:.85;font-size:.88rem;margin:8px 12px">
        La Kaaba est indiquée en doré sur le cadran. Tournez-vous jusqu'à l'aligner avec le repère du haut.</p>
    </div>
    <div class="notice" style="margin-top:12px"><b>Calibration :</b> si la direction semble fausse, dessinez un « 8 »
      avec votre téléphone pendant quelques secondes, éloignez-vous des objets métalliques, puis réessayez.
      Sans capteur d'orientation, utilisez la valeur en degrés par rapport au nord (boussole classique) :
      <b>${Math.round(bearing)}°</b>.</p>
  `;

  const rose = document.getElementById('rose');
  const compass = document.getElementById('compass');
  const qDeg = document.getElementById('qDeg');
  const qSub = document.getElementById('qSub');
  const status = document.getElementById('qStatus');
  const sigChip = document.getElementById('qSigChip');
  const sig = document.getElementById('qSig');
  const sensibility = state.settings.qiblaSens || 4;
  let lastAligned = false, gotEvent = false, smooth = null;

  const onOrient = ev => {
    let heading = null;
    if (typeof ev.webkitCompassHeading === 'number' && !isNaN(ev.webkitCompassHeading)) {
      heading = ev.webkitCompassHeading;
    } else if (typeof ev.alpha === 'number') {
      heading = (360 - ev.alpha) % 360;
    }
    if (heading == null) return;
    gotEvent = true;
    // qualité du signal : précision boussole iOS si disponible, sinon absolue/relative
    sigChip.hidden = false;
    const acc = typeof ev.webkitCompassAccuracy === 'number' && ev.webkitCompassAccuracy >= 0 ? ev.webkitCompassAccuracy : null;
    const level = acc != null ? (acc <= 15 ? 3 : acc <= 35 ? 2 : 1) : (ev.absolute || ev.webkitCompassHeading != null ? 2 : 1);
    sig.className = `qsignal s${level}`;
    // lissage angulaire léger pour une rotation naturelle
    if (smooth == null) smooth = heading;
    else {
      let d = ((heading - smooth + 540) % 360) - 180;
      smooth = (smooth + d * 0.25 + 360) % 360;
    }
    rose.style.transform = `rotate(${-smooth}deg)`;
    let diff = ((bearing - smooth) % 360 + 360) % 360;
    const off = diff > 180 ? 360 - diff : diff;
    const aligned = off < sensibility;
    compass.classList.toggle('aligned', aligned);
    qDeg.textContent = `${Math.round(smooth)}°`;
    qSub.textContent = aligned ? 'Face à la Qibla' : diff < 180 ? `${Math.round(off)}° à droite` : `${Math.round(off)}° à gauche`;
    status.innerHTML = aligned
      ? `<b style="color:var(--gold)">✓ Vous êtes aligné avec la Qibla</b>`
      : `Tournez ${diff < 180 ? 'à droite' : 'à gauche'} de ${Math.round(off)}° pour faire face à la Kaaba.`;
    if (aligned && !lastAligned) vibrate(35);
    lastAligned = aligned;
  };

  document.getElementById('btnCompass').onclick = async e => {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') { toast('Accès à l\'orientation refusé'); return; }
      }
      orientationHandler = onOrient;
      addEventListener('deviceorientationabsolute', onOrient, true);
      addEventListener('deviceorientation', onOrient, true);
      e.target.style.display = 'none';
      toast('Boussole activée — tournez-vous lentement');
      setTimeout(() => {
        if (!gotEvent) {
          qDeg.textContent = `${Math.round(bearing)}°`;
          qSub.textContent = 'depuis le nord';
          status.innerHTML = `Aucun capteur d'orientation détecté ici.<br>La Qibla est à <b>${Math.round(bearing)}°</b> par rapport au nord.`;
        }
      }, 3000);
    } catch {
      toast('Boussole indisponible sur cet appareil');
    }
  };
}
