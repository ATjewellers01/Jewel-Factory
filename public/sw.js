// Service Worker for jewelfactory.ai PWA
const CACHE_NAME = 'jewelfactory-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/logo-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

// Install: Cache core static assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Pre-caching static assets failed:', err);
      }),
  );
});

// Activate: Clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never cache non-HTTP(S) schemes (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) return;

  // 2. Never cache API routes, auth endpoints, Next.js data/actions, or external uploads
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/data/') ||
    url.hostname.includes('cloudinary') ||
    url.hostname.includes('amazonaws')
  ) {
    return;
  }

  // 3. Navigation requests (HTML pages): Network-first with offline fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If response is valid, clone to cache for offline use
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback
          const cached = await caches.match(request);
          if (cached) return cached;
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline | Jewel Factory</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:sans-serif;background:#fbf8f1;color:#211c17;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:24px;text-align:center;"><div><h1 style="color:#c99d37;margin-bottom:8px;">Jewel Factory</h1><p style="margin-bottom:16px;">You are currently offline. Please check your internet connection.</p><button onclick="window.location.reload()" style="background:#c99d37;color:#fff;border:none;padding:10px 20px;border-radius:9999px;font-weight:600;cursor:pointer;">Retry</button></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } },
          );
        }),
    );
    return;
  }

  // 4. Static assets (_next/static, images, fonts, icons): Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.avif') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      }),
    );
    return;
  }
});

// Support skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
