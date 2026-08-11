// Edge Blast service worker.
// Strategy: the HTML shell is network-first — an installed PWA should always
// show the latest deploy when online, falling back to the cached shell only
// when offline. Hashed build assets (JS/CSS under /assets/, fingerprinted by
// Vite) are cache-first since a content change always produces a new URL, so
// there's no staleness risk there. Supabase (API/auth/storage) is never
// cached — trade data must always be fresh.

const CACHE_VERSION = 'edge-blast-v2';
const SHELL_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.add(SHELL_URL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never touch Supabase (API, auth, storage) — always hit the network directly.
  if (url.hostname.endsWith('.supabase.co')) return;

  // Cross-origin requests (fonts, TradingView widgets, etc.) — just pass through.
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate' || request.destination === 'document';

  if (isNavigation) {
    // Network-first: always try to get the latest deploy. Only fall back to
    // the cached shell if the network is unavailable (offline).
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(SHELL_URL, clone));
          }
          return response;
        })
        .catch(() => caches.match(SHELL_URL).then((cached) => cached || caches.match(request))),
    );
    return;
  }

  // Static assets: cache-first, refreshing the cache in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    }),
  );
});
