// ==========================================
// WHISPER LOADER
// Whisper runs in a Web Worker (whisper-worker.js) on the CPU via WebAssembly, using the
// quantised (q8) English-only models. Shared by app.js and the benchmark pages.
//
//   'base' (default): Xenova/whisper-base.en  - more accurate
//   'tiny':           Xenova/whisper-tiny.en  - smaller download, faster, less accurate
// Override from the URL with ?model=tiny or ?model=base.
// ==========================================
export const MODELS = {
  base: { id: 'Xenova/whisper-base.en', label: 'Accurate (Whisper base)' },
  tiny: { id: 'Xenova/whisper-tiny.en', label: 'Fast (Whisper tiny)' },
};

export async function loadTranscriber(preferred = 'base', onStatus = () => {}) {
  const key = new URLSearchParams(location.search).get('model') || preferred;
  const model = MODELS[key] ? key : 'base';

  const worker = new Worker(new URL('./whisper-worker.js', import.meta.url), { type: 'module' });
  let nextId = 0;
  const pending = new Map();
  const files = {};   // download progress per file

  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') {
      if (data.file && data.total) files[data.file] = { loaded: data.loaded ?? 0, total: data.total };
      if (data.status === 'progress') {
        const all = Object.values(files);
        const loaded = all.reduce((a, f) => a + f.loaded, 0), total = all.reduce((a, f) => a + f.total, 0);
        if (total > 1e6) onStatus(`Downloading AI model… ${Math.round(100 * loaded / total)}% of ${(total / 1e6).toFixed(0)} MB`);
      }
      return;
    }
    const p = pending.get(data.id);
    if (!p) return;
    pending.delete(data.id);
    data.type === 'error' ? p.reject(new Error(data.error)) : p.resolve(data);
  };
  worker.onerror = e => { for (const p of pending.values()) p.reject(new Error(e.message || 'Worker error')); pending.clear(); };

  const call = (msg) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...msg, id });
  });

  onStatus(`Loading AI (${MODELS[model].label})…`);
  await call({ type: 'load', model: MODELS[model].id });

  // Same call shape as a transformers.js pipeline: await transcriber(Float32Array) -> { text, inferMs }
  const transcriber = (audio) => call({ type: 'transcribe', audio });

  // Warm-up on 1 s of silence: the first inference compiles the WASM kernels and is very slow,
  // so pay that cost during loading instead of on the user's first command.
  onStatus('Warming up AI (first run is slow)…');
  await transcriber(new Float32Array(16000));

  const downloadedMB = Object.values(files).reduce((a, f) => a + f.total, 0) / 1e6;
  return { transcriber, model, modelId: MODELS[model].id, label: MODELS[model].label, device: 'wasm', dtype: 'q8', downloadedMB, worker };
}
