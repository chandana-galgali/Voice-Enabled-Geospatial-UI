// ==========================================
// WHISPER LOADER
// Default: the original, known-working setup (Transformers.js 2.16, CPU/WebAssembly, q8 model).
// Opt-in:  ?device=webgpu tries the GPU via Transformers.js v3 and falls back to the default.
// Shared by app.js and benchmarks/bench.html so both measure the same thing.
// ==========================================
export const MODEL_ID = 'Xenova/whisper-base.en';

async function loadCPU() {
  const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.16.0');
  env.allowLocalModels = false;
  return { transcriber: await pipeline('automatic-speech-recognition', MODEL_ID), device: 'wasm', dtype: 'q8' };
}

async function loadGPU() {
  if (!('gpu' in navigator) || !(await navigator.gpu.requestAdapter().catch(() => null))) throw new Error('WebGPU not available');
  const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2');
  env.allowLocalModels = false;
  const dtype = { encoder_model: 'fp32', decoder_model_merged: 'q4' };
  return { transcriber: await pipeline('automatic-speech-recognition', MODEL_ID, { device: 'webgpu', dtype }), device: 'webgpu', dtype };
}

// preferred: 'wasm' (default) | 'webgpu'. The URL (?device=webgpu / ?device=wasm) overrides it.
export async function loadTranscriber(preferred = 'wasm', onStatus = () => {}) {
  const want = new URLSearchParams(location.search).get('device') || preferred;
  let loaded = null;
  if (want === 'webgpu') {
    try { onStatus('Loading AI (GPU)...'); loaded = await loadGPU(); }
    catch (err) { console.warn('WebGPU Whisper failed, falling back to CPU', err); }
  }
  if (!loaded) { onStatus('Loading AI (CPU)...'); loaded = await loadCPU(); }

  // Warm-up on 1 s of silence: the first inference is very slow (WASM/shader compile),
  // so pay that cost now instead of on the user's first command.
  onStatus('Warming up AI (first run is slow)...');
  await loaded.transcriber(new Float32Array(16000));
  return loaded;
}
