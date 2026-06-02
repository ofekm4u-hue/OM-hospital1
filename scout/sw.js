/* Scout SW — offline-first PWA shell
 *
 * Strategy:
 *  - HTML pages: network-first (fast online, falls back to cache offline)
 *  - Static assets (JS/CSS/SVG/manifest): cache-first (immutable shell)
 *  - Leaflet CDN: cache-on-use (works offline once visited)
 *  - localStorage data (everything ScoutDB) is unaffected — lives in the browser
 *    and isn't cached by SW.
 *
 * Bump CACHE_VERSION on every release so old shells get cleaned up.
 */
const CACHE_VERSION = 'scout-v7';
const STATIC_CACHE = CACHE_VERSION + '-static';
const HTML_CACHE   = CACHE_VERSION + '-html';
const CDN_CACHE    = CACHE_VERSION + '-cdn';

const PRECACHE_URLS = [
  './',
  './index.html',
  './home.html',
  './onboarding.html',
  './hq-operator.html',
  './gate-guard.html',
  './tribe.html',
  './clinic.html',
  './kabat.html',
  './economy.html',
  './sanitation.html',
  './campmap.html',
  './shared/engine.js',
  './shared/tokens.css',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isHTML(req) {
  return req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
}

function isLeafletCDN(url) {
  return url.hostname === 'unpkg.com' && url.pathname.includes('leaflet');
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // HTML: network-first so updates ship fast
  if (isHTML(req)) {
    event.respondWith(
      fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(HTML_CACHE).then(c => c.put(req, copy));
        return resp;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Leaflet CDN: cache-on-use so the editor works offline after first visit
  if (isLeafletCDN(url)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CDN_CACHE).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => cached))
    );
    return;
  }

  // Same-origin static assets: cache-first with background refresh
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        const networked = fetch(req).then(resp => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(STATIC_CACHE).then(c => c.put(req, copy));
          }
          return resp;
        }).catch(() => cached);
        return cached || networked;
      })
    );
  }
});
