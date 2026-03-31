/* === EKOGOKHAN ROOT SERVICE WORKER (v4) === */
const CACHE_NAME = 'ekogokhan-cache-v4';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/ekoarama/index.html',
  '/ekodata/kentkartinfo.json',
  '/ekodata/projectinfo.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  if (
    event.request.method !== 'GET' || 
    url.pathname.includes('/api/') || 
    url.pathname.includes('/rl1/') ||
    url.pathname.includes('/nearest/') ||
    url.pathname.includes('/location')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
