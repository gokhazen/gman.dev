/* === EKOGOKHAN UNIFIED SERVICE WORKER (v4) === */
const CACHE_NAME = 'ekogokhan-v4';

const ASSETS_TO_CACHE = [
  './',
  './ekoarama/index.html',
  './ekorota/index.html',
  './ekodata/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Don't fail if all assets don't cache
      return cache.addAll(ASSETS_TO_CACHE).catch(e => console.log('Caching failed:', e));
    })
  );
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass outside requests
  if (url.origin !== self.location.origin) return;

  // Bypass non-GET, API-like paths
  if (
    event.request.method !== 'GET' || 
    url.pathname.includes('/api/') || 
    url.pathname.includes('/rl1/') ||
    url.pathname.includes('/location')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      
      return fetch(event.request).catch(err => {
        console.error('Fetch failed for:', event.request.url);
        throw err;
      });
    })
  );
});
