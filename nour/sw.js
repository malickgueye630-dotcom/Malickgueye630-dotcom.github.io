// Service worker Nour — app shell pré-caché + cache à la demande des données.
const VERSION = 'nour-v8';
const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js', 'js/state.js', 'js/data.js', 'js/search.js',
  'js/engine.js', 'js/phonetic.js', 'js/translit.js', 'js/prayer.js', 'js/notify.js',
  'js/icons.js', 'js/views-qibla.js', 'js/views-tasbih.js', 'js/views-more.js', 'js/views-settings.js',
  'js/scenes.js', 'js/views-learn.js', 'js/geo.js', 'data/learn.json',
  'js/vendor/adhan.esm.min.js',
  'js/views-home.js', 'js/views-quran.js', 'js/views-search.js', 'js/views-prayer.js',
  'js/views-hadith.js', 'js/views-duas.js', 'js/views-favorites.js', 'js/views-about.js',
  'fonts/amiri-arabic-400-normal.woff2', 'fonts/amiri-arabic-700-normal.woff2',
  'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'data/quran/index.json', 'data/duas.json', 'data/hadiths_fr.json', 'data/hadith/index.json',
  'data/topics.json', 'data/cities.json', 'data/hadith/chapters_fr.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // audio : réseau uniquement (fichiers volumineux)
  if (url.hostname === 'cdn.islamic.network') return;
  if (url.origin !== location.origin) return;

  // données : cache d'abord (immuables), sinon réseau puis mise en cache
  const isData = url.pathname.includes('/data/');
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached && isData) return cached;
      const network = fetch(e.request).then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => cached);
      return isData ? network : (cached || network);
    })
  );
});
