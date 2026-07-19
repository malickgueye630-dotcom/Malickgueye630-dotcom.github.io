// Qibla : direction de la Kaaba avec vraie boussole (orientation de l'iPhone),
// degrés, distance, calibration. Fonctionne aussi sans capteur (direction fixe).
import { $view, esc, toast, vibrate } from './app.js';
import { icon } from './icons.js';
import { prayerSettings, hasLocation, geolocate } from './prayer.js';
import { fold } from './engine.js';

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

let orientationHandler = null;

export async function viewQibla() {
  if (orientationHandler) {
    removeEventListener('deviceorientation', orientationHandler);
    removeEventListener('deviceorientationabsolute', orientationHandler);
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
  const ticks = Array.from({ length: 24 }, (_, i) =>
    `<div class="tick" style="transform:rotate(${i * 15}deg) ${i % 6 === 0 ? 'scaleY(1.6)' : ''}"></div>`).join('');
  const pts = [['N', 0], ['E', 90], ['S', 180], ['O', 270]].map(([l, a]) =>
    `<div class="pt" style="transform:translateX(-50%) rotate(0deg); top:auto; left:auto; inset:0; display:grid; place-items:start center; transform:rotate(${a}deg)"><span style="display:block;margin-top:22px;transform:rotate(${-a}deg)">${l}</span></div>`).join('');

  $view.innerHTML = `
    <a class="backlink" href="#/home">${icon('chevL', 15)} Accueil</a>
    <h1>${icon('kaaba', 24)} Qibla</h1>
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
      <span class="chip">${icon('location', 14)} ${esc(p.city || `${p.lat}, ${p.lon}`)}</span>
      <span class="chip">${icon('compass', 14)} Qibla : <b>&nbsp;${Math.round(bearing)}°</b></span>
      <span class="chip">${icon('kaaba', 14)} ${dist.toLocaleString('fr-FR')} km</span>
    </div>

    <div class="compass-wrap">
      <div class="compass" id="compass">
        <div class="rose" id="rose">
          ${ticks}${pts}
          <div class="kaaba-ind" id="kaabaInd" style="inset:0;display:grid;place-items:start center;transform:rotate(${bearing}deg)">
            <span style="display:block;margin-top:2px">${icon('kaaba', 26)}</span>
          </div>
        </div>
        <div class="needle"></div>
        <div class="hub"></div>
      </div>
    </div>
    <p class="center muted" id="qStatus">La flèche rouge indique le haut de votre téléphone.<br>Alignez-la avec la Kaaba.</p>
    <div class="center" style="margin:10px 0">
      <button class="btn" id="btnCompass">${icon('compass', 16)} Activer la boussole</button>
    </div>
    <div class="notice" id="qNote">📱 Sur iPhone, touchez « Activer la boussole » puis autorisez l'accès à l'orientation.
      <b>Calibration :</b> si la direction semble fausse, dessinez un « 8 » avec votre téléphone pendant quelques
      secondes, éloignez-vous des objets métalliques et aimants, puis réessayez. Sans capteur, utilisez la valeur
      en degrés par rapport au nord (ex. avec une boussole classique).</div>
  `;

  const rose = document.getElementById('rose');
  const compass = document.getElementById('compass');
  const status = document.getElementById('qStatus');
  let lastAligned = false;

  const onOrient = ev => {
    let heading = null;
    if (typeof ev.webkitCompassHeading === 'number' && !isNaN(ev.webkitCompassHeading)) {
      heading = ev.webkitCompassHeading; // iOS : degrés depuis le nord, horaire
    } else if (ev.absolute && typeof ev.alpha === 'number') {
      heading = (360 - ev.alpha) % 360;
    } else if (typeof ev.alpha === 'number') {
      heading = (360 - ev.alpha) % 360; // approximation si non absolu
    }
    if (heading == null) return;
    rose.style.transform = `rotate(${-heading}deg)`;
    let diff = Math.abs(((bearing - heading) % 360 + 360) % 360);
    if (diff > 180) diff = 360 - diff;
    const aligned = diff < 5;
    compass.classList.toggle('aligned', aligned);
    status.innerHTML = aligned
      ? `<b style="color:var(--brand)">✓ Vous êtes orienté vers la Qibla</b>`
      : `Tournez-vous de ${Math.round(diff)}° — la Kaaba est ${((bearing - heading + 360) % 360) < 180 ? 'vers votre droite' : 'vers votre gauche'}.`;
    if (aligned && !lastAligned) vibrate(30);
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
        if (!lastAligned && rose.style.transform === '') {
          status.innerHTML = `Aucun capteur d'orientation détecté sur cet appareil.<br>
            La Qibla est à <b>${Math.round(bearing)}°</b> par rapport au nord.`;
        }
      }, 3000);
    } catch {
      toast('Boussole indisponible sur cet appareil');
    }
  };
}
