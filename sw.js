// Bump VERSION on every release so players get the "update available" prompt.
// Scope is the site root, but /classic/ (Lantern Hall v1) has its own worker and caches, so leave it alone.
const PREFIX = 'banner-road-';
const VERSION = PREFIX + '2.0.0';
const V = '?v=2.0.0';
const ASSETS = ['./', 'index.html', `style.css${V}`, ...['data', 'game', 'battle', 'ui', 'draw', 'main'].map((f) => `js/${f}.js${V}`),
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  // Old Banner Road caches and the pre-2.0 root cache ("lantern-hall-*") go; "classic-*" caches are never touched.
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((k) => (k.startsWith(PREFIX) && k !== VERSION) || k.startsWith('lantern-hall-'))
    .map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });

// Pages: network first (fresh builds), cache as offline fallback. Assets: cache first (they are versioned).
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/classic')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
