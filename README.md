# Trafaret

A node-based editor for reusable AI-image recipes: wire prompts, photos and style presets into a graph, run it,
and re-run only what changed. Work in progress — the design lives in
[docs/specs](docs/specs/2026-10-08-trafaret-design.md).

## Run the API locally (no keys needed)

```bash
pnpm install
pnpm dev
```

The server listens on `http://localhost:8080`. The Mock models work without any API key; copy `.env.example` to
`.env` and fill in a key to enable FLUX.2 klein (Cloudflare Workers AI) or Seedream 4.5 (BytePlus).

Run the brief's branching scenario straight from a terminal:

```bash
curl -s -X POST localhost:8080/api/runs -H 'content-type: application/json' -d @examples/branching.json
curl -s localhost:8080/api/runs/<runId>
```

The interactive API reference is at `http://localhost:8080/api/docs`.
