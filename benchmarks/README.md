# Benchmarks

Ways to measure the project's real metrics instead of estimating them.

| Metric | How to measure | File |
|---|---|---|
| Intent accuracy (text) | `node benchmarks/intent-test.mjs` runs 117 labelled commands through the app's own parser (`commands.js`) | `intent-test.mjs` |
| Speech latency, WER, end-to-end intent accuracy | Serve the repo locally, open `benchmarks/bench.html` in Chrome/Edge, read the 24 prompts aloud | `bench.html` |
| Model download size | Shown in `bench.html`, or DevTools → Network → filter `.onnx` on a cold load | – |
| OSM tag count | Printed at the end of `intent-test.mjs` | – |

## Running bench.html
The page imports `parser.mjs`, so it must be served over http (not opened as a file):

```bash
cd Voice-Enabled-Geospatial-UI
python -m http.server 8000      # or: npx serve, or VS Code Live Server
# open http://localhost:8000/benchmarks/bench.html
```

- For a **cold-load** number, use an Incognito window (the model downloads again).
- For stable latency, close heavy tabs, plug in the laptop, and run all 24 prompts. Report the **median** and **p90**, plus your CPU and browser.
- Click *Download CSV* to keep the raw results.

The benchmark page loads Whisper with the same `speech.js` the app uses. By default it measures the CPU path (the original setup). Add `?device=webgpu` to the URL to measure the experimental GPU path.
