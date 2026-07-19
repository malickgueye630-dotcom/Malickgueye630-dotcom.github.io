// Notifications — dans les limites réelles d'iOS pour une PWA :
// - Notifications locales fiables tant que l'application est ouverte
//   (vérification chaque minute des échéances configurées).
// - Sur iPhone, les notifications « push » en arrière-plan exigent un serveur
//   push ; Nour étant une application sans serveur, la solution fiable en
//   arrière-plan est l'export calendrier (.ics) avec alarmes, proposé dans
//   les réglages. L'interface l'explique honnêtement.
import { state, save } from './state.js';
import { timesFor, PRAYERS, prayerSettings, hasLocation } from './prayer.js';

export function notifySettings() {
  if (!state.settings.notify) {
    state.settings.notify = {
      enabled: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
      offset: 0, // 0 | -5 | -10 | -15 | -30 (minutes avant)
      extras: { adhkarMatin: false, adhkarSoir: false, kahf: false, jumua: false, duJour: false },
    };
  }
  const n = state.settings.notify;
  if (!('jumua' in n.extras)) n.extras.jumua = false;
  if (!('duJour' in n.extras)) n.extras.duJour = false;
  return n;
}

export const notifSupported = () => 'Notification' in window;
export const notifGranted = () => notifSupported() && Notification.permission === 'granted';

export async function requestPermission() {
  if (!notifSupported()) return 'unsupported';
  try { return await Notification.requestPermission(); }
  catch { return 'denied'; }
}

async function show(title, body) {
  if (!notifGranted()) return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) {
      reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    } else {
      new Notification(title, { body, icon: 'icons/icon-192.png' });
    }
  } catch {}
}

const fired = new Set(); // évite les doublons dans la même session

function checkOnce() {
  const n = notifySettings();
  if (!notifGranted()) return;
  const now = new Date();

  if (hasLocation()) {
    const t = timesFor(now);
    for (const [key, name] of PRAYERS) {
      if (key === 'sunrise' || !n.enabled[key]) continue;
      const target = new Date(t[key].getTime() + (n.offset || 0) * 60000);
      const id = `${key}-${target.toDateString()}-${target.getHours()}:${target.getMinutes()}`;
      const diff = target - now;
      if (diff <= 0 && diff > -60000 && !fired.has(id)) {
        fired.add(id);
        const p = prayerSettings();
        show(`🕌 ${name}${n.offset ? ` dans ${-n.offset} min` : ''}`,
          `${name} à ${t[key].toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${p.city ? ' — ' + p.city : ''}`);
      }
    }
  }

  // rappels facultatifs
  const hm = now.getHours() * 60 + now.getMinutes();
  const extras = [
    ['adhkarMatin', 7 * 60, '🌅 Adhkar du matin', 'Prenez un instant pour vos invocations du matin.'],
    ['adhkarSoir', 18 * 60 + 30, '🌙 Adhkar du soir', 'Prenez un instant pour vos invocations du soir.'],
  ];
  for (const [key, minute, title, body] of extras) {
    if (!n.extras[key]) continue;
    const id = `${key}-${now.toDateString()}`;
    if (hm === minute && !fired.has(id)) { fired.add(id); show(title, body); }
  }
  if (now.getDay() === 5) { // vendredi
    if (n.extras.kahf) {
      const id = `kahf-${now.toDateString()}`;
      if (hm === 10 * 60 && !fired.has(id)) {
        fired.add(id);
        show('C\'est vendredi', 'Lecture recommandée de la sourate Al-Kahf aujourd\'hui.');
      }
    }
    if (n.extras.jumua && hasLocation()) {
      const t = timesFor(now);
      const target = new Date(t.dhuhr.getTime() - 45 * 60000);
      const id = `jumua-${now.toDateString()}`;
      const diff = target - now;
      if (diff <= 0 && diff > -60000 && !fired.has(id)) {
        fired.add(id);
        show('Salat al-Jumu\'ah', 'La prière du vendredi approche — préparez-vous.');
      }
    }
  }
  if (n.extras.duJour) {
    const id = `dujour-${now.toDateString()}`;
    if (hm === 9 * 60 && !fired.has(id)) {
      fired.add(id);
      show('Nour — contenus du jour', 'Découvrez le verset, le hadith et l\'invocation du jour.');
    }
  }
}

let timer = null;
export function startScheduler() {
  if (timer) return;
  checkOnce();
  timer = setInterval(checkOnce, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkOnce(); });
}

export function saveNotify() { save(); }
