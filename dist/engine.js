import { firebaseConfig, appCheckSiteKey, cloudModel } from './config.js';

let client;

async function connect() {
  const [{ initializeApp }, sdk] = await Promise.all([
    import('./vendor/firebase-app.js'), import('./vendor/firebase-ai.js')
  ]);
  const app = initializeApp(firebaseConfig, 'offgrid-medic');
  if (appCheckSiteKey) {
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('./vendor/firebase-app-check.js');
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey) });
  }
  return { sdk, ai: sdk.getAI(app, { backend: new sdk.GoogleAIBackend() }) };
}

async function generate(protocol, gear, mode, signal) {
  const { sdk, ai } = await (client ??= connect().catch(error => {
    client = undefined;
    throw error;
  }));
  const ids = Object.keys(gear);
  const localSchema = {
    type: 'object', required: ['items'], additionalProperties: false,
    properties: { items: { type: 'array', items: { type: 'string', enum: ids } } }
  };
  const cloudSchema = sdk.Schema.object({ properties: {
    items: sdk.Schema.array({ items: sdk.Schema.enumString({ enum: ids }) })
  } });
  const routes = {
    auto: sdk.InferenceMode.PREFER_ON_DEVICE,
    device: sdk.InferenceMode.ONLY_ON_DEVICE,
    cloud: sdk.InferenceMode.ONLY_IN_CLOUD
  };
  const model = sdk.getGenerativeModel(ai, {
    mode: routes[mode],
    inCloudParams: { model: cloudModel, generationConfig: {
      responseMimeType: 'application/json', responseSchema: cloudSchema, temperature: 0
    } },
    onDeviceParams: {
      createOptions: { signal, expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }] },
      promptOptions: { responseConstraint: localSchema, signal }
    }
  });
  const prompt = `Select available item IDs with an applicable listed use for the training card.
Return only {"items":[...]} using the supplied IDs. Group the most useful items first.
Card: ${protocol.title}
Constraints: ${JSON.stringify(protocol.steps.map(step => step.instruction))}
Allowed available items and uses: ${JSON.stringify(gear)}`;
  const start = performance.now();
  const result = await model.generateContentStream(prompt, { signal, timeout: 8000 });
  let ttft = null;
  const [response] = await Promise.all([result.response, (async () => {
    for await (const chunk of result.stream) {
      if (ttft === null && chunk.text()) ttft = Math.round(performance.now() - start);
    }
  })()]);
  const payload = JSON.parse(response.text());
  if (!Array.isArray(payload?.items) || Object.keys(payload).length !== 1 ||
      payload.items.some(id => typeof id !== 'string' || !Object.hasOwn(gear, id)) ||
      new Set(payload.items).size !== payload.items.length) throw new Error('Invalid mapping');
  const source = response.inferenceSource;
  if (source !== sdk.InferenceSource.ON_DEVICE && source !== sdk.InferenceSource.IN_CLOUD) {
    throw new Error('Missing inference source');
  }
  return {
    gear: Object.fromEntries(payload.items.map(id => [id, gear[id]])),
    engine: source === sdk.InferenceSource.ON_DEVICE ? 'Gemini Nano' : 'Firebase cloud',
    ttft, detail: 'Constrained gear mapping'
  };
}

export async function infer(protocol, selectedGear, mode = 'auto') {
  const selected = new Set(selectedGear);
  const gear = Object.fromEntries(Object.entries(protocol.gear).filter(([id]) => selected.has(id)));
  const local = detail => ({ gear, engine: 'Local index', ttft: null, detail });
  if (!Object.keys(gear).length) return local('No applicable selected gear');
  if (!firebaseConfig) return local('Firebase is unconfigured');
  const offline = globalThis.navigator?.onLine === false;
  if (offline && mode === 'cloud') return local('Cloud is offline');
  const route = offline ? 'device' : mode;
  const controller = new AbortController();
  let timer;
  try {
    if (route === 'device' && !globalThis.LanguageModel) return local('Device model unavailable');
    return await Promise.race([generate(protocol, gear, route, controller.signal),
      new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, 9000);
      })
    ]);
  } catch (error) {
    return local(controller.signal.aborted ? 'Model timed out' : `Model unavailable (${error.code || error.name})`);
  } finally {
    clearTimeout(timer);
  }
}
