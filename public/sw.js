// Edge Blast service worker.
// Strategy: cache the app shell (HTML/JS/CSS/icons) so the app opens instantly
// and works offline for navigation. Never cache Supabase API/auth/storage
// calls — trade data must always be fresh and network-first.

const CACHE_VERSION = 'edge-blast-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {}),
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

  // App shell / static assets: cache-first, falling back to network,
  // and refreshing the cache in the background.
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
