// Bump VERSION on every release so players get the "update available" prompt.
const VERSION = 'lantern-hall-1.0.1';
const ASSETS = ['./', 'index.html', 'style.css?v=1.0.1', 'js/data.js?v=1.0.1', 'js/game.js?v=1.0.1', 'js/ui.js?v=1.0.1',
  'js/main.js?v=1.0.1', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });

// Pages: network first (fresh builds), cache as offline fallback. Assets: cache first (they are versioned).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
