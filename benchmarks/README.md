# Benchmarks

Ways to measure the project's real metrics instead of estimating them.

| Metric | How to measure | File |
|---|---|---|
| Intent accuracy (text) | `node benchmarks/intent-test.mjs` runs 63 labelled commands through a copy of the app's parser | `intent-test.mjs`, `parser.mjs` |
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

`parser.mjs` is a side-effect-free copy of `processVoiceCommand()` in `app.js`. If you change the parser in the app, update this copy too.
