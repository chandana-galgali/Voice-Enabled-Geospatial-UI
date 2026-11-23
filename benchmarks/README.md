# Benchmarks

Headline numbers are in [RESULTS.md](./RESULTS.md).

Serve the repo first (the pages import modules, so they can't be opened as files):

```bash
python -m http.server 8000
```

| What | How |
|---|---|
| Automated speech test (no microphone) | Open `http://localhost:8000/benchmarks/auto-bench.html?set=heldout&voices=indian,us_female`. Takes ~10 minutes. |
| Test with your own voice | Open `http://localhost:8000/benchmarks/bench.html` and read the 24 prompts aloud. |
| Parser test on typed text | `node benchmarks/intent-test.mjs` |

Add `?model=tiny` (or `&model=tiny`) to either page to test Fast mode.
`parser-original.mjs` is a frozen copy of the original hackathon parser, used by `auto-bench.html` for comparison.
