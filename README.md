# Trafaret

A node-based editor for reusable AI-image recipes: wire prompts, photos and style presets into a graph, run it,
and re-run only what changed. Work in progress — the design lives in
[docs/specs](docs/specs/2026-10-08-trafaret-design.md).

## Run it locally (no keys needed)

```bash
pnpm install
pnpm dev
```

The editor opens at `http://127.0.0.1:5173` and talks to the API on `http://127.0.0.1:8080` through Vite's proxy.
The Mock models work without any API key; copy `.env.example` to `.env` and add a key to enable FLUX.2 klein
(Cloudflare Workers AI) or Seedream 4.5 (BytePlus).

## Tests

```bash
pnpm test                              # unit tests: core, server and editor
pnpm exec playwright install chromium  # once
pnpm e2e                               # three browser scenarios against a mock-mode server
```

## Use the API directly

A workflow is plain JSON — the editor's Export writes exactly this request body. Run the branching example from a
terminal:

```bash
curl -s -X POST localhost:8080/api/runs -H 'content-type: application/json' -d @examples/branching.json
curl -s localhost:8080/api/runs/<runId>
```

The interactive API reference is at `http://localhost:8080/api/docs`.
