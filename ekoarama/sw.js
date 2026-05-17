/* === EKOGOKHAN SERVICE WORKER (v3) === */
const CACHE_NAME = 'eko-otobus-cache-v3';

// Sadece ana uygulama dosyalarını önbelleğe al
const ASSETS_TO_CACHE = [
  './',
  './index.html'
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
  // Yeni SW'in tüm client'ları hemen sahiplenmesini sağla
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map(k => caches.delete(k)));
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // === DURUM 1: Sadece Kendi Origin'imizdeki Dosyaları İşle ===
  if (url.origin !== self.location.origin) {
    // Kentkart, FontAwesome vb. tüm dış bağlantıları tamamen bypass et
    return;
  }

  // === DURUM 2: Lokal GET İsteklerini İşle ===
  // POST isteklerini ve API/Location pathlerini atla
  if (
    event.request.method !== 'GET' || 
    url.pathname.includes('/api/') || 
    url.pathname.includes('/rl1/') ||
    url.pathname.includes('/location')
  ) {
    return;
  }

  // === DURUM 3: Lokal Dosyalar İçin Cache-First ===
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      
      return fetch(event.request).catch(err => {
        // Fetch tamamen başarısız olursa error fırlat, undefined dönme (kritik hata önleme)
        console.error('SW fetch error:', err);
        throw err;
      });
    })
  );
});
