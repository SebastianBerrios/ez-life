/* Generated per production build. Only the public shell and own static assets. */
const CACHE = 'ez-life-__BUILD_ID__';
const ASSETS = __ASSETS__;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('ez-life-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.search || !(url.pathname === '/' || ASSETS.includes(url.pathname))) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') {
      try { return await fetch(event.request); }
      catch { return (await cache.match('/')) || Response.error(); }
    }
    return (await cache.match(url.pathname)) || fetch(event.request);
  })());
});
