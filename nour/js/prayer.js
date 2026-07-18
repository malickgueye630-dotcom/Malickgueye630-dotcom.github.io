// Horaires de prière — calcul local avec la bibliothèque adhan (MIT),
// selon la position, la méthode de calcul et le madhhab choisis.
// Les horaires dépendent de la méthode et de la localisation : ils sont
// indicatifs — l'utilisateur peut choisir la méthode de sa mosquée et
// appliquer des ajustements manuels.
import * as adhan from './vendor/adhan.esm.min.js';
import { state, save } from './state.js';

export const METHODS = [
  { id: 'F12', name: 'Angle 12° (Musulmans de France)', note: 'Utilisée par de nombreuses mosquées en France' },
  { id: 'F15', name: 'Angle 15°', note: 'Variante utilisée en Europe' },
  { id: 'MWL', name: 'Ligue Islamique Mondiale (18°/17°)', note: 'Méthode répandue en Europe et en Afrique' },
  { id: 'UOIF18', name: 'Angle 18°', note: 'Fajr et Isha à 18°' },
  { id: 'Egyptian', name: 'Autorité égyptienne', note: 'Égypte, Afrique' },
  { id: 'UmmAlQura', name: 'Umm al-Qura (La Mecque)', note: 'Arabie saoudite' },
  { id: 'NorthAmerica', name: 'ISNA (Amérique du Nord)', note: 'États-Unis, Canada' },
  { id: 'MoonsightingCommittee', name: 'Moonsighting Committee', note: 'Hautes latitudes' },
  { id: 'Turkey', name: 'Diyanet (Turquie)', note: 'Turquie' },
  { id: 'Karachi', name: 'Université de Karachi', note: 'Asie du Sud' },
];

export const PRAYERS = [
  ['fajr', 'Fajr'], ['sunrise', 'Chourouq'], ['dhuhr', 'Dhuhr'],
  ['asr', 'Asr'], ['maghrib', 'Maghrib'], ['isha', 'Isha'],
];

export function prayerSettings() {
  if (!state.settings.prayer) {
    state.settings.prayer = {
      lat: null, lon: null, city: null,
      method: 'F12', madhab: 'shafi',
      adjust: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
    };
  }
  return state.settings.prayer;
}

function params() {
  const p = prayerSettings();
  let cp;
  switch (p.method) {
    case 'F12': cp = new adhan.CalculationParameters(null, 12, 12); break;
    case 'F15': cp = new adhan.CalculationParameters(null, 15, 15); break;
    case 'UOIF18': cp = new adhan.CalculationParameters(null, 18, 18); break;
    case 'Egyptian': cp = adhan.CalculationMethod.Egyptian(); break;
    case 'UmmAlQura': cp = adhan.CalculationMethod.UmmAlQura(); break;
    case 'NorthAmerica': cp = adhan.CalculationMethod.NorthAmerica(); break;
    case 'MoonsightingCommittee': cp = adhan.CalculationMethod.MoonsightingCommittee(); break;
    case 'Turkey': cp = adhan.CalculationMethod.Turkey(); break;
    case 'Karachi': cp = adhan.CalculationMethod.Karachi(); break;
    default: cp = adhan.CalculationMethod.MuslimWorldLeague();
  }
  cp.madhab = p.madhab === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  cp.adjustments = { ...p.adjust };
  return cp;
}

export function hasLocation() {
  const p = prayerSettings();
  return p.lat != null && p.lon != null;
}

export function timesFor(date = new Date()) {
  const p = prayerSettings();
  if (!hasLocation()) return null;
  const coords = new adhan.Coordinates(p.lat, p.lon);
  const pt = new adhan.PrayerTimes(coords, date, params());
  return {
    fajr: pt.fajr, sunrise: pt.sunrise, dhuhr: pt.dhuhr,
    asr: pt.asr, maghrib: pt.maghrib, isha: pt.isha,
  };
}

// prochaine prière (aujourd'hui, sinon fajr de demain)
export function nextPrayer(now = new Date()) {
  const t = timesFor(now);
  if (!t) return null;
  for (const [key, name] of PRAYERS) {
    if (key === 'sunrise') continue;
    if (t[key] > now) return { key, name, time: t[key] };
  }
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const t2 = timesFor(tomorrow);
  return { key: 'fajr', name: 'Fajr', time: t2.fajr };
}

export const fmtTime = d => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function fmtCountdown(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60), mm = m % 60;
  return h ? `${h} h ${String(mm).padStart(2, '0')} min` : `${mm} min`;
}

export function setLocation(lat, lon, city) {
  const p = prayerSettings();
  p.lat = Math.round(lat * 10000) / 10000;
  p.lon = Math.round(lon * 10000) / 10000;
  p.city = city || null;
  save();
}

export function geolocate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Géolocalisation non disponible'));
    navigator.geolocation.getCurrentPosition(
      pos => { setLocation(pos.coords.latitude, pos.coords.longitude, 'Ma position'); resolve(pos); },
      err => reject(err),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }
    );
  });
}

// ---- export calendrier (.ics) : horaires + alarmes, solution fiable sur iPhone ----
export function buildICS(days = 30) {
  const p = prayerSettings();
  if (!hasLocation()) return null;
  const n = state.settings.notify || {};
  const offset = n.offset || 0;
  const pad = x => String(x).padStart(2, '0');
  const dt = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nour//Horaires de priere//FR', 'CALSCALE:GREGORIAN'];
  const start = new Date();
  for (let i = 0; i < days; i++) {
    const day = new Date(start); day.setDate(start.getDate() + i);
    const t = timesFor(day);
    for (const [key, name] of PRAYERS) {
      if (key === 'sunrise') continue;
      if (n.enabled && !n.enabled[key]) continue;
      const time = t[key];
      const end = new Date(time.getTime() + 10 * 60000);
      lines.push('BEGIN:VEVENT',
        `UID:nour-${key}-${dt(time)}@nour`,
        `DTSTART:${dt(time)}`,
        `DTEND:${dt(end)}`,
        `SUMMARY:🕌 ${name}${p.city ? ' — ' + p.city : ''}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${name}`,
        `TRIGGER:-PT${Math.abs(offset)}M`, 'END:VALARM',
        'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
