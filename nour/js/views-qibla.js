// Qibla : boussole premium. Le cadran (graduations, cardinaux, repère Kaaba
// doré) tourne avec l'orientation de l'iPhone via un ressort amorti (rAF) pour
// une rotation parfaitement fluide avec une légère inertie ; le repère fixe du
// haut représente la direction visée. À l'approche de la Qibla, un halo
// émeraude monte en intensité ; à l'alignement : halo émeraude + doré,
// « Qibla alignée » et une seule vibration courte (réarmée en quittant
// l'alignement).
//
// Vibration & iPhone : Safari iOS ne supporte PAS navigator.vibrate (API
// standard). Depuis iOS 17.4, un léger retour haptique peut être déclenché via
// le commutateur natif (<input type="checkbox" switch>) — utilisé ici en
// repli. Sur un iPhone plus ancien, aucun retour haptique n'est possible dans
// une web app : la limitation est indiquée honnêtement à l'écran.
import { $view, esc, toast } from './app.js';
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

// ---------- retour haptique (une impulsion) ----------
let hapticEl = null;
function hapticTick() {
  if (!state.settings.haptics) return false;
  try {
    if (typeof navigator.vibrate === 'function') { navigator.vibrate(45); return true; }
    // Safari iOS ≥ 17.4 : le commutateur natif produit un léger retour haptique
    if (!hapticEl) {
      hapticEl = document.createElement('label');
      hapticEl.setAttribute('aria-hidden', 'true');
      hapticEl.style.cssText = 'position:fixed;top:-99px;left:-99px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      hapticEl.innerHTML = '<input type="checkbox" switch>';
      document.body.appendChild(hapticEl);
    }
    hapticEl.click();
    return true;
  } catch { return false; }
}

// ---------- cadran SVG : minimaliste et précis ----------
function roseSVG(bearing) {
  const C = 150, R = 150;
  let ticks = '';
  for (let a = 0; a < 360; a += 2) {
    const major = a % 30 === 0;
    const len = major ? 12 : 5;
    const r1 = R - 8, r2 = r1 - len;
    const x1 = C + r1 * Math.sin(rad(a)), y1 = C - r1 * Math.cos(rad(a));
    const x2 = C + r2 * Math.sin(rad(a)), y2 = C - r2 * Math.cos(rad(a));
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
      stroke="${major ? 'var(--ink-2)' : 'var(--ink-3)'}" stroke-width="${major ? 1.8 : 1}" opacity="${major ? .85 : .3}"/>`;
  }
  let nums = '';
  for (let a = 30; a < 360; a += 30) {
    if (a % 90 === 0) continue;
    const r = R - 31;
    const x = C + r * Math.sin(rad(a)), y = C - r * Math.cos(rad(a));
    nums += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central"
      font-size="9.5" fill="var(--ink-3)" opacity=".75" transform="rotate(${a} ${x.toFixed(1)} ${y.toFixed(1)})">${a}</text>`;
  }
  const card = [['N', 0, 'var(--danger)'], ['E', 90, 'var(--ink-2)'], ['S', 180, 'var(--ink-2)'], ['O', 270, 'var(--ink-2)']]
    .map(([l, a, col]) => {
      const r = R - 34;
      const x = C + r * Math.sin(rad(a)), y = C - r * Math.cos(rad(a));
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central"
        font-size="17" font-weight="750" fill="${col}" transform="rotate(${a} ${x.toFixed(1)} ${y.toFixed(1)})">${l}</text>`;
    }).join('');
  // repère Kaaba : goutte dorée sur le cadran, pointe vers le centre
  const kx = C + (R - 22) * Math.sin(rad(bearing)), ky = C - (R - 22) * Math.cos(rad(bearing));
  const lx = C + 30 * Math.sin(rad(bearing)), ly = C - 30 * Math.cos(rad(bearing));
  const kaaba = `
    <line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${kx.toFixed(1)}" y2="${ky.toFixed(1)}"
      stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 6" opacity=".8"/>
    <g transform="translate(${kx.toFixed(1)} ${ky.toFixed(1)}) rotate(${bearing})">
      <path d="M0 -24 C 11 -13, 14 -5, 14 2 A 14 14 0 1 1 -14 2 C -14 -5, -11 -13, 0 -24 Z"
        fill="var(--gold)" stroke="#FFFDFC" stroke-width="1.4" opacity=".97"/>
      <g transform="translate(-8 -6) scale(.66)" stroke="#3C2F05" stroke-width="2" fill="none"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 2.8 8 3.4v11.6l-8 3.4-8-3.4V6.2Z"/><path d="M4 6.2l8 3.4 8-3.4"/><path d="M12 9.6v11.6"/><path d="M4 9.5l8 3.3 8-3.3"/>
      </g>
    </g>`;
  return `<svg viewBox="0 0 300 300" style="position:absolute;inset:0;width:100%;height:100%">
    ${ticks}${nums}${card}${kaaba}</svg>`;
}

let orientationHandler = null;
let rafId = null;

export async function viewQibla() {
  if (orientationHandler) {
    removeEventListener('deviceorientation', orientationHandler, true);
    removeEventListener('deviceorientationabsolute', orientationHandler, true);
    orientationHandler = null;
  }
  cancelAnimationFrame(rafId);
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
  const sens = state.settings.qiblaSens || 4;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const hasVibrateApi = typeof navigator.vibrate === 'function';

  $view.innerHTML = `
    <div class="qibla-hero">
      <div class="row" style="justify-content:space-between;width:100%">
        <a class="backlink" href="#/home" style="color:#f3efe2">${icon('chevL', 15)} Accueil</a>
        <b style="font-size:1.05rem">Qibla</b>
        <span style="width:70px"></span>
      </div>
      <div class="row" style="justify-content:center;flex-wrap:wrap;gap:8px;margin:8px 0 4px">
        <span class="qchip">${icon('location', 13)} ${esc(p.city || `${p.lat}, ${p.lon}`)}</span>
        <span class="qchip">${icon('kaaba', 13)} ${dist.toLocaleString('fr-FR')} km</span>
      </div>

      <div class="compass-wrap">
        <div class="qmark"></div>
        <div class="compass" id="compass">
          <div class="rose" id="rose">${roseSVG(bearing)}</div>
          <div class="hub-face">
            <div class="qdeg" id="qDeg">—</div>
            <div class="qsub" id="qSub">Activez la boussole</div>
          </div>
        </div>
      </div>

      <div class="qaligned-msg" id="qMsg" hidden>Qibla alignée</div>

      <div class="qstats">
        <div class="qstat"><small>Votre cap</small><b id="stCap">—°</b></div>
        <div class="qstat"><small>Qibla</small><b>${Math.round(bearing)}°</b></div>
        <div class="qstat"><small>Écart</small><b id="stEcart">—°</b></div>
        <div class="qstat"><small>Précision</small><b id="stAcc">—</b></div>
      </div>

      <div class="center" style="margin:12px 0 4px">
        <button class="btn" id="btnCompass" style="background:var(--gold);color:#3c2f05;font-weight:800">${icon('compass', 16)} Activer la boussole</button>
      </div>
      <p class="center" id="qStatus" style="opacity:.85;font-size:.88rem;margin:8px 12px">
        La Kaaba est indiquée par le repère doré. Tournez-vous jusqu'à l'amener sous le trait du haut.</p>
    </div>

    <div class="notice" style="margin-top:12px"><b>Calibration :</b> si la direction semble fausse ou si la précision
      est faible, dessinez un « 8 » avec votre téléphone pendant quelques secondes et éloignez-vous des objets
      métalliques. Sans capteur d'orientation, utilisez une boussole classique : la Qibla est à
      <b>${Math.round(bearing)}°</b> par rapport au nord.</div>
    ${isIOS && !hasVibrateApi ? `<div class="notice"><b>Vibration sur iPhone :</b> Safari ne permet pas aux
      applications web d'utiliser la vibration standard. Nour utilise le léger retour haptique de Safari
      (iPhone sous iOS 17.4 ou plus récent). Si votre iPhone est plus ancien, aucune vibration n'est possible
      dans une web app — l'alignement reste signalé par le halo et le message « Qibla alignée ».</div>` : ''}
  `;

  const rose = document.getElementById('rose');
  const compass = document.getElementById('compass');
  const qDeg = document.getElementById('qDeg');
  const qSub = document.getElementById('qSub');
  const qMsg = document.getElementById('qMsg');
  const status = document.getElementById('qStatus');
  const stCap = document.getElementById('stCap');
  const stEcart = document.getElementById('stEcart');
  const stAcc = document.getElementById('stAcc');

  // ---------- lecture des capteurs ----------
  let target = null;     // cap visé (dernier événement capteur)
  let accuracy = null;   // précision boussole (degrés), iOS uniquement
  let gotEvent = false;

  const screenAngle = () => (screen.orientation?.angle ?? window.orientation ?? 0) || 0;

  const onOrient = ev => {
    let heading = null;
    if (typeof ev.webkitCompassHeading === 'number' && !isNaN(ev.webkitCompassHeading) && ev.webkitCompassHeading >= 0) {
      // iOS : cap magnétique horaire depuis le nord (sens déjà correct),
      // compensé par la rotation de l'écran
      heading = (ev.webkitCompassHeading + screenAngle()) % 360;
      if (typeof ev.webkitCompassAccuracy === 'number' && ev.webkitCompassAccuracy >= 0) accuracy = ev.webkitCompassAccuracy;
    } else if (typeof ev.alpha === 'number') {
      // Android / capteur absolu : alpha est anti-horaire → inversion
      heading = (360 - ev.alpha + screenAngle()) % 360;
    }
    if (heading == null) return;
    gotEvent = true;
    target = heading;
  };

  // ---------- animation : ressort amorti (inertie légère, zéro à-coup) ----------
  let shown = null, vel = 0, armed = true, lastPaint = 0;

  function frame() {
    rafId = requestAnimationFrame(frame);
    if (!document.getElementById('compass')) { cancelAnimationFrame(rafId); return; }
    if (target == null) return;
    if (shown == null) { shown = target; }
    // plus court chemin angulaire
    const delta = ((target - shown + 540) % 360) - 180;
    vel = (vel + delta * 0.045) * 0.86;
    shown = (shown + vel + 360) % 360;
    rose.style.transform = `rotate(${-shown}deg)`;

    // limiter les mises à jour de texte (10×/s suffisent)
    const now = performance.now();
    if (now - lastPaint < 100) return;
    lastPaint = now;

    const diff = ((bearing - shown) % 360 + 360) % 360;
    const off = diff > 180 ? 360 - diff : diff;
    const aligned = off < sens;

    // halo progressif à l'approche (à partir de 30°)
    const glow = aligned ? 1 : Math.max(0, 1 - off / 30);
    compass.style.setProperty('--qglow', glow.toFixed(2));
    compass.classList.toggle('aligned', aligned);
    qMsg.hidden = !aligned;

    qDeg.textContent = `${Math.round(shown)}°`;
    qSub.textContent = aligned ? 'Face à la Kaaba' : diff < 180 ? `${Math.round(off)}° à droite` : `${Math.round(off)}° à gauche`;
    stCap.textContent = `${Math.round(shown)}°`;
    stEcart.textContent = `${Math.round(off)}°`;
    stAcc.textContent = accuracy != null
      ? `±${Math.round(accuracy)}°`
      : gotEvent ? 'standard' : '—';
    stAcc.style.color = accuracy != null && accuracy > 30 ? 'var(--gold)' : '';
    status.innerHTML = aligned
      ? `<b style="color:var(--gold)">Qibla alignée — vous êtes face à la Kaaba</b>`
      : `Tournez de <b>${Math.round(off)}°</b> vers la ${diff < 180 ? 'droite' : 'gauche'}${accuracy != null && accuracy > 30 ? '<br><span style="opacity:.75">Précision faible — calibrez la boussole (mouvement en « 8 »)</span>' : ''}`;

    // une seule vibration à l'entrée dans l'alignement ; réarmée après
    // une vraie sortie (hystérésis pour éviter les doubles impulsions)
    if (aligned && armed) { hapticTick(); armed = false; }
    if (!aligned && off > sens + 3) armed = true;
  }

  document.getElementById('btnCompass').onclick = async e => {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') { toast('Accès à l\'orientation refusé'); return; }
      }
      orientationHandler = onOrient;
      addEventListener('deviceorientationabsolute', onOrient, true);
      addEventListener('deviceorientation', onOrient, true);
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(frame);
      e.target.style.display = 'none';
      toast('Boussole activée — tournez-vous lentement');
      setTimeout(() => {
        if (!gotEvent) {
          qDeg.textContent = `${Math.round(bearing)}°`;
          qSub.textContent = 'depuis le nord';
          status.innerHTML = `Aucun capteur d'orientation détecté ici.<br>La Qibla est à <b>${Math.round(bearing)}°</b> par rapport au nord (boussole classique).`;
        }
      }, 3000);
    } catch {
      toast('Boussole indisponible sur cet appareil');
    }
  };
}
