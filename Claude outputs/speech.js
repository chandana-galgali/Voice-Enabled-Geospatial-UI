// ==========================================
// WHISPER LOADER: WebGPU when available, WebAssembly (CPU) otherwise
// Shared by app.js and benchmarks/bench.html so both measure the same thing.
// ==========================================
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2';

env.allowLocalModels = false;
export const MODEL_ID = 'Xenova/whisper-base.en';

async function detectWebGPU() {
  if (!('gpu' in navigator)) return null;
  try { return await navigator.gpu.requestAdapter(); } catch { return null; }
}

// Precision per device (files that exist in the Xenova/whisper-base.en repo):
//  - WebGPU:     encoder fp32 (83 MB) + decoder q4 (124 MB)
//  - WASM / CPU:            encoder q8 (23 MB)   + decoder q8 (54 MB)  <- same files as the original app
function optionsFor(device, adapter) {
  if (device === 'webgpu') {
    // fp16 encoder / q4f16 decoder produced garbled transcripts, so use the combination
    // Hugging Face's own Whisper WebGPU examples use.
    return { device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' } };
  }
  return { device: 'wasm', dtype: 'q8' };
}

// preferred: 'auto' | 'webgpu' | 'wasm'. Override from the URL with ?device=wasm for benchmarking.
export async function loadTranscriber(preferred = 'auto', onStatus = () => {}) {
  const urlPref = new URLSearchParams(location.search).get('device');
  const want = urlPref || preferred;
  const adapter = want === 'wasm' ? null : await detectWebGPU();
  const order = adapter ? ['webgpu', 'wasm'] : ['wasm'];

  let lastErr;
  for (const device of order) {
    const opts = optionsFor(device, adapter);
    try {
      onStatus(`Loading AI (${device === 'webgpu' ? 'GPU' : 'CPU'})...`);
      const transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, opts);
      // Warm-up on 1 s of silence: the first inference compiles shaders / WASM and is very slow,
      // so do it now instead of on the user's first command.
      onStatus('Warming up AI...');
      await transcriber(new Float32Array(16000));
      return { transcriber, device, dtype: opts.dtype };
    } catch (err) {
      console.warn(`Whisper failed on ${device}, trying next option`, err);
      lastErr = err;
    }
  }
  throw lastErr;
}
