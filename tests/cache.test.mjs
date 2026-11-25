import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('a primed worker serves the field console and all indexed assets offline', async () => {
  const scope = 'https://example.test/medic/';
  const handlers = {}, stored = new Map(), self = {
    registration: { scope }, addEventListener: (type, handler) => { handlers[type] = handler; },
    clients: { claim: async () => {} }, skipWaiting: async () => {}
  };
  const manifest = await readFile(new URL('../dist/offline-assets.js', import.meta.url), 'utf8');
  const cache = {
    async addAll(requests) {
      for (const request of requests) {
        const path = request.url.slice(scope.length);
        const body = await readFile(new URL('../dist/' + path, import.meta.url));
        stored.set(request.url, new Response(body));
      }
    },
    async match(key) { return stored.get(key)?.clone(); }
  };
  const caches = { open: async () => cache, keys: async () => [] };
  const sw = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8');
  runInNewContext(sw, { self, URL, Request, caches, fetch: () => { throw Error('offline'); },
    importScripts: () => runInNewContext(manifest, { self }) });
  let work;
  handlers.install({ waitUntil: job => { work = job; } });
  await work;
  handlers.activate({ waitUntil: job => { work = job; } });
  await work;
  function request(url, mode) {
    let result;
    handlers.fetch({ request: { url, mode, method: 'GET' }, respondWith: job => { result = job; } });
    return result;
  }
  assert.match(await (await request(scope, 'navigate')).text(), /OffGrid Medic/);
  for (const entry of ['app.js', 'clinical.js', 'audio.js', 'engine.js', 'terrain.js', 'ui.css']) {
    assert.ok(self.OFFGRID_ASSETS.files.includes(entry), 'Missing offline asset ' + entry);
  }
  for (const file of self.OFFGRID_ASSETS.files) {
    assert.equal((await request(scope + file)).status, 200);
  }
  assert.equal(request('https://example.test/another-app/'), undefined);
  assert.equal(request('https://example.org/medic/index.html'), undefined);
});
