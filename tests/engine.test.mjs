import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { infer } from '../dist/engine.js';

const card = { title: 'Cold exposure', steps: [{ instruction: 'Keep warm.' }],
  gear: { jacket: 'Insulation', shirt: 'Dry layer' } };

test('offline index filters equipment and never invents a latency', async () => {
  const result = await infer(card, ['jacket', 'cord', '__proto__']);
  assert.deepEqual(result.gear, { jacket: 'Insulation' });
  assert.equal(result.engine, 'Local index');
  assert.equal(result.ttft, null);
});

test('real Firebase adapter consumes a constrained, simulated Nano stream', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'offgrid-sdk-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(new URL('../dist/vendor/', import.meta.url), join(dir, 'vendor'), { recursive: true });
  await cp(new URL('../dist/engine.js', import.meta.url), join(dir, 'engine.js'));
  await writeFile(join(dir, 'package.json'), '{"type":"module"}');
  await writeFile(join(dir, 'config.js'), `export const firebaseConfig =
    {apiKey:'test', projectId:'test', appId:'test'}, appCheckSiteKey='', cloudModel='test';`);

  let output = '{"items":["jacket"]}';
  const languageModel = {
    availability: async () => 'available',
    create: async () => ({
      promptStreaming(_messages, options) {
        assert.deepEqual(options.responseConstraint.properties.items.items.enum, ['jacket']);
        return new ReadableStream({ start(controller) { controller.enqueue(output); controller.close(); } });
      }
    })
  };
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected network request'); });
  globalThis.window = { LanguageModel: languageModel };
  globalThis.LanguageModel = languageModel;
  t.after(() => { delete globalThis.window; delete globalThis.LanguageModel; });
  const { infer: configured } = await import(pathToFileURL(join(dir, 'engine.js')));
  const result = await configured(card, ['jacket'], 'device');
  assert.equal(result.engine, 'Gemini Nano', result.detail);
  assert.ok(Number.isFinite(result.ttft));
  assert.deepEqual(result.gear, { jacket: 'Insulation' });

  output = '{"items":["paracord"]}';
  const rejected = await configured(card, ['jacket'], 'device');
  assert.equal(rejected.engine, 'Local index');
  assert.equal(rejected.ttft, null);
  assert.deepEqual(rejected.gear, { jacket: 'Insulation' });

  fetchMock.mock.mockImplementation(async (url, init) => {
    assert.match(String(url), /firebasevertexai.googleapis.com/);
    const request = JSON.parse(init.body);
    const schema = request.generationConfig.responseSchema;
    assert.deepEqual(schema.properties.items.items.enum, ['jacket']);
    const chunk = { candidates: [{ index: 0, content: {
      role: 'model', parts: [{ text: '{"items":["jacket"]}' }]
    } }] };
    return new Response('data: ' + JSON.stringify(chunk) + '\n\n', {
      headers: { 'Content-Type': 'text/event-stream' }
    });
  });
  const cloud = await configured(card, ['jacket'], 'cloud');
  assert.equal(cloud.engine, 'Firebase cloud', cloud.detail);
  assert.ok(Number.isFinite(cloud.ttft));
});
