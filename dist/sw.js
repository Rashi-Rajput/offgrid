importScripts('./offline-assets.js');

const prefix = 'offgrid-shell-' + self.registration.scope + '-';
const cacheName = prefix + self.OFFGRID_ASSETS.version;
const shell = new Set(self.OFFGRID_ASSETS.files.map(file => new URL(file, self.registration.scope).href));
const index = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...shell].map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  url.search = '';
  const home = request.mode === 'navigate' && url.href === self.registration.scope;
  const key = home ? index : url.href;
  if (!shell.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(key) || fetch(request);
  })());
});
