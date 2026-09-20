// Service Worker - BYPASS CACHE VERSION
const CACHE_NAME = 'yoklama-takip-bypass-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Delete all previous caches to ensure a completely fresh start
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Network-First strategy to ensure fresh files are always fetched
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
