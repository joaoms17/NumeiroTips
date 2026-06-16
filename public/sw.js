/**
 * Service worker do NumeiroTips (PWA).
 *
 * Estratégia conservadora — odds NUNCA são cacheadas (frescura é tudo):
 *  - Pedidos cross-origin (ex.: The Odds API, Supabase) → network-only,
 *    nunca tocados pela cache.
 *  - Navegação (HTML) → network-first, cai na shell em cache se offline.
 *  - Estáticos same-origin (JS/CSS/ícones) → cache-first (têm hash no nome).
 */
const CACHE = 'numeirotips-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // cross-origin (APIs de odds, Supabase, etc.) → nunca cachear
  if (url.origin !== self.location.origin) return;

  // navegação → network-first com fallback à shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // estáticos same-origin → cache-first
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
