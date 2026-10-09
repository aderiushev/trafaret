# Trafaret — Design Spec

- **Date:** 2026-10-08
- **Status:** Approved; built phase by phase from the plans in `docs/plans/`
- **Author:** Aleksei Deriushev

## 1. What it is

Trafaret is a node-based editor for **reusable AI-image recipes**. You place blocks on a canvas — a prompt, an
uploaded photo, *Generate Image*, *Edit Image*, *Result* — connect them with typed wires, pick a style preset and
press **Run**. The server executes the graph: independent branches render in parallel, a failed node can be
retried, and on the next run only the nodes whose inputs changed are regenerated — everything else is reused from
a content-addressed cache.

*Trafaret* (трафарет) means *stencil*: cut it once, use it again and again.

The project started as a take-home exercise: a small node-based editor plus at least one real AI image generation
through a backend, testing frontend, backend, AI-API integration and the understanding of graph execution. It is also
a public portfolio piece.

## 2. Goals and non-goals

**Goals**

1. Satisfy every requirement of the exercise (traceability in §3).
2. Signature feature: **incremental runs** (build-system semantics), made visible by a **run timeline**.
3. A live public demo with real AI under a hard daily budget, plus a zero-key local mode.
4. Code a reviewer enjoys reading: clear boundaries, strict types, tests on the hard parts, documented trade-offs.

**Non-goals** (listed in the README under "Next steps")

Run cancellation · server push (SSE/WebSocket) · persistent storage (database, object storage) · auth and
multi-tenancy · undo/redo · preset editor · extra node types (remove background, resize, video) · i18n ·
automatic retries of paid calls (deliberate, see §6.5).

## 3. Requirements traceability

| ID  | Requirement (from the exercise)                                                                                               | Where it is met                                                 |
|-----|-------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------|
| R1  | Frontend follows Feature-Sliced Design; no business logic in random UI components                                            | §8.1, enforced by Steiger in CI                                 |
| R2  | Scenario 1: Prompt → Generate Image → Result                                                                                  | Template "Text → Image" (§8.6)                                  |
| R3  | Scenario 2: Image Input → Edit Image → Result                                                                                 | Template "Edit a photo" (§8.6)                                  |
| R4  | Mandatory branching: Prompt → Generate A / Generate B → Result A / Result B                                                   | Template "One prompt, two styles" (§8.6)                        |
| R5  | ⭐ Canvas on React Flow with Prompt, Image Input, Generate, Edit, Result; add, move, connect, delete, branching, selection      | §8.3, §8.4                                                      |
| R6  | Typed ports `text` / `image`; incompatible connections are blocked                                                            | §5.2 — one `canConnect` used by the canvas and the server       |
| R7  | Graph definition, dependencies, branching, parallel execution; the workflow is usable as data without the visual editor      | §5.3, §6; `POST /api/runs` with OpenAPI docs (§7.1)             |
| R8  | At least one real image-generation call: Browser → Backend → AI API → Backend → Result node                                   | §7.3 (FLUX.2 klein, Seedream 4.5)                               |
| R9  | The API key never reaches the frontend                                                                                        | §7.8                                                            |
| R10 | text → image, result display, loading/error state, timeout/error handling                                                     | §6.3, §6.4, §7.4, §8.4                                          |
| R11 | Edit Image, if the chosen API supports it                                                                                     | Both real models support edit (§7.3)                            |
| R12 | Preset is a separate data-model entity (`id, name, mainPrompt, negativePrompt, references`); a request builder merges it      | §5.4, §7.2                                                      |
| R13 | Independent branches can run at the same time                                                                                 | §6.2, §6.3                                                      |
| R14 | Jobs with `idle/queued/running/success/error`; `POST /runs → { runId }`; `GET /runs/:runId → queued/running/completed/failed` | §5.6, §7.1 (client polling)                                     |
| R15 | Retry of a failed node                                                                                                        | §6.5                                                            |
| R16 | Anything unfinished is described in the README                                                                                | §12                                                             |

## 4. Architecture

### 4.1 Repository layout

```
trafaret/
├─ apps/
│  ├─ web/         React 19 SPA (Vite), Feature-Sliced Design
│  └─ server/      Fastify API: runs, engine, providers, assets, presets
├─ packages/
│  └─ core/        shared domain: node types, ports, graph schema, validation, API types
├─ e2e/            Playwright specs, run against the server in mock mode
├─ docs/           specs/ and plans/
├─ .github/        CI workflow
├─ Dockerfile      one image: Fastify serves the built SPA and /api
└─ render.yaml     Render blueprint for the live demo
```

### 4.2 Runtime

```
Browser (SPA) ── HTTP /api ──► Fastify ──► RunService ──► Engine ──► ImageProvider ──► Cloudflare Workers AI
      ▲     polls GET /api/runs/:runId        │                              ├──► BytePlus ModelArk
      └──────────────────────────────────────┘                              └──► Mock
                         RunRepository · AssetStore · ResultCache · PresetRepository · DailyBudget   (all in memory)
```

### 4.3 Stack

| Area     | Choice                                                                                                                                         |
|----------|------------------------------------------------------------------------------------------------------------------------------------------------|
| Language | TypeScript 6.0, strict (7.x is not yet supported by typescript-eslint)                                                                          |
| Web      | React 19.3, Vite 8, React Compiler, @xyflow/react 12, zustand 5 + immer, TanStack Query 5, ky 2, CSS Modules                                   |
| Server   | Node 24, Fastify 5, fastify-type-provider-zod 7, @fastify/swagger + swagger-ui, @fastify/multipart, @fastify/static, @fastify/rate-limit, sharp, pino |
| Shared   | zod 4                                                                                                                                          |
| Quality  | Vitest 5, Playwright 1.64, ESLint 10 + typescript-eslint, Prettier, Steiger (FSD linter)                                                       |
| Delivery | pnpm 10 workspaces, GitHub Actions, Docker, Render                                                                                             |

### 4.4 Why a Vite SPA and not Next.js

- The editor is a client-only canvas; server rendering and SEO add nothing.
- The engine needs a long-lived process that keeps working after the HTTP response; Fastify does this
  idiomatically, Next.js route handlers do not.
- FSD's `app` / `pages` layers collide with Next.js routing folders.
- One process serves SPA + API → one container, a trivial deploy.

## 5. Domain model (`packages/core`)

### 5.1 Node types

| Type            | Inputs (handle: port type)                          | Output         | Data                                                             |
|-----------------|-----------------------------------------------------|----------------|------------------------------------------------------------------|
| `prompt`        | —                                                   | `out: text`    | `{ text }`                                                       |
| `imageInput`    | —                                                   | `out: image`   | `{ assetId: string \| null }`                                    |
| `generateImage` | `prompt: text` (required)                           | `out: image`   | `{ modelId, presetId: string \| null, aspectRatio, seed }`       |
| `editImage`     | `image: image` (required), `prompt: text` (optional) | `out: image`   | `{ instruction, modelId, presetId: string \| null, seed }`       |
| `result`        | `image: image` (required)                           | —              | `{}`                                                             |

- `AspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16'`. Edit output uses the supported aspect ratio closest to
  the source image's.
- `seed` is an integer in `[0, 2^31 − 1]`, randomised when a node is created; 🎲 *Regenerate* replaces it (§6.6).
- Edit: a wired `prompt` overrides `instruction`; at least one of them must be non-empty.
- Node definitions (ports, defaults, labels) live in one registry. Adding a node type means a registry entry,
  a server executor and a UI card.

### 5.2 Wiring rules

`canConnect(graph, connection) → { ok: true } | { ok: false, reason }`:

1. The source port type equals the target port type.
2. A target handle accepts at most one edge; a source handle may fan out (branching).
3. No self-loops, and the new edge must not create a cycle.
4. Both handles exist on their node types.

The canvas calls it during every drag (`isValidConnection`) and shows `reason`; the server re-checks every edge.

### 5.3 Graph

```ts
type Graph = {
  nodes: Array<{ id: string; type: NodeType; data: NodeData; position?: { x: number; y: number } }>;
  edges: Array<{ id: string; source: string; sourceHandle: 'out'; target: string; targetHandle: 'prompt' | 'image' }>;
};
```

- A zod schema with a discriminated union on `type`. The same JSON is autosaved, exported/imported and posted to
  `/api/runs`. The server ignores `position`.
- `validateGraph(graph) → Issue[]` is pure and catalog-agnostic.
  Issue codes: `SCHEMA_MISMATCH` (request shape, server only), `DUPLICATE_ID`, `DANGLING_EDGE`,
  `PORT_TYPE_MISMATCH`, `INPUT_ALREADY_CONNECTED`, `CYCLE`, `MISSING_INPUT`, `MISSING_VALUE`, `NOTHING_TO_RUN`,
  `LIMIT_EXCEEDED`. The server adds `UNKNOWN_MODEL`, `MODEL_UNAVAILABLE`, `MODEL_CANNOT_EDIT`, `UNKNOWN_PRESET`,
  `UNKNOWN_ASSET`.
- `validateGraph` replays every edge through `canConnect` against the edges accepted so far — one wiring rule for
  canvas and server — so a rejected edge (for example the one that would close a loop) is reported with its `edgeId`
  and target `nodeId`. A graph over the node or edge limit gets only its size issues, from the server too: the
  per-edge replay and the server's catalog/preset/asset checks are skipped, so validation stays cheap for any input.
- `Issue = { code, message, nodeId?, edgeId? }`.
- Limits: ≤ 30 nodes, ≤ 60 edges, ≤ 8 AI nodes (`generateImage` + `editImage`), prompt/instruction ≤ 2 000 chars.

### 5.4 Preset — a separate entity, owned by the server

```ts
type Preset = { id: string; name: string; mainPrompt: string; negativePrompt: string; references: string[] };
```

- Stored as `apps/server/library/presets/<id>.json` in exactly this shape, `references` relative to the presets folder
  (e.g. `/references/premium-3d-1.webp`), validated at boot.
- `GET /api/presets` returns `references` resolved to asset URLs. Nodes store only `presetId`; the server resolves
  the content at run time, so the merge never happens in the UI.
- Initial set: `premium-3d` (Premium 3D), `lifestyle` (Lifestyle), `paper-craft` (Paper Craft) — two reference
  images each, generated with the project's own pipeline and committed as WebP ≤ 200 KB.

### 5.5 Model catalog

```ts
type ImageModel = {
  id: string; label: string; provider: 'cloudflare' | 'byteplus' | 'mock';
  default: boolean; enabled: boolean; unavailableReason: string | null;
  supportsEdit: boolean; supportsNegativePrompt: boolean; supportsSeed: boolean;
  maxReferenceImages: number; aspectRatios: AspectRatio[]; costPerImageUsd: number;
};
```

Models without credentials are `enabled: false` with a reason ("Set ARK_API_KEY to enable Seedream 4.5"). The
default model is the first enabled one of: Seedream 4.5 → FLUX.2 klein → Mock.

### 5.6 Run and Job

```ts
type RunStatus = 'queued' | 'running' | 'completed' | 'failed';
type JobStatus = 'idle' | 'queued' | 'running' | 'success' | 'error';
type ErrorCode = 'PROVIDER_ERROR' | 'TIMEOUT' | 'UPSTREAM_FAILED' | 'INVALID_INPUT' | 'INTERNAL';

type Run = {
  id: string; status: RunStatus; version: number;
  createdAt: number; startedAt: number | null; finishedAt: number | null; // epoch ms
  jobs: Record<string, Job>;
  summary: { aiNodes: number; generated: number; reused: number; failed: number; savedMs: number; fallbacks: number };
};

type Job = {
  nodeId: string; nodeType: NodeType; status: JobStatus; attempt: number;
  startedAt: number | null; finishedAt: number | null; cached: boolean;
  output?: { kind: 'text'; text: string } | { kind: 'image'; assetId: string; url: string; width: number; height: number };
  error?: { code: ErrorCode; message: string; retryable: boolean; upstreamNodeId?: string };
  request?: RequestPreview;                                        // AI nodes only (§7.2)
  model?: { id: string; provider: string; fallbackFrom?: string }; // fallbackFrom = requested model when the budget forced Mock
};
```

- Every node gets a job. Trivial nodes finish in ~0 ms; AI nodes call a provider.
- Lifecycle: the run is created `queued` with all jobs `idle`; the executor picks it up on the next tick and the run
  becomes `running`. Cache hits go straight to `success` with `cached: true`; misses go `queued` → `running` →
  `success | error`.
- A job whose dependency failed becomes `error` with code `UPSTREAM_FAILED` and `upstreamNodeId` — Airflow's
  `upstream_failed` semantics without a sixth status.
- `version` increments on every change; a client never replaces a snapshot with an older one.
- IDs: nodes and edges use `nanoid` (client). A node id matches `[A-Za-z0-9_-]{1,64}` (the nanoid alphabet) and is
  never `__proto__`, because node ids become object keys; edge ids may be any 1–64 characters. Runs are
  `run_<nanoid>`; assets are the SHA-256 of their stored bytes (hex).

## 6. Execution engine (`apps/server/src/engine`)

### 6.1 Planning

On `POST /api/runs`: zod parse → `validateGraph` + catalog/preset/asset checks → `400` with issues, or:

1. topological order (Kahn's algorithm);
2. a cache key per node (§6.6), computed in topological order;
3. create the Run (`queued`, jobs `idle`), return `202 { runId }`, start execution on the next tick.

### 6.2 Scheduling — dependency-driven, not level-by-level

Each run owns `promises: Map<nodeId, Promise<Output>>`:

```ts
settle(id) = promises.get(id) ?? promises.set(id, (async () => {
  if (cacheHit(id)) return cachedOutput(id);               // known at planning time
  const inputs = await Promise.all(deps(id).map(settle));  // waits only for its own inputs
  return runJob(id, inputs);                               // AI jobs acquire a global slot
})()).get(id);

start() = Promise.allSettled(allNodes.map(settle));
```

A node starts the moment its own inputs succeed. Example: Prompt → Generate A (5 s) → Edit A (5 s) next to
Prompt → Generate B (15 s). Level-by-level execution starts Edit A at 15 s; dependency-driven execution at 5 s.

### 6.3 Concurrency and timeouts

- A global FIFO semaphore limits provider calls (`MAX_CONCURRENT_JOBS`, default 4) across all runs. A job is
  `running` only while it holds a slot; branches beyond the limit stay `queued`.
- Every provider call gets `AbortSignal.timeout(JOB_TIMEOUT_MS)` (default 120 000). Adapters pass the signal to
  `fetch`, so a timed-out request is actually aborted. Timeout → `TIMEOUT`, retryable.

### 6.4 Failure semantics

- A failure rejects only that node's promise; sibling branches keep running.
- Dependents fail immediately with `UPSTREAM_FAILED`; they do not wait for their other inputs.
- After execution starts, run status is derived from jobs on every change: any `idle/queued/running` → `running`;
  otherwise any `error` → `failed`; otherwise `completed`. `finishedAt` is set when a terminal status is reached.

### 6.5 Retry

`POST /api/runs/:runId/nodes/:nodeId/retry` returns `409` unless the job is in `error`. Otherwise:

1. Reset set **R** = the node ∪ its ancestors in `error` ∪ (transitively) the descendants in `error`.
2. For every node in R: delete its promise, set its job to `queued`, clear `output`, `error`, `request`, `model` and
   the timestamps (`startedAt`, `finishedAt`), and increment `attempt` for nodes that actually ran (not
   `UPSTREAM_FAILED`).
3. `settle()` every node in R. Successful nodes keep their outputs; in-flight siblings are still awaited through the
   shared promise map, so a retry works while other branches are still running.

There are **no automatic retries of paid calls**: re-running costs money, so it stays an explicit user action.

### 6.6 Incremental runs — content-addressed cache

```
key(node) = sha256(canonicalJson({
  v: CACHE_VERSION,
  type,
  data,    // prompt: text · imageInput: assetId · generate: modelId, aspectRatio, seed
           // edit: modelId, seed, instruction (only when no prompt is wired)
  preset,  // sha256 of the preset fields + reference asset ids, or null
  inputs,  // { [targetHandle]: key(upstream node) }
}))
```

- Input-addressed (Nix/Bazel style): keys depend on upstream keys, never on outputs, so every hit is known before
  execution starts and `summary` is accurate from the first poll.
- Lookups and stores happen only for AI nodes; trivial nodes are recomputed for free.
- `ResultCache` is an in-memory LRU (500 entries) of `{ output, durationMs, request, model }`. An entry whose asset
  has been evicted counts as a miss.
- Never cached: errors, budget fallbacks (`model.fallbackFrom` set), and results computed — directly or
  transitively — from a budget-fallback result, since their keys assume the real upstream outputs.
- Seeds give clear semantics: **Run** builds only what changed; **🎲 Regenerate** sets a new seed and starts a run,
  so that node and its descendants re-render. Models without seed support still get a fresh call, because the seed
  is part of the key.
- `summary.savedMs` is the sum of `durationMs` over reused entries.

### 6.7 Storage

`RunRepository` is an in-memory `Map` that keeps the latest 200 runs and evicts runs finished more than an hour ago.
The service is single-instance by design — a documented trade-off; Redis/Postgres is the next step.

## 7. Backend API and providers (`apps/server`)

### 7.1 Endpoints

JSON bodies are validated with zod schemas from `core`; the same schemas generate the OpenAPI UI at `/api/docs`.

| Method | Path                                    | Response                                                                                    |
|--------|-----------------------------------------|---------------------------------------------------------------------------------------------|
| GET    | `/api/health`                           | `200 { ok: true }`                                                                          |
| GET    | `/api/catalog`                          | `200 { models: ImageModel[] }`                                                              |
| GET    | `/api/presets`                          | `200 { presets: Preset[] }` with references as URLs                                         |
| GET    | `/api/samples`                          | `200 { samples: Sample[] }` — pinned sample photos for the Edit templates                   |
| POST   | `/api/assets`                           | multipart `file` → `201 { assetId, url, width, height }`                                    |
| GET    | `/api/assets/:assetId`                  | image bytes, `Cache-Control: public, max-age=31536000, immutable`                           |
| POST   | `/api/runs`                             | `{ graph }` → `202 { runId }` · `400 { error: { code: 'INVALID_GRAPH', message, issues } }` |
| GET    | `/api/runs/:runId`                      | `200 Run` · `404`                                                                           |
| POST   | `/api/runs/:runId/nodes/:nodeId/retry`  | `202 { runId }` · `404` unknown run · `409` node not in `error` (an unknown node id too)    |

Every error uses one envelope: `{ error: { code, message, issues? } }`.

### 7.2 Request builder (pure function)

`buildRequest({ node, inputs, preset, model }) → { providerRequest, preview }`:

- **prompt** = the user text (wired prompt, or the Edit `instruction`) and `preset.mainPrompt` (if a preset is set),
  each trimmed of trailing punctuation and joined with `". "`.
- **negative**: if `model.supportsNegativePrompt`, it goes to the native field (`negativeMode: 'native'`);
  otherwise it is appended as `Avoid: <negativePrompt>.` (`'folded'`); without a preset it is `'none'`.
- **images**: Edit → `[source, ...preset references]`; Generate → `[...preset references]`; cut to
  `model.maxReferenceImages`, with the dropped count added to `warnings`.
- **aspect ratio** from node data; **seed** only if `model.supportsSeed`.

```ts
type RequestPreview = {
  modelId: string; prompt: string; negativePrompt: string | null; negativeMode: 'native' | 'folded' | 'none';
  references: Array<{ assetId: string; url: string; role: 'source' | 'preset' }>;
  aspectRatio: AspectRatio | null; seed: number | null; warnings: string[];
};
```

The preview is stored on the job and shown in the inspector as "Request sent to AI".

### 7.3 Providers

```ts
interface ImageProvider {
  generate(request: ProviderRequest, signal: AbortSignal): Promise<{ bytes: Buffer }>;
}
```

Adapters receive `fetch` by injection, so tests stub it. A provider returns bytes only: the server sniffs the real
format from them and normalises every output to WebP (quality 90) before it is stored.

| Model                      | Adapter      | Request                                                                                                                                                                                                                   | Edit | Refs | Negative | Seed | Cost                 |
|----------------------------|--------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------|------|----------|------|----------------------|
| FLUX.2 klein 4B            | `cloudflare` | `POST https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-2-klein-4b`, Bearer token, multipart: `prompt`, `width`, `height`, `seed`, `input_image_0..3` (each < 512 px) → base64 image | ✓    | 4    | folded   | ✓    | free tier, ~95/day   |
| Seedream 4.5               | `byteplus`   | `POST https://ark.ap-southeast.bytepluses.com/api/v3/images/generations`, Bearer `ARK_API_KEY`, JSON: `model: seedream-4-5-251128`, `prompt`, `image: dataURI[]`, `size`, `response_format: b64_json`, `watermark: false`, `sequential_image_generation: disabled` | ✓    | 14   | folded   | ✗    | 200 free, then $0.04 |
| Mock                       | `mock`       | sharp renders an SVG: a gradient derived from hash(prompt, seed), the prompt text and a "MOCK" label; Edit composites the source image; latency 1.2–3.5 s, derived from the seed                                         | ✓    | 14   | native   | ✓    | $0                   |
| Mock · fails first attempt | `mock`       | Same as Mock, but attempt 1 always fails with a retryable error — a deterministic retry demo and e2e fixture                                                                                                              | ✓    | 14   | native   | ✓    | $0                   |

Output sizes per aspect ratio:

| Model           | 1:1       | 4:3       | 3:4       | 16:9      | 9:16      |
|-----------------|-----------|-----------|-----------|-----------|-----------|
| FLUX.2 klein 4B | 1024×1024 | 1024×768  | 768×1024  | 1024×576  | 576×1024  |
| Seedream 4.5    | 2048×2048 | 2304×1728 | 1728×2304 | 2560×1440 | 1440×2560 |

Exact request and response fields are re-verified against the provider docs before each adapter is written.

### 7.4 Provider error mapping

| Provider response     | Job error        | Retryable | Message                                                        |
|-----------------------|------------------|-----------|----------------------------------------------------------------|
| 401 / 403             | `PROVIDER_ERROR` | no        | "The server's AI credentials were rejected."                   |
| 429                   | `PROVIDER_ERROR` | yes       | "The AI service is busy. Retry in a few seconds."              |
| 400 / 422, moderation | `INVALID_INPUT`  | no        | "The model declined this prompt. Rephrase it and run again."   |
| other 4xx             | `INVALID_INPUT`  | no        | the provider's message, sanitised                              |
| 5xx, network failure  | `PROVIDER_ERROR` | yes       | "The AI service didn't respond. Retry in a few seconds."       |
| timeout               | `TIMEOUT`        | yes       | "No answer from the AI service in 120 s. Retry to try again."  |

Raw provider errors are logged on the server only.

### 7.5 Assets

- `AssetStore`: content-addressed, in-memory LRU capped at 150 MB (the demo host has 512 MB RAM). Pinned assets —
  preset references and the sample photo — are never evicted.
- Uploads: `@fastify/multipart`, ≤ 10 MB, format checked from the bytes with sharp (PNG/JPEG/WebP only),
  ≤ 4096×4096, stored as uploaded — except that a rotated (EXIF) photo is stored upright (re-encoded). The asset id
  is the SHA-256 of the stored bytes.
- A sample product photo, kept in `apps/server/library/samples/`, is pinned at boot for the Edit templates.

### 7.6 Live-demo guards

- Daily caps per real provider, reset at 00:00 UTC: `DAILY_LIMIT_CLOUDFLARE` (80) and `DAILY_LIMIT_BYTEPLUS` (20).
  The counter is checked and incremented right before the provider call. When a cap is reached the job runs on
  Mock with `model.fallbackFrom` set, and the UI labels the result.
- `@fastify/rate-limit` per visitor: runs + retries 20 per 10 min; uploads 30 per 10 min. In production a visitor is
  the address in `cf-connecting-ip`, which Render's Cloudflare edge sets and overwrites. `X-Forwarded-For` is never
  trusted — Render appends to whatever the client sent — and IPv6 addresses count per /64. A request without the
  header is keyed by its connecting address.
- Graph limits from §5.3.

### 7.7 Configuration

Validated with zod at boot. A missing optional key disables its model with a reason; it never crashes the server.
A malformed one (anything but printable ASCII without spaces) stops the boot with the variable's name, never its value.

| Variable                                          | Default       | Purpose                                                                                                          |
|---------------------------------------------------|---------------|------------------------------------------------------------------------------------------------------------------|
| `NODE_ENV`                                        | `development` | `production` turns on the production rate limits, keyed by the edge's `cf-connecting-ip` (§7.6)                  |
| `HOST`                                            | `127.0.0.1`   | listen address; `0.0.0.0` when `NODE_ENV=production`; an explicit value always wins                              |
| `PORT`                                            | 8080          | HTTP port (Render injects its own)                                                                               |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`   | —             | enable FLUX.2 klein                                                                                              |
| `ARK_API_KEY`                                     | —             | enable Seedream 4.5                                                                                              |
| `MAX_CONCURRENT_JOBS`                             | 4             | global provider slots                                                                                            |
| `JOB_TIMEOUT_MS`                                  | 120000        | per-call timeout                                                                                                 |
| `DAILY_LIMIT_CLOUDFLARE` / `DAILY_LIMIT_BYTEPLUS` | 80 / 20       | demo budget                                                                                                      |
| `MOCK_LATENCY_MS`                                 | `1200-3500`   | mock latency range (server tests use a few ms, e2e `800-1200`)                                                   |
| `LOG_LEVEL`                                       | `info`        | pino log level                                                                                                   |

### 7.8 Security

- Provider keys exist only in the server environment; no endpoint returns them; pino redacts `authorization`
  headers and key fields.
- The SPA and API share an origin: no CORS in production, a Vite proxy in development. API responses, error
  envelopes and the editor's files carry `X-Content-Type-Options: nosniff`.
- Uploads are verified by content, size and dimensions; asset IDs are hashes, so no user input reaches a file path.

## 8. Frontend (`apps/web`, Feature-Sliced Design)

### 8.1 Layers

```
src/
├─ app/        entrypoint/ (main, providers: QueryClient, React Flow, toasts, error boundary) · styles/ (tokens, global)
├─ pages/      editor/ — layout, plus the page-level run polling and first-visit starter
├─ widgets/    workflow-canvas/ (React Flow + node cards) · editor-toolbar/ · run-timeline/ · node-inspector/
├─ features/   add-node · connect-nodes · delete-selection · run-workflow · retry-node · regenerate-node ·
│              upload-image · load-template · export-import
├─ entities/   workflow (graph store) · run · preset · catalog (image models) · asset · node (NodeShell, typed handles)
└─ shared/     api (ky, ApiError) · ui (Button, Select, Textarea, Field, Badge, Spinner, Panel, Dropzone, toasts, ErrorBoundary) · lib
```

- The image-model entity is `catalog`, after `GET /api/catalog`: an entity called `model` would read
  `entities/model/model/` and clash with FSD's `model` segment.
- Imports flow downward only; every slice exposes an `index.ts`; slices of one layer never import each other.
  Steiger runs in `pnpm lint` and in CI.
- Node cards compose entities and features, so they live in `widgets/workflow-canvas/ui/nodes/` and contain layout
  only.

### 8.2 State

- **Graph:** a zustand + immer store (`nodes`, `edges`, actions), persisted to `localStorage`
  (`trafaret:graph:v1`). React Flow is fully controlled by it.
- **Server state:** TanStack Query — catalog and presets (`staleTime: Infinity`); run polling (`refetchInterval`
  700 ms until a terminal status; a lower `version` never replaces a higher one); mutations for run, retry, upload.
  Exactly one component (the editor page) polls; every other reader uses the cached run and never fetches.
- **Active run:** `activeRunId` plus the submitted graph snapshot in `entities/run`. Nodes whose data differ from
  the snapshot show "● edited". Run and 🎲 are disabled while the active run is not terminal; Retry stays available
  on failed nodes.
- An export is exactly the body of `POST /api/runs` (`{ "graph": … }`), so it can be posted with curl; import also
  accepts a bare graph.
- Before submitting, the client runs `validateGraph`; issues (client- or server-side) are shown on the affected
  nodes, plus a toast ("Fix 2 issues to run").

### 8.3 Canvas

- Palette grouped as Input / Generation / Output; a click adds the node at the viewport centre, offset to avoid
  overlap.
- Drag to move; box-select and shift-click; Delete/Backspace removes the selection; ⌘/Ctrl+Enter runs; Esc clears
  the selection.
- Handles and wires are coloured by port type; while dragging, only compatible handles highlight; a rejected
  connection shows the reason from `canConnect`.
- Any output can fan out (branching). Minimap, zoom controls, fit view, snap-to-grid.
- An empty canvas shows "Start from a template or add a node" with template buttons.

### 8.4 Node cards and statuses

| Card           | Content                                                                                                                                       |
|----------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| Prompt         | auto-growing textarea, character count                                                                                                        |
| Image Input    | dropzone / click to upload, preview, replace, “Use the sample photo”; a spinner while uploading (`fetch` reports upload progress only over HTTP/2 with request streams) and the upload error |
| Generate Image | model select (disabled options show their reason in the option text), preset select with reference thumbnails, aspect ratio (from model capabilities), seed + 🎲, output thumbnail |
| Edit Image     | instruction (disabled, "Using connected prompt", when a prompt is wired), model (edit-capable only), preset, seed + 🎲, output thumbnail         |
| Result         | large preview, download, ⚡ reused / Mock badges; error message + Retry                                                                         |

Statuses: `idle` neutral · `queued` dashed outline · `running` animated accent ring with elapsed seconds, incoming
edges animated · `success` check · `error` red with message and Retry. For `UPSTREAM_FAILED` the card says
"Skipped: <node> failed" and Retry targets the root cause.

### 8.5 Run timeline and inspector

- **Timeline** (bottom, collapsible): one row per Generate/Edit node in topological order (Prompt, Image Input and
  Result finish in ~0 ms and would only add empty rows); a bar from `startedAt` to `finishedAt` relative to
  `run.startedAt`; running bars grow live; reused nodes show ⚡ at zero width; a failed row has a red bar, says
  "Failed" and offers Retry. Summary line: "2 AI calls · 13.4 s · 1 reused · saved ~12.1 s". Plain CSS; the layout
  maths is a pure, tested function.
- **Inspector** (right, for the selected node): status, attempt, duration, model and fallback note, **Request sent to
  AI** (final prompt, negative mode, reference thumbnails with roles, warnings) and error details.

### 8.6 Templates and first visit

1. **Text → Image** — Prompt → Generate → Result (R2)
2. **Edit a photo** — Image Input (sample photo) → Edit → Result (R3)
3. **One prompt, two styles** — Prompt → Generate A (Premium 3D) / Generate B (Lifestyle) → Result A / Result B (R4)
4. **Product shot → two styles** — Image Input (sample photo) → Edit (clean background) → Edit A (Premium 3D) /
   Edit B (Paper Craft) → Result A / Result B

A first visit — or a visit whose saved workflow can't be loaded — loads template 3. Templates are graph JSON; loading
one assigns fresh node IDs and seeds.

### 8.7 Visual identity (defaults, refined in a design pass during implementation)

- Dark graphite canvas `#121214` with a dot grid; flat cards `#1b1c1f`; 1 px borders `#2e3035`; radii 8/12; text
  `#ececef`, muted `#9a9ca5`.
- One "spray orange" accent `#ff5f1f` for primary actions and the running state; port colours: text `#f5c84c`,
  image `#4cb8ff`; success `#3ad69a`; error `#ff5a5f`.
- Stencil typeface (Saira Stencil One, self-hosted with Fontsource) for the logotype; Inter for the UI; JetBrains Mono
  for numbers and the timeline.
- UI copy in English: terse, imperative; error messages say how to recover.
- Visible focus states, labelled icon buttons, `prefers-reduced-motion` respected (a running card keeps a still
  ring). Error toasts stay until dismissed; the timeline announces lost contact. Desktop-first; on narrow screens the
  canvas stays viewable and runnable.
- Hints use the native `title` attribute; there is no tooltip component.

## 9. Testing

| Level                                                             | Scope                                                                                                                                                                                                                                         |
|-------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `core` unit                                                       | `canConnect` (type mismatch, single input, cycle, self-loop); `validateGraph` (every issue code, limits); schema round-trip                                                                                                                    |
| Engine unit (fake provider with controlled latency and failures) | branches overlap in time; dependency order; failure isolation; `UPSTREAM_FAILED` propagation; derived run status; retry re-runs exactly R; retry while a sibling is running; a cache hit skips the provider; a new seed or changed preset invalidates; timeout; concurrency cap; a budget fallback is not cached |
| Request builder unit                                              | prompt merge; native vs folded negative prompt; reference order, truncation and warnings                                                                                                                                                       |
| Provider unit (stubbed `fetch`)                                   | request shape per adapter; the error-mapping table (§7.4); abort                                                                                                                                                                              |
| API (Fastify `inject`)                                            | 202 / 400 with node IDs / 404 / 409; upload type and size rejection; OpenAPI document served                                                                                                                                                  |
| Web unit                                                          | store ↔ graph mapping and saving; timeline layout maths; status helpers; wiring checks; templates (fresh ids and seeds, all valid); workflow files; the UI kit and key components with Testing Library, including the canvas rendered in jsdom |
| E2E (Playwright, server in mock mode)                             | ① template 3 → Run → both results appear and the timeline bars overlap; ② "fails first attempt" model → error → Retry → success; ③ change only Generate B's preset → Run → A shows ⚡ reused; ④ axe finds no WCAG 2.2 A/AA or best-practice problems in the idle editor, after a run and with a failed node. All on their own ports (API 8090, editor 5174) with every provider key blanked; a setup check stops the suite if the server offers any real model |

The engine and `core` are written test-first.

## 10. Tooling and CI

- Root scripts: `dev` (server + Vite via `pnpm -r --parallel dev`; the editor on `127.0.0.1:5173` proxies `/api` to the
  server; mock models always available, real ones when `.env` has keys), `build`, `test`, `e2e`, `lint` (ESLint +
  Steiger + Prettier check), `typecheck`.
- TypeScript strict with `noUncheckedIndexedAccess`; `.env.example` documents every variable; the Node version is
  pinned via `.nvmrc` and `engines`.
- GitHub Actions on push and pull request: install (pnpm cache) → lint → typecheck → test → build → e2e (Chromium,
  mock mode, no secrets); a second job builds the Docker image and smoke-tests it (health check, editor).

## 11. Deployment and live demo

- Multi-stage Dockerfile → `node:24-slim`, production dependencies only, non-root user. Fastify serves
  `apps/web/dist` and `/api`; `GET /api/health` is the health check. The server's TypeScript runs as is (type
  stripping); its dependencies keep pnpm's workspace layout, because Node refuses to strip types inside
  `node_modules`. The runtime image adds fontconfig and DejaVu fonts for the Mock model's text.
- **Render free web service**, region Frankfurt, Docker runtime, defined in `render.yaml` (blueprint):
  `healthCheckPath: /api/health`, auto-deploy of every push to `main` once its CI checks pass
  (`autoDeployTrigger: checksPass`), provider keys as dashboard secrets (`sync: false`). Render runs exactly one
  instance, which the in-memory design requires, and does not throttle background work between requests.
- Free-tier constraints, accepted: the service sleeps after 15 idle minutes and the next visitor waits ~1 minute
  (Render shows a loading page); 512 MB RAM (hence the 150 MB asset cap and WebP outputs); 750 instance hours and
  5 GB bandwidth per month; in-memory state is lost on restart or sleep.
- Optional `keep-warm` GitHub Actions workflow: a 10-minute cron that pings `/api/health`, committed disabled and
  switched on for the review window with `gh workflow enable keep-warm` (and off again afterwards).
- Owner prerequisites: a Render account, a Cloudflare account with a Workers AI API token, a BytePlus account with
  an `ARK_API_KEY`.

## 12. Documentation and presentation

- **README** (English): a GIF of "change one preset → only one branch re-renders"; CI badge; live demo and
  `/api/docs` links; one-minute local start (`pnpm i && pnpm dev`, no keys needed); enabling the real models;
  architecture diagram; requirements checklist R1–R16 linked to code; decisions and trade-offs; "Not done / next
  steps"; a note that it was built with Claude Code as a pair programmer; MIT license.
- **Portfolio:** `aderiushev.github.io/trafaret/` (self-contained `index.html`, `styles.css`, `assets/`) in
  Trafaret's visual identity, plus card #15 "TF" in the projects grid — built once the demo is live and real
  screenshots exist.
- The application cover message is drafted separately and is not part of the repository.

## 13. Risks

| Risk                                                   | Mitigation                                                                                        |
|--------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| Provider API details differ from the research          | Re-verify docs before each adapter; adapters isolated behind one interface; Mock keeps the app usable |
| BytePlus may not verify an individual account          | Seedream shows as disabled with a reason; FLUX.2 klein + Mock cover every flow                     |
| Free quota exhausted on the demo                       | Daily caps + an automatic, visibly labelled Mock fallback                                         |
| Cold start after idle (~1 min on Render free)          | Loading page; warm the demo before sharing; optional keep-warm workflow                           |
| 512 MB RAM on the demo host                            | 150 MB asset cap, WebP outputs, ≤ 8 AI nodes per run, 4 concurrent provider calls                 |
| In-memory state lost on restart or sleep               | Documented; runs are short-lived; the cache warms up again                                        |
| Demo host unreachable from some networks               | README video + zero-key local mode                                                                |
| Scope creep                                            | Non-goals list; the signature feature is limited to cache + timeline                              |
