# Results

Measured on a Windows laptop (8 CPU threads, 4 GB RAM) in a Chromium-based browser, Whisper running on the CPU
via WebAssembly inside a Web Worker.

| Metric | Result |
|---|---|
| **Intent accuracy** | **91.7%** |
| **Transcription time (median)** | **4.7 s** (Accurate mode) · 2.8 s (Fast mode) |
| **Model download (one-time)** | 77 MB (Accurate, `whisper-base.en`) · 41 MB (Fast, `whisper-tiny.en`) |
| Place categories | 21 OpenStreetMap tags, searched within 3 km |

**How it was measured:** `benchmarks/auto-bench.html?set=heldout` speaks 24 commands that were not used while
building the parser, in an Indian-English and a US-English synthetic voice (48 recordings), runs them through the
app's own Whisper loader (`speech.js`) and parser (`commands.js`), and counts how often the app picks the right action.
Transcription time is measured from audio in to text out.
