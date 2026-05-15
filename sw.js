/**
 * LotusWorks Reconciler Service Worker — network-first with cache fallback.
 * Caches the main app for offline use and notifies the client when updates are available.
 */
const CACHE_NAME = 'reconciler-v1';
const APP_URLS = [
  '/FinanceReconciliation/',
  '/FinanceReconciliation/index.html',
];

// Install — pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_URLS))
  );
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('reconciler-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// Fetch — network-first strategy
self.addEventListener('fetch', (event) => {
  // Only handle same-origin navigation and document requests
  if (event.request.mode !== 'navigate' && !APP_URLS.some((url) => event.request.url.endsWith(url))) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Try network first
        const networkResponse = await fetch(event.request);

        // If successful, update the cache
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          // Clone the response before caching (response body can only be read once)
          const responseToCache = networkResponse.clone();

          // Check if the content changed (compare with cached version)
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) {
            const cachedBody = await cachedResponse.text();
            const newBody = await responseToCache.clone().text();
            if (cachedBody !== newBody) {
              // Content changed — notify all clients
              const clients = await self.clients.matchAll({ type: 'window' });
              clients.forEach((client) => {
                client.postMessage({ type: 'UPDATE_AVAILABLE' });
              });
            }
          }

          await cache.put(event.request, responseToCache);
        }

        return networkResponse;
      } catch {
        // Network failed — fall back to cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // If not in cache either, try the root URL as a fallback
        const fallback = await caches.match('/FinanceReconciliation/');
        if (fallback) {
          return fallback;
        }

        // Last resort — return a basic offline page
        return new Response(
          '<!DOCTYPE html><html><head><title>LotusWorks Reconciler — Offline</title></head>' +
          '<body style="background:#0f1117;color:#e5e7eb;font-family:system-ui;display:flex;' +
          'align-items:center;justify-content:center;min-height:100vh;margin:0">' +
          '<div style="text-align:center"><h1 style="color:#F97316">LotusWorks Reconciler</h1>' +
          '<p>You are offline and the app has not been cached yet.</p>' +
          '<p>Please connect to the internet and reload.</p></div></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      }
    })()
  );
});

// Listen for skip-waiting messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
