/* === EKOGOKHAN SERVICE WORKER (v6) === */
const CACHE_NAME = 'eko-otobus-cache-v6';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  '../ekodata/css/fonts.css',
  '../ekodata/fonts/inter-latin-var.woff2',
  '../ekodata/fonts/inter-latin-ext-var.woff2',
  '../ekodata/fonts/jbmono-latin-var.woff2',
  '../ekodata/fonts/jbmono-latin-ext-var.woff2',
  '../ekodata/fonts/jbmono-latin-italic.woff2',
  '../ekodata/fonts/jbmono-latin-ext-italic.woff2'
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
      return Promise.all(keys.map(k => caches.delete(k)));
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (event.request.method !== 'GET') {
    return;
  }

  if (
    url.pathname.includes('/api/') ||
    url.pathname.includes('/rl1/') ||
    url.pathname.includes('/location') ||
    url.pathname.includes('/stops/') ||
    url.pathname.includes('/routes/') ||
    url.pathname.includes('/models/') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.js')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || !networkResponse.ok) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(err => {
        console.error('SW fetch error:', err);
        throw err;
      });
    })
  );
});
