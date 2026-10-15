// Edge Blast service worker.
// Strategy: the HTML shell is network-first — an installed PWA should always
// show the latest deploy when online, falling back to the cached shell only
// when offline. Hashed build assets (JS/CSS under /assets/, fingerprinted by
// Vite) are cache-first since a content change always produces a new URL, so
// there's no staleness risk there. Supabase (API/auth/storage) is never
// cached — trade data must always be fresh.

const CACHE_VERSION = 'edge-blast-v4';
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

  const isNavigation = request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html');

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

// Push: a notification created on the server shows up here even when the app is closed.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_e) { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Edge Blast', {
      body: data.body || '',
      icon: '/icon-192.png',
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || '/notifications' },
    }),
  );
});

// Tapping it opens the app on the right page (reusing a window that is already open).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
          return (c.navigate ? c.navigate(target) : Promise.resolve()).then(() => c.focus()).catch(() => c.focus());
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
