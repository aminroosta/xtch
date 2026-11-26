// The build injects the cache version and the list of local assets.
const scope = self.registration.scope;
const prefix = 'paperform:' + scope + ':';
const cacheName = prefix + CACHE_VERSION;
const assets = new Set(PRECACHE.map(file => new URL(file, scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll([...assets].map(url => new Request(url, {cache: 'reload'})))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.href.startsWith(scope)) return;
  const key = event.request.mode === 'navigate' ? url.origin + url.pathname : url.href;
  if (!assets.has(key)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(cacheName)).match(key);
    return cached || fetch(event.request);
  })());
});
