// ==========================================
// WHISPER WEB WORKER
// Runs speech recognition off the main thread, so the map and UI stay responsive
// while a command is being transcribed. Loaded by speech.js.
// ==========================================
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.16.0';

env.allowLocalModels = false;
let transcriber = null;

self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'load') {
      transcriber = await pipeline('automatic-speech-recognition', data.model, {
        progress_callback: p => self.postMessage({ type: 'progress', status: p.status, file: p.file, loaded: p.loaded, total: p.total })
      });
      self.postMessage({ id, type: 'done' });
    } else if (type === 'transcribe') {
      const t0 = performance.now();
      const out = await transcriber(data.audio);
      self.postMessage({ id, type: 'done', text: out.text, inferMs: performance.now() - t0 });
    }
  } catch (err) {
    self.postMessage({ id, type: 'error', error: String(err?.message || err) });
  }
};
