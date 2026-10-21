// Jewel Factory service worker — deliberately minimal.
//
// It exists so the site is installable as an app. It caches ONLY Next.js's
// content-hashed build files and the app icons; pages, /api/*, carts,
// favorites and S3/CloudFront images always go to the network, so nobody ever
// sees stale data or an outdated app after a deploy.
//
// Kill switch: if this ever misbehaves in production, replace this file's
// whole body with the two lines below and deploy — every installed copy
// unregisters itself on its next visit:
//   self.addEventListener('install', () => self.skipWaiting());
//   self.addEventListener('activate', () => self.registration.unregister());

const CACHE = 'jf-static-v1';

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline | Jewel Factory</title>
<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#17120b;color:#fffaf0;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px}
img{width:96px;height:96px}button{margin-top:8px;background:#c9a84c;color:#17120b;border:0;border-radius:999px;padding:10px 22px;font-weight:600;font-size:14px}</style></head>
<body><img src="/icons/icon-192.png" alt=""><h1 style="font-size:20px;margin:0">You're offline</h1>
<p style="margin:0;color:#c8bba6;font-size:14px">Check your internet connection and try again.</p>
<button onclick="location.reload()">Try again</button></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/icons/icon-192.png')).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('jf-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page loads: always the network; a small offline screen only when it fails.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
    );
    return;
  }

  // Hashed build output + icons never change under the same URL, so
  // cache-first is safe. Everything else falls through to the network.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((hit) =>
          hit || fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }),
        ),
      ),
    );
  }
});
