# Trafaret — Phase 1: Core + Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tested, runnable API server that validates and executes AI-image workflow graphs — parallel branches, explicit retries, incremental (cached) re-runs, Cloudflare / BytePlus / Mock providers — usable end to end over HTTP without any UI.

**Architecture:** pnpm monorepo. `packages/core` is the platform-agnostic workflow language (node types, typed ports, zod graph schema, `canConnect`, `validateGraph`, API contracts) that the server and, in Phase 2, the web app share. `apps/server` is Fastify 5 running TypeScript natively on Node 24 (no build step): library (presets, samples), assets, model catalog, providers, engine (request builder, cache keys, dependency-driven execution, retry), runs API, composition root.

**Tech Stack:** Node 24 · TypeScript 6.0 · pnpm 10 · zod 4 · Fastify 5 + fastify-type-provider-zod 7 + @fastify/{swagger, swagger-ui, multipart, rate-limit} · sharp · pino · nanoid · Vitest 5 · ESLint 10 + typescript-eslint 8 · Prettier 3

**Spec:** `docs/specs/2026-10-08-trafaret-design.md`

## Roadmap

| Phase | Plan | Deliverable |
|---|---|---|
| **1 (this plan)** | Core + server | API that runs workflows end to end (curl / OpenAPI UI), fully tested |
| 2 | Web editor (written after Phase 1 lands, against the real contracts) | FSD React app: canvas, typed wiring, run/poll, timeline, inspector, templates, Playwright e2e |
| 3 | Delivery | Dockerfile + SPA serving, CI, public GitHub repo, provider accounts + real preset images, Render demo, README, portfolio page |

## Global Constraints

- Node `>=24` (runs `.ts` natively — verified for workspace symlinks), pnpm `10.15.0`, TypeScript `~6.0.3` (typescript-eslint 8.71 supports `<6.1.0`), ESM everywhere (`"type": "module"`).
- Relative imports carry explicit `.ts` extensions. `erasableSyntaxOnly: true` → **no** enums, namespaces or constructor parameter properties (assign fields in the constructor body).
- `packages/core` is platform-agnostic: no `node:` imports; its only dependency is zod.
- Status names, verbatim from the brief: `RunStatus = 'queued' | 'running' | 'completed' | 'failed'`; `JobStatus = 'idle' | 'queued' | 'running' | 'success' | 'error'`.
- One error envelope for every HTTP error: `{ error: { code, message, issues? } }`.
- Provider keys never leave the server and are never logged.
- Limits: ≤ 30 nodes, ≤ 60 edges, ≤ 8 AI nodes, prompt/instruction ≤ 2 000 chars; uploads ≤ 10 MB, ≤ 4096×4096, PNG/JPEG/WebP only; asset store 150 MB; result cache 500 entries; runs kept: newest 200, finished ones for 1 h.
- Defaults: `PORT=8080`, `MAX_CONCURRENT_JOBS=4`, `JOB_TIMEOUT_MS=120000`, `DAILY_LIMIT_CLOUDFLARE=80`, `DAILY_LIMIT_BYTEPLUS=20`, `MOCK_LATENCY_MS=1200-3500`.
- Rate limits in production: runs + retries 20 per 10 min per client (shared group), uploads 30 per 10 min.
- No company names in committed files. English, terse, recovery-oriented copy.
- Conventional commits (`feat(core): …`, `test(server): …`), at least one per task.
- **Spec delta introduced by this plan** (Task 10 updates the spec): `GET /api/samples` serves the sample photo the Edit templates need; issue code `SCHEMA_MISMATCH` reports request-shape errors.

## File map

```
trafaret/
├─ package.json · pnpm-workspace.yaml · tsconfig.base.json · tsconfig.json · eslint.config.js · vitest.config.ts
├─ .nvmrc · .editorconfig · .prettierrc.json · .prettierignore · .env.example · LICENSE · README.md
├─ examples/branching.json                     curl-able branching workflow (mock model)
├─ packages/core/src/
│  ├─ ports.ts            PortType
│  ├─ nodes.ts            node types, port specs, NODE_DEFINITIONS, node data schemas, AspectRatio, seeds
│  ├─ graph.ts            Graph / GraphNode / GraphEdge zod schemas
│  ├─ graph-index.ts      indexGraph, topologicalOrder, ancestorsOf, descendantsOf, wouldCreateCycle
│  ├─ connect.ts          canConnect (+ shared wording helpers)
│  ├─ validate.ts         validateGraph, Issue, LIMITS
│  ├─ run.ts              Run / Job / RequestPreview contracts
│  ├─ catalog.ts          ImageModel contract, ProviderId
│  ├─ preset.ts           Preset contract
│  ├─ api.ts              request/response schemas, assetUrl
│  ├─ testing.ts          graph fixtures (exported as @trafaret/core/testing)
│  └─ index.ts            public API
└─ apps/server/
   ├─ library/presets/*.json · library/presets/references/*.webp · library/samples/*.webp
   ├─ scripts/make-placeholder-assets.ts
   └─ src/
      ├─ main.ts · app.ts · services.ts · config.ts
      ├─ http/errors.ts · http/server.ts
      ├─ lib/logger.ts · lib/hash.ts · lib/canonical-json.ts · lib/semaphore.ts
      ├─ assets/image.ts · assets/asset-store.ts · assets/routes.ts
      ├─ library/preset-repository.ts · library/sample-repository.ts · library/routes.ts
      ├─ catalog/models.ts · catalog/catalog.ts · catalog/routes.ts
      ├─ providers/types.ts · providers/http.ts · providers/mock.ts · providers/cloudflare.ts · providers/byteplus.ts
      ├─ engine/request-builder.ts · engine/cache-key.ts · engine/result-cache.ts · engine/daily-budget.ts
      ├─ engine/errors.ts · engine/run-execution.ts · engine/node-executors.ts · engine/engine.ts
      ├─ runs/run-repository.ts · runs/validate-run-graph.ts · runs/routes.ts
      └─ test/images.ts · test/engine-harness.ts
```

Tests live next to the code they cover (`*.test.ts`).

---

### Task 1: Workspace scaffold and toolchain

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `tsconfig.json`, `.nvmrc`, `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `eslint.config.js`, `vitest.config.ts`, `LICENSE`, `.env.example`, `README.md`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/ports.ts`, `packages/core/src/index.ts`
- Test: `packages/core/src/ports.test.ts`

**Interfaces:**
- Produces: `PORT_TYPES`, `PortType` from `@trafaret/core`; root scripts `test`, `typecheck`, `lint`, `format`, `dev`.

- [ ] **Step 1: Create the root files**

`package.json`:
```json
{
  "name": "trafaret",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.15.0",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "pnpm --filter @trafaret/server dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "pnpm -r typecheck",
    "lint": "eslint . && prettier --check .",
    "format": "prettier --write ."
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - packages/*
onlyBuiltDependencies:
  - sharp
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`tsconfig.json` (only so ESLint's project service can type-check root config files):
```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "types": ["node"], "allowJs": true },
  "include": ["*.ts", "*.js"]
}
```

`.nvmrc`:
```
24
```

`.editorconfig`:
```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

`.prettierrc.json`:
```json
{ "singleQuote": true, "printWidth": 110, "trailingComma": "all" }
```

`.prettierignore`:
```
pnpm-lock.yaml
docs/
.private/
**/dist/
**/coverage/
```

`eslint.config.js`:
```js
// @ts-check
import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/dist/**', '**/coverage/**', '**/playwright-report/**', '**/test-results/**']),
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
);
```

`vitest.config.ts` (Task 7 adds `apps/*`):
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
});
```

`LICENSE`:
```
MIT License

Copyright (c) 2026 Aleksei Deriushev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

`.env.example`:
```
# Server
PORT=8080
LOG_LEVEL=info

# FLUX.2 klein 4B via Cloudflare Workers AI (free daily allowance). Leave empty to disable the model.
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# Seedream 4.5 via BytePlus ModelArk. Leave empty to disable the model.
ARK_API_KEY=

# Engine
MAX_CONCURRENT_JOBS=4
JOB_TIMEOUT_MS=120000

# Daily caps on real generations (reset at 00:00 UTC). Past a cap, jobs run on the Mock model.
DAILY_LIMIT_CLOUDFLARE=80
DAILY_LIMIT_BYTEPLUS=20

# Mock model latency range in milliseconds: "min-max"
MOCK_LATENCY_MS=1200-3500
```

`README.md`:
```md
# Trafaret

A node-based editor for reusable AI-image recipes. Work in progress — the design lives in
[docs/specs](docs/specs/2026-10-08-trafaret-design.md).
```

- [ ] **Step 2: Create the core package shell**

`packages/core/package.json`:
```json
{
  "name": "@trafaret/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/testing.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json"
  }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": [] },
  "include": ["src"]
}
```

- [ ] **Step 3: Install the toolchain**

Run:
```bash
pnpm add -Dw typescript@~6.0.3 vitest@^5.0.3 eslint@^10.12.0 @eslint/js@^10.0.1 typescript-eslint@^8.71.1 prettier@^3.9.9 @types/node@^24.19.1
pnpm --filter @trafaret/core add zod@^4.6.5
```
Expected: `pnpm-lock.yaml` created, no peer-dependency errors.

- [ ] **Step 4: Write the failing test**

`packages/core/src/ports.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { PORT_TYPES } from './ports.ts';

describe('PORT_TYPES', () => {
  it('has exactly the two port types from the brief', () => {
    expect(PORT_TYPES).toEqual(['text', 'image']);
  });
});
```

- [ ] **Step 5: Run it to see it fail**

Run: `pnpm test`
Expected: FAIL — `Failed to load url ./ports.ts` (module does not exist).

- [ ] **Step 6: Implement**

`packages/core/src/ports.ts`:
```ts
export const PORT_TYPES = ['text', 'image'] as const;
export type PortType = (typeof PORT_TYPES)[number];
```

`packages/core/src/index.ts`:
```ts
export * from './ports.ts';
```

- [ ] **Step 7: Verify the whole toolchain**

Run: `pnpm test && pnpm typecheck && pnpm format && pnpm lint`
Expected: 1 test passes; `tsc` exits 0; ESLint and Prettier report nothing.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm workspace with TypeScript, Vitest, ESLint and Prettier"
```

---

### Task 2: Node registry and graph schema

**Files:**
- Create: `packages/core/src/nodes.ts`, `packages/core/src/graph.ts`, `packages/core/src/testing.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/nodes.test.ts`, `packages/core/src/graph.test.ts`

**Interfaces:**
- Consumes: `PortType` (Task 1).
- Produces:
  - `NODE_TYPES`, `NodeType`, `AI_NODE_TYPES`, `AiNodeType`, `isAiNodeType(type): type is AiNodeType`
  - `ASPECT_RATIOS`, `AspectRatio`, `MAX_SEED`, `randomSeed(): number`
  - `INPUT_HANDLES`, `InputHandle = 'prompt' | 'image'`, `OutputHandle = 'out'`, `InputPortSpec`, `OutputPortSpec`, `NodeDefinition`, `NODE_DEFINITIONS: Record<NodeType, NodeDefinition>`
  - data schemas + types: `PromptData`, `ImageInputData`, `GenerateImageData`, `EditImageData`, `ResultData`
  - `graphNodeSchema`, `graphEdgeSchema`, `graphSchema`, `GraphNode`, `GraphEdge`, `Graph`, `GraphNodeOf<T>`
  - `@trafaret/core/testing`: `promptNode`, `imageInputNode`, `generateNode`, `editNode`, `resultNode`, `edge`, `branchingGraph`

- [ ] **Step 1: Write the failing tests**

`packages/core/src/nodes.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { AI_NODE_TYPES, MAX_SEED, NODE_DEFINITIONS, NODE_TYPES, isAiNodeType, randomSeed } from './nodes.ts';

describe('NODE_DEFINITIONS', () => {
  it('defines exactly the five node types from the brief', () => {
    expect(NODE_TYPES).toEqual(['prompt', 'imageInput', 'generateImage', 'editImage', 'result']);
    expect(Object.keys(NODE_DEFINITIONS).sort()).toEqual([...NODE_TYPES].sort());
  });

  it('gives every AI node an image output', () => {
    for (const type of AI_NODE_TYPES) expect(NODE_DEFINITIONS[type].output?.type).toBe('image');
  });

  it('requires an image and accepts an optional prompt on Edit Image', () => {
    expect(NODE_DEFINITIONS.editImage.inputs).toEqual([
      { handle: 'image', type: 'image', required: true, label: 'Image' },
      { handle: 'prompt', type: 'text', required: false, label: 'Prompt' },
    ]);
  });

  it('makes Result a sink', () => {
    expect(NODE_DEFINITIONS.result.output).toBeNull();
  });

  it('recognises AI node types', () => {
    expect(isAiNodeType('generateImage')).toBe(true);
    expect(isAiNodeType('editImage')).toBe(true);
    expect(isAiNodeType('prompt')).toBe(false);
  });
});

describe('randomSeed', () => {
  it('returns integers inside the 31-bit range', () => {
    for (let i = 0; i < 200; i += 1) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(MAX_SEED);
    }
  });
});
```

`packages/core/src/graph.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { graphSchema } from './graph.ts';
import { branchingGraph, edge, generateNode, promptNode } from './testing.ts';

describe('graphSchema', () => {
  it('accepts the branching scenario', () => {
    expect(graphSchema.safeParse(branchingGraph()).success).toBe(true);
  });

  it('keeps node positions optional', () => {
    const graph = branchingGraph();
    const parsed = graphSchema.parse({
      ...graph,
      nodes: graph.nodes.map((node, i) => (i === 0 ? { ...node, position: { x: 10, y: 20 } } : node)),
    });
    expect(parsed.nodes[0]?.position).toEqual({ x: 10, y: 20 });
    expect(parsed.nodes[1]?.position).toBeUndefined();
  });

  it('rejects unknown node types', () => {
    expect(graphSchema.safeParse({ nodes: [{ id: 'x', type: 'video', data: {} }], edges: [] }).success).toBe(false);
  });

  it('rejects data that does not belong to the node type', () => {
    const node = { ...generateNode('gen'), data: { modelId: 'mock', presetId: null, aspectRatio: '2:1', seed: 1 } };
    expect(graphSchema.safeParse({ nodes: [node], edges: [] }).success).toBe(false);
  });

  it('rejects seeds outside the 31-bit range', () => {
    const graph = { nodes: [generateNode('gen', { seed: 2 ** 31 })], edges: [] };
    expect(graphSchema.safeParse(graph).success).toBe(false);
  });

  it('rejects edges into handles that do not exist', () => {
    const bad = { ...edge('prompt', 'gen', 'prompt'), targetHandle: 'mask' };
    expect(graphSchema.safeParse({ nodes: [promptNode('prompt'), generateNode('gen')], edges: [bad] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test`
Expected: FAIL — `./nodes.ts`, `./graph.ts`, `./testing.ts` cannot be loaded.

- [ ] **Step 3: Implement the node registry**

`packages/core/src/nodes.ts`:
```ts
import { z } from 'zod';
import type { PortType } from './ports.ts';

export const NODE_TYPES = ['prompt', 'imageInput', 'generateImage', 'editImage', 'result'] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const AI_NODE_TYPES = ['generateImage', 'editImage'] as const;
export type AiNodeType = (typeof AI_NODE_TYPES)[number];
export const isAiNodeType = (type: NodeType): type is AiNodeType =>
  type === 'generateImage' || type === 'editImage';

export const ASPECT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const MAX_SEED = 2 ** 31 - 1;
export const randomSeed = (): number => Math.floor(Math.random() * (MAX_SEED + 1));

export const INPUT_HANDLES = ['prompt', 'image'] as const;
export type InputHandle = (typeof INPUT_HANDLES)[number];
export type OutputHandle = 'out';

export type InputPortSpec = { handle: InputHandle; type: PortType; required: boolean; label: string };
export type OutputPortSpec = { handle: OutputHandle; type: PortType; label: string };
export type NodeCategory = 'input' | 'generation' | 'output';

export type NodeDefinition = {
  type: NodeType;
  label: string;
  category: NodeCategory;
  inputs: readonly InputPortSpec[];
  output: OutputPortSpec | null;
};

const imageOutput: OutputPortSpec = { handle: 'out', type: 'image', label: 'Image' };

export const NODE_DEFINITIONS: Readonly<Record<NodeType, NodeDefinition>> = {
  prompt: {
    type: 'prompt',
    label: 'Prompt',
    category: 'input',
    inputs: [],
    output: { handle: 'out', type: 'text', label: 'Text' },
  },
  imageInput: { type: 'imageInput', label: 'Image Input', category: 'input', inputs: [], output: imageOutput },
  generateImage: {
    type: 'generateImage',
    label: 'Generate Image',
    category: 'generation',
    inputs: [{ handle: 'prompt', type: 'text', required: true, label: 'Prompt' }],
    output: imageOutput,
  },
  editImage: {
    type: 'editImage',
    label: 'Edit Image',
    category: 'generation',
    inputs: [
      { handle: 'image', type: 'image', required: true, label: 'Image' },
      { handle: 'prompt', type: 'text', required: false, label: 'Prompt' },
    ],
    output: imageOutput,
  },
  result: {
    type: 'result',
    label: 'Result',
    category: 'output',
    inputs: [{ handle: 'image', type: 'image', required: true, label: 'Image' }],
    output: null,
  },
};

const seed = z.number().int().min(0).max(MAX_SEED);
const modelId = z.string().min(1);
const presetId = z.string().min(1).nullable();

export const promptDataSchema = z.object({ text: z.string() });
export const imageInputDataSchema = z.object({ assetId: z.string().min(1).nullable() });
export const generateImageDataSchema = z.object({ modelId, presetId, aspectRatio: z.enum(ASPECT_RATIOS), seed });
export const editImageDataSchema = z.object({ instruction: z.string(), modelId, presetId, seed });
export const resultDataSchema = z.object({});

export type PromptData = z.infer<typeof promptDataSchema>;
export type ImageInputData = z.infer<typeof imageInputDataSchema>;
export type GenerateImageData = z.infer<typeof generateImageDataSchema>;
export type EditImageData = z.infer<typeof editImageDataSchema>;
export type ResultData = z.infer<typeof resultDataSchema>;
```

Text length is deliberately **not** limited in the schema: `validateGraph` (Task 5) reports it as a readable `LIMIT_EXCEEDED` issue on the node; Fastify's 1 MB body limit bounds abuse.

- [ ] **Step 4: Implement the graph schema**

`packages/core/src/graph.ts`:
```ts
import { z } from 'zod';
import {
  editImageDataSchema,
  generateImageDataSchema,
  imageInputDataSchema,
  INPUT_HANDLES,
  promptDataSchema,
  resultDataSchema,
  type NodeType,
} from './nodes.ts';

const id = z.string().min(1).max(64);
const position = z.object({ x: z.number(), y: z.number() }).optional();

export const graphNodeSchema = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('prompt'), data: promptDataSchema, position }),
  z.object({ id, type: z.literal('imageInput'), data: imageInputDataSchema, position }),
  z.object({ id, type: z.literal('generateImage'), data: generateImageDataSchema, position }),
  z.object({ id, type: z.literal('editImage'), data: editImageDataSchema, position }),
  z.object({ id, type: z.literal('result'), data: resultDataSchema, position }),
]);

export const graphEdgeSchema = z.object({
  id,
  source: id,
  sourceHandle: z.literal('out'),
  target: id,
  targetHandle: z.enum(INPUT_HANDLES),
});

export const graphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type Graph = z.infer<typeof graphSchema>;
export type GraphNodeOf<T extends NodeType> = Extract<GraphNode, { type: T }>;
```

- [ ] **Step 5: Add the shared fixtures**

`packages/core/src/testing.ts`:
```ts
import type { Graph, GraphEdge, GraphNode } from './graph.ts';
import type { EditImageData, GenerateImageData, InputHandle } from './nodes.ts';

export const promptNode = (id: string, text = 'A white sneaker on a stone pedestal'): GraphNode => ({
  id,
  type: 'prompt',
  data: { text },
});

export const imageInputNode = (id: string, assetId: string | null = 'a'.repeat(64)): GraphNode => ({
  id,
  type: 'imageInput',
  data: { assetId },
});

export const generateNode = (id: string, data: Partial<GenerateImageData> = {}): GraphNode => ({
  id,
  type: 'generateImage',
  data: { modelId: 'mock', presetId: null, aspectRatio: '1:1', seed: 1, ...data },
});

export const editNode = (id: string, data: Partial<EditImageData> = {}): GraphNode => ({
  id,
  type: 'editImage',
  data: {
    instruction: 'Replace the background with plain studio grey',
    modelId: 'mock',
    presetId: null,
    seed: 1,
    ...data,
  },
});

export const resultNode = (id: string): GraphNode => ({ id, type: 'result', data: {} });

export const edge = (source: string, target: string, targetHandle: InputHandle): GraphEdge => ({
  id: `${source}->${target}:${targetHandle}`,
  source,
  sourceHandle: 'out',
  target,
  targetHandle,
});

/** Prompt → Generate A / Generate B → Result A / Result B — the brief's mandatory branching scenario. */
export const branchingGraph = (): Graph => ({
  nodes: [
    promptNode('prompt'),
    generateNode('gen-a', { seed: 1 }),
    generateNode('gen-b', { seed: 2 }),
    resultNode('result-a'),
    resultNode('result-b'),
  ],
  edges: [
    edge('prompt', 'gen-a', 'prompt'),
    edge('prompt', 'gen-b', 'prompt'),
    edge('gen-a', 'result-a', 'image'),
    edge('gen-b', 'result-b', 'image'),
  ],
});
```

`packages/core/src/index.ts`:
```ts
export * from './ports.ts';
export * from './nodes.ts';
export * from './graph.ts';
```

- [ ] **Step 6: Run the tests**

Run: `pnpm test`
Expected: PASS (13 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "feat(core): add node registry, typed ports and graph schema"
```

---

### Task 3: Graph index utilities

**Files:**
- Create: `packages/core/src/graph-index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/graph-index.test.ts`

**Interfaces:**
- Consumes: `Graph`, `GraphEdge`, `GraphNode` (Task 2).
- Produces:
  - `type GraphIndex = { nodes: ReadonlyMap<string, GraphNode>; incoming: ReadonlyMap<string, readonly GraphEdge[]>; outgoing: ReadonlyMap<string, readonly GraphEdge[]> }`
  - `indexGraph(graph: Graph): GraphIndex` — edges that point to missing nodes are left out of the index.
  - `topologicalOrder(index: GraphIndex): string[] | null` — `null` when there is a cycle.
  - `ancestorsOf(index, nodeId): Set<string>`, `descendantsOf(index, nodeId): Set<string>`
  - `wouldCreateCycle(index, source, target): boolean`

- [ ] **Step 1: Write the failing tests**

`packages/core/src/graph-index.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ancestorsOf, descendantsOf, indexGraph, topologicalOrder, wouldCreateCycle } from './graph-index.ts';
import type { Graph } from './graph.ts';
import { branchingGraph, edge, editNode, generateNode, promptNode } from './testing.ts';

describe('indexGraph', () => {
  it('lists incoming and outgoing edges per node', () => {
    const index = indexGraph(branchingGraph());
    expect(index.outgoing.get('prompt')?.map((e) => e.target)).toEqual(['gen-a', 'gen-b']);
    expect(index.incoming.get('result-b')?.map((e) => e.source)).toEqual(['gen-b']);
    expect(index.incoming.get('prompt')).toEqual([]);
  });

  it('leaves out edges that point to missing nodes', () => {
    const graph = branchingGraph();
    graph.edges.push(edge('ghost', 'gen-a', 'prompt'));
    expect(indexGraph(graph).incoming.get('gen-a')).toHaveLength(1);
  });
});

describe('topologicalOrder', () => {
  it('orders every node after its dependencies', () => {
    const order = topologicalOrder(indexGraph(branchingGraph()));
    expect(order).not.toBeNull();
    const position = (id: string) => order?.indexOf(id) ?? -1;
    expect(position('prompt')).toBeLessThan(position('gen-a'));
    expect(position('gen-a')).toBeLessThan(position('result-a'));
    expect(position('gen-b')).toBeLessThan(position('result-b'));
    expect(order).toHaveLength(5);
  });

  it('returns null for a cycle', () => {
    const graph: Graph = {
      nodes: [editNode('a'), editNode('b')],
      edges: [edge('a', 'b', 'image'), edge('b', 'a', 'image')],
    };
    expect(topologicalOrder(indexGraph(graph))).toBeNull();
  });
});

describe('ancestors and descendants', () => {
  const graph: Graph = {
    nodes: [promptNode('p'), generateNode('g'), editNode('e1'), editNode('e2')],
    edges: [edge('p', 'g', 'prompt'), edge('g', 'e1', 'image'), edge('e1', 'e2', 'image')],
  };
  const index = indexGraph(graph);

  it('walks upstream', () => {
    expect([...ancestorsOf(index, 'e2')].sort()).toEqual(['e1', 'g', 'p']);
    expect(ancestorsOf(index, 'p').size).toBe(0);
  });

  it('walks downstream', () => {
    expect([...descendantsOf(index, 'g')].sort()).toEqual(['e1', 'e2']);
  });

  it('detects connections that would close a loop', () => {
    expect(wouldCreateCycle(index, 'e2', 'g')).toBe(true);
    expect(wouldCreateCycle(index, 'g', 'g')).toBe(true);
    expect(wouldCreateCycle(index, 'g', 'e2')).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test`
Expected: FAIL — cannot load `./graph-index.ts`.

- [ ] **Step 3: Implement**

`packages/core/src/graph-index.ts`:
```ts
import type { Graph, GraphEdge, GraphNode } from './graph.ts';

export type GraphIndex = {
  readonly nodes: ReadonlyMap<string, GraphNode>;
  readonly incoming: ReadonlyMap<string, readonly GraphEdge[]>;
  readonly outgoing: ReadonlyMap<string, readonly GraphEdge[]>;
};

/** Adjacency lists for a graph. Edges that reference missing nodes are left out (validateGraph reports them). */
export function indexGraph(graph: Graph): GraphIndex {
  const nodes = new Map<string, GraphNode>();
  const incoming = new Map<string, GraphEdge[]>();
  const outgoing = new Map<string, GraphEdge[]>();
  for (const node of graph.nodes) {
    nodes.set(node.id, node);
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }
  for (const edge of graph.edges) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) continue;
    incoming.get(edge.target)?.push(edge);
    outgoing.get(edge.source)?.push(edge);
  }
  return { nodes, incoming, outgoing };
}

/** Kahn's algorithm. Ties keep the order of `graph.nodes`. Returns null when the graph has a cycle. */
export function topologicalOrder(index: GraphIndex): string[] | null {
  const remaining = new Map<string, number>();
  for (const [id, edges] of index.incoming) remaining.set(id, edges.length);
  const ready = [...index.nodes.keys()].filter((id) => remaining.get(id) === 0);
  const order: string[] = [];
  for (const id of ready) {
    order.push(id);
    for (const edge of index.outgoing.get(id) ?? []) {
      const left = (remaining.get(edge.target) ?? 0) - 1;
      remaining.set(edge.target, left);
      if (left === 0) ready.push(edge.target);
    }
  }
  return order.length === index.nodes.size ? order : null;
}

function walk(
  start: string,
  next: ReadonlyMap<string, readonly GraphEdge[]>,
  pick: (edge: GraphEdge) => string,
): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    for (const edge of next.get(id) ?? []) {
      const neighbour = pick(edge);
      if (seen.has(neighbour)) continue;
      seen.add(neighbour);
      stack.push(neighbour);
    }
  }
  return seen;
}

export const ancestorsOf = (index: GraphIndex, nodeId: string): Set<string> =>
  walk(nodeId, index.incoming, (edge) => edge.source);

export const descendantsOf = (index: GraphIndex, nodeId: string): Set<string> =>
  walk(nodeId, index.outgoing, (edge) => edge.target);

export const wouldCreateCycle = (index: GraphIndex, source: string, target: string): boolean =>
  source === target || descendantsOf(index, target).has(source);
```

Append to `packages/core/src/index.ts`:
```ts
export * from './graph-index.ts';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): add graph index, topological order and reachability helpers"
```

---

### Task 4: `canConnect` — the one wiring rule for canvas and server

**Files:**
- Create: `packages/core/src/connect.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/connect.test.ts`

**Interfaces:**
- Consumes: `GraphIndex`, `wouldCreateCycle` (Task 3); `NODE_DEFINITIONS` (Task 2).
- Produces:
  - `type Connection = { source: string; sourceHandle: string | null; target: string; targetHandle: string | null }` (same shape as React Flow's `Connection`)
  - `type ConnectResult = { ok: true } | { ok: false; reason: string }`
  - `canConnect(index: GraphIndex, connection: Connection): ConnectResult`
  - `nodeLabel(type: NodeType): string`, `describeTypeMismatch(from: PortType, to: PortType): string`

- [ ] **Step 1: Write the failing tests**

`packages/core/src/connect.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { canConnect, type Connection } from './connect.ts';
import { indexGraph } from './graph-index.ts';
import type { Graph } from './graph.ts';
import { edge, editNode, generateNode, imageInputNode, promptNode, resultNode } from './testing.ts';

const graph: Graph = {
  nodes: [promptNode('p'), imageInputNode('img'), generateNode('g'), editNode('e'), resultNode('r')],
  edges: [edge('p', 'g', 'prompt'), edge('g', 'r', 'image')],
};
const index = indexGraph(graph);
const connect = (source: string, target: string, targetHandle: string): Connection => ({
  source,
  sourceHandle: 'out',
  target,
  targetHandle,
});

describe('canConnect', () => {
  it('allows matching port types', () => {
    expect(canConnect(index, connect('img', 'e', 'image'))).toEqual({ ok: true });
    expect(canConnect(index, connect('p', 'e', 'prompt'))).toEqual({ ok: true });
  });

  it('allows one output to feed many inputs (branching)', () => {
    expect(canConnect(index, connect('g', 'e', 'image'))).toEqual({ ok: true });
  });

  it('blocks incompatible port types with a readable reason', () => {
    expect(canConnect(index, connect('p', 'e', 'image'))).toEqual({
      ok: false,
      reason: "Text output can't feed an image input.",
    });
    expect(canConnect(index, connect('img', 'g', 'prompt'))).toEqual({
      ok: false,
      reason: "Image output can't feed a text input.",
    });
  });

  it('blocks a second wire into the same input', () => {
    expect(canConnect(index, connect('img', 'r', 'image'))).toEqual({
      ok: false,
      reason: 'The Image input is already connected.',
    });
  });

  it('blocks loops and self-connections', () => {
    const chain = indexGraph({
      nodes: [editNode('a'), editNode('b')],
      edges: [edge('a', 'b', 'image')],
    });
    expect(canConnect(chain, connect('b', 'a', 'image'))).toEqual({
      ok: false,
      reason: 'This connection would create a loop.',
    });
    expect(canConnect(chain, connect('a', 'a', 'prompt'))).toEqual({
      ok: false,
      reason: "A node can't connect to itself.",
    });
  });

  it('blocks unknown nodes and handles', () => {
    expect(canConnect(index, connect('ghost', 'e', 'image')).ok).toBe(false);
    expect(canConnect(index, connect('img', 'e', 'mask')).ok).toBe(false);
    expect(canConnect(index, { ...connect('r', 'e', 'image') }).ok).toBe(false); // Result has no output
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test`
Expected: FAIL — cannot load `./connect.ts`.

- [ ] **Step 3: Implement**

`packages/core/src/connect.ts`:
```ts
import { wouldCreateCycle, type GraphIndex } from './graph-index.ts';
import { NODE_DEFINITIONS, type NodeType } from './nodes.ts';
import type { PortType } from './ports.ts';

/** Same shape as React Flow's Connection, so the canvas can pass it straight through. */
export type Connection = {
  source: string;
  sourceHandle: string | null;
  target: string;
  targetHandle: string | null;
};

export type ConnectResult = { ok: true } | { ok: false; reason: string };

export const nodeLabel = (type: NodeType): string => NODE_DEFINITIONS[type].label;

export const describeTypeMismatch = (from: PortType, to: PortType): string =>
  `${from === 'text' ? 'Text' : 'Image'} output can't feed ${to === 'image' ? 'an image' : 'a text'} input.`;

/** The single wiring rule: the canvas calls it while dragging, the server re-checks every edge. */
export function canConnect(index: GraphIndex, connection: Connection): ConnectResult {
  const source = index.nodes.get(connection.source);
  const target = index.nodes.get(connection.target);
  if (!source || !target) return { ok: false, reason: 'Both ends must be nodes on the canvas.' };
  if (source.id === target.id) return { ok: false, reason: "A node can't connect to itself." };

  const output = NODE_DEFINITIONS[source.type].output;
  if (!output || connection.sourceHandle !== output.handle) {
    return { ok: false, reason: `${nodeLabel(source.type)} has no such output.` };
  }
  const input = NODE_DEFINITIONS[target.type].inputs.find((port) => port.handle === connection.targetHandle);
  if (!input) return { ok: false, reason: `${nodeLabel(target.type)} has no such input.` };
  if (input.type !== output.type) return { ok: false, reason: describeTypeMismatch(output.type, input.type) };

  const occupied = (index.incoming.get(target.id) ?? []).some((edge) => edge.targetHandle === input.handle);
  if (occupied) return { ok: false, reason: `The ${input.label} input is already connected.` };
  if (wouldCreateCycle(index, source.id, target.id)) {
    return { ok: false, reason: 'This connection would create a loop.' };
  }
  return { ok: true };
}
```

Append to `packages/core/src/index.ts`:
```ts
export * from './connect.ts';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): add canConnect with typed-port, single-input and cycle checks"
```

---

### Task 5: `validateGraph`

**Files:**
- Create: `packages/core/src/validate.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/validate.test.ts`

**Interfaces:**
- Consumes: `indexGraph`, `topologicalOrder` (Task 3); `describeTypeMismatch`, `nodeLabel` (Task 4); `NODE_DEFINITIONS`, `isAiNodeType` (Task 2).
- Produces:
  - `LIMITS = { nodes: 30, edges: 60, aiNodes: 8, textLength: 2000 }`
  - `ISSUE_CODES`, `IssueCode`, `issueSchema`, `type Issue = { code: IssueCode; message: string; nodeId?: string; edgeId?: string }`
  - `validateGraph(graph: Graph): Issue[]` — `[]` means runnable (as far as the graph itself goes; the server adds catalog checks in Task 20).

- [ ] **Step 1: Write the failing tests**

`packages/core/src/validate.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Graph } from './graph.ts';
import { branchingGraph, edge, editNode, generateNode, imageInputNode, promptNode, resultNode } from './testing.ts';
import { LIMITS, validateGraph } from './validate.ts';

const codes = (graph: Graph) => validateGraph(graph).map((issue) => issue.code);

describe('validateGraph', () => {
  it('accepts the branching scenario', () => {
    expect(validateGraph(branchingGraph())).toEqual([]);
  });

  it('accepts Image Input → Edit Image → Result without a Prompt node', () => {
    const graph: Graph = {
      nodes: [imageInputNode('img'), editNode('edit'), resultNode('res')],
      edges: [edge('img', 'edit', 'image'), edge('edit', 'res', 'image')],
    };
    expect(validateGraph(graph)).toEqual([]);
  });

  it('reports duplicate ids', () => {
    const graph = branchingGraph();
    graph.nodes.push(promptNode('prompt'));
    expect(codes(graph)).toContain('DUPLICATE_ID');
  });

  it('reports edges that point to missing nodes', () => {
    const graph = branchingGraph();
    graph.edges.push(edge('ghost', 'gen-a', 'prompt'));
    expect(validateGraph(graph)).toContainEqual(expect.objectContaining({ code: 'DANGLING_EDGE', edgeId: 'ghost->gen-a:prompt' }));
  });

  it('reports wires between incompatible ports', () => {
    const graph: Graph = {
      nodes: [promptNode('p'), editNode('e'), resultNode('r')],
      edges: [edge('p', 'e', 'image'), edge('e', 'r', 'image')],
    };
    expect(validateGraph(graph)).toContainEqual({
      code: 'PORT_TYPE_MISMATCH',
      message: "Text output can't feed an image input.",
      nodeId: 'e',
      edgeId: 'p->e:image',
    });
  });

  it('reports a second wire into one input', () => {
    const graph = branchingGraph();
    graph.nodes.push(promptNode('other'));
    graph.edges.push(edge('other', 'gen-a', 'prompt'));
    expect(codes(graph)).toContain('INPUT_ALREADY_CONNECTED');
  });

  it('reports loops', () => {
    const graph: Graph = {
      nodes: [editNode('a'), editNode('b')],
      edges: [edge('a', 'b', 'image'), edge('b', 'a', 'image')],
    };
    expect(codes(graph)).toContain('CYCLE');
  });

  it('reports required inputs that are not connected', () => {
    expect(validateGraph({ nodes: [generateNode('gen')], edges: [] })).toEqual([
      { code: 'MISSING_INPUT', message: 'The Prompt input needs a connection.', nodeId: 'gen' },
    ]);
  });

  it('reports empty prompts, missing uploads and empty edit instructions', () => {
    const graph: Graph = {
      nodes: [promptNode('p', '   '), generateNode('g'), imageInputNode('img', null), editNode('e', { instruction: '' })],
      edges: [edge('p', 'g', 'prompt'), edge('img', 'e', 'image')],
    };
    expect(validateGraph(graph)).toEqual([
      { code: 'MISSING_VALUE', message: 'Write a prompt.', nodeId: 'p' },
      { code: 'MISSING_VALUE', message: 'Upload an image.', nodeId: 'img' },
      { code: 'MISSING_VALUE', message: 'Describe the edit or connect a prompt.', nodeId: 'e' },
    ]);
  });

  it('accepts an empty edit instruction when a prompt is wired', () => {
    const graph: Graph = {
      nodes: [promptNode('p'), imageInputNode('img'), editNode('e', { instruction: '' })],
      edges: [edge('img', 'e', 'image'), edge('p', 'e', 'prompt')],
    };
    expect(validateGraph(graph)).toEqual([]);
  });

  it('needs at least one AI node', () => {
    expect(codes({ nodes: [promptNode('p')], edges: [] })).toEqual(['NOTHING_TO_RUN']);
  });

  it('enforces the size limits', () => {
    const many = Array.from({ length: LIMITS.nodes + 1 }, (_, i) => promptNode(`p${i}`));
    expect(codes({ nodes: [...many, generateNode('g')], edges: [] })).toContain('LIMIT_EXCEEDED');

    const aiNodes = Array.from({ length: LIMITS.aiNodes + 1 }, (_, i) => generateNode(`g${i}`));
    expect(codes({ nodes: aiNodes, edges: [] })).toContain('LIMIT_EXCEEDED');

    const long = { nodes: [promptNode('p', 'x'.repeat(LIMITS.textLength + 1)), generateNode('g')], edges: [edge('p', 'g', 'prompt')] };
    expect(validateGraph(long)).toEqual([
      { code: 'LIMIT_EXCEEDED', message: 'Keep the prompt under 2000 characters.', nodeId: 'p' },
    ]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test`
Expected: FAIL — cannot load `./validate.ts`.

- [ ] **Step 3: Implement**

`packages/core/src/validate.ts`:
```ts
import { z } from 'zod';
import { describeTypeMismatch, nodeLabel } from './connect.ts';
import { indexGraph, topologicalOrder } from './graph-index.ts';
import type { Graph, GraphNode } from './graph.ts';
import { isAiNodeType, NODE_DEFINITIONS } from './nodes.ts';

export const LIMITS = { nodes: 30, edges: 60, aiNodes: 8, textLength: 2000 } as const;

export const ISSUE_CODES = [
  'SCHEMA_MISMATCH',
  'DUPLICATE_ID',
  'DANGLING_EDGE',
  'PORT_TYPE_MISMATCH',
  'INPUT_ALREADY_CONNECTED',
  'CYCLE',
  'MISSING_INPUT',
  'MISSING_VALUE',
  'NOTHING_TO_RUN',
  'LIMIT_EXCEEDED',
  'UNKNOWN_MODEL',
  'MODEL_UNAVAILABLE',
  'MODEL_CANNOT_EDIT',
  'UNKNOWN_PRESET',
  'UNKNOWN_ASSET',
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];

export const issueSchema = z.object({
  code: z.enum(ISSUE_CODES),
  message: z.string(),
  nodeId: z.string().optional(),
  edgeId: z.string().optional(),
});
export type Issue = z.infer<typeof issueSchema>;

/** Everything that can be checked from the graph alone. An empty array means the graph is runnable. */
export function validateGraph(graph: Graph): Issue[] {
  const issues: Issue[] = [...limitIssues(graph), ...duplicateIssues(graph)];
  const index = indexGraph(graph);
  const connected = new Set<string>();

  for (const edge of graph.edges) {
    const source = index.nodes.get(edge.source);
    const target = index.nodes.get(edge.target);
    if (!source || !target) {
      issues.push({ code: 'DANGLING_EDGE', message: 'This connection points to a missing node.', edgeId: edge.id });
      continue;
    }
    const output = NODE_DEFINITIONS[source.type].output;
    const input = NODE_DEFINITIONS[target.type].inputs.find((port) => port.handle === edge.targetHandle);
    if (!output || !input) {
      issues.push({
        code: 'DANGLING_EDGE',
        message: `${nodeLabel(target.type)} has no ${edge.targetHandle} input.`,
        nodeId: target.id,
        edgeId: edge.id,
      });
      continue;
    }
    if (output.type !== input.type) {
      issues.push({
        code: 'PORT_TYPE_MISMATCH',
        message: describeTypeMismatch(output.type, input.type),
        nodeId: target.id,
        edgeId: edge.id,
      });
    }
    const slot = `${target.id}:${input.handle}`;
    if (connected.has(slot)) {
      issues.push({
        code: 'INPUT_ALREADY_CONNECTED',
        message: `The ${input.label} input has more than one connection.`,
        nodeId: target.id,
        edgeId: edge.id,
      });
    }
    connected.add(slot);
  }

  if (topologicalOrder(index) === null) {
    issues.push({ code: 'CYCLE', message: 'The workflow contains a loop. Remove a connection to break it.' });
  }

  for (const node of graph.nodes) {
    for (const input of NODE_DEFINITIONS[node.type].inputs) {
      if (input.required && !connected.has(`${node.id}:${input.handle}`)) {
        issues.push({ code: 'MISSING_INPUT', message: `The ${input.label} input needs a connection.`, nodeId: node.id });
      }
    }
    issues.push(...valueIssues(node, connected));
  }
  return issues;
}

function limitIssues(graph: Graph): Issue[] {
  const issues: Issue[] = [];
  const aiNodes = graph.nodes.filter((node) => isAiNodeType(node.type)).length;
  if (graph.nodes.length > LIMITS.nodes) {
    issues.push({ code: 'LIMIT_EXCEEDED', message: `A workflow can have at most ${LIMITS.nodes} nodes.` });
  }
  if (graph.edges.length > LIMITS.edges) {
    issues.push({ code: 'LIMIT_EXCEEDED', message: `A workflow can have at most ${LIMITS.edges} connections.` });
  }
  if (aiNodes > LIMITS.aiNodes) {
    issues.push({
      code: 'LIMIT_EXCEEDED',
      message: `A workflow can have at most ${LIMITS.aiNodes} Generate or Edit nodes.`,
    });
  }
  if (aiNodes === 0) {
    issues.push({ code: 'NOTHING_TO_RUN', message: 'Add a Generate Image or Edit Image node to run the workflow.' });
  }
  return issues;
}

function duplicateIssues(graph: Graph): Issue[] {
  const issues: Issue[] = [];
  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({ code: 'DUPLICATE_ID', message: `Node id "${node.id}" is used more than once.`, nodeId: node.id });
    }
    nodeIds.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({ code: 'DUPLICATE_ID', message: `Connection id "${edge.id}" is used more than once.`, edgeId: edge.id });
    }
    edgeIds.add(edge.id);
  }
  return issues;
}

function valueIssues(node: GraphNode, connected: ReadonlySet<string>): Issue[] {
  const tooLong = (text: string): boolean => text.length > LIMITS.textLength;
  switch (node.type) {
    case 'prompt':
      if (node.data.text.trim() === '') return [{ code: 'MISSING_VALUE', message: 'Write a prompt.', nodeId: node.id }];
      return tooLong(node.data.text)
        ? [{ code: 'LIMIT_EXCEEDED', message: `Keep the prompt under ${LIMITS.textLength} characters.`, nodeId: node.id }]
        : [];
    case 'imageInput':
      return node.data.assetId === null ? [{ code: 'MISSING_VALUE', message: 'Upload an image.', nodeId: node.id }] : [];
    case 'editImage': {
      const promptWired = connected.has(`${node.id}:prompt`);
      if (!promptWired && node.data.instruction.trim() === '') {
        return [{ code: 'MISSING_VALUE', message: 'Describe the edit or connect a prompt.', nodeId: node.id }];
      }
      return tooLong(node.data.instruction)
        ? [{ code: 'LIMIT_EXCEEDED', message: `Keep the instruction under ${LIMITS.textLength} characters.`, nodeId: node.id }]
        : [];
    }
    case 'generateImage':
    case 'result':
      return [];
  }
}
```

Append to `packages/core/src/index.ts`:
```ts
export * from './validate.ts';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): add validateGraph with per-node issues and limits"
```

---

### Task 6: Run, catalog, preset and API contracts

**Files:**
- Create: `packages/core/src/run.ts`, `packages/core/src/catalog.ts`, `packages/core/src/preset.ts`, `packages/core/src/api.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/contracts.test.ts`

**Interfaces:**
- Consumes: `ASPECT_RATIOS`, `NODE_TYPES` (Task 2); `graphSchema` (Task 2); `issueSchema` (Task 5).
- Produces (zod schema + inferred type for each):
  - `run.ts`: `RUN_STATUSES`/`RunStatus`, `JOB_STATUSES`/`JobStatus`, `JOB_ERROR_CODES`/`JobErrorCode`, `isTerminalRunStatus(status)`, `textOutputSchema`/`TextOutput`, `imageOutputSchema`/`ImageOutput`, `nodeOutputSchema`/`NodeOutput`, `requestPreviewSchema`/`RequestPreview`, `jobErrorSchema`/`JobError`, `jobModelSchema`/`JobModel`, `jobSchema`/`Job`, `runSummarySchema`/`RunSummary`, `runSchema`/`Run`, `emptyRunSummary()`
  - `catalog.ts`: `PROVIDER_IDS`/`ProviderId`, `imageModelSchema`/`ImageModel`
  - `preset.ts`: `presetSchema`/`Preset`
  - `api.ts`: `createRunBodySchema`, `runIdResponseSchema`, `errorEnvelopeSchema`/`ErrorEnvelope`, `assetSchema`/`Asset`, `sampleSchema`/`Sample`, `catalogResponseSchema`, `presetsResponseSchema`, `samplesResponseSchema`, `runParamsSchema`, `retryParamsSchema`, `assetParamsSchema`, `assetUrl(assetId)`

- [ ] **Step 1: Write the failing tests**

`packages/core/src/contracts.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { assetParamsSchema, assetUrl, createRunBodySchema, errorEnvelopeSchema } from './api.ts';
import { imageModelSchema } from './catalog.ts';
import { presetSchema } from './preset.ts';
import { emptyRunSummary, isTerminalRunStatus, runSchema, type Run } from './run.ts';
import { branchingGraph } from './testing.ts';

const sampleRun: Run = {
  id: 'run_abc',
  status: 'running',
  version: 3,
  createdAt: 1,
  startedAt: 2,
  finishedAt: null,
  jobs: {
    prompt: { nodeId: 'prompt', nodeType: 'prompt', status: 'success', attempt: 1, startedAt: 2, finishedAt: 2, cached: false, output: { kind: 'text', text: 'hi' } },
    'gen-a': {
      nodeId: 'gen-a',
      nodeType: 'generateImage',
      status: 'error',
      attempt: 1,
      startedAt: 2,
      finishedAt: 5,
      cached: false,
      error: { code: 'TIMEOUT', message: 'No answer.', retryable: true },
      request: {
        modelId: 'mock',
        prompt: 'hi',
        negativePrompt: null,
        negativeMode: 'none',
        references: [],
        aspectRatio: '1:1',
        seed: 1,
        warnings: [],
      },
    },
  },
  summary: emptyRunSummary(),
};

describe('contracts', () => {
  it('parses a run snapshot', () => {
    expect(runSchema.parse(sampleRun)).toEqual(sampleRun);
  });

  it('knows which run statuses are final', () => {
    expect(isTerminalRunStatus('completed')).toBe(true);
    expect(isTerminalRunStatus('failed')).toBe(true);
    expect(isTerminalRunStatus('queued')).toBe(false);
    expect(isTerminalRunStatus('running')).toBe(false);
  });

  it('accepts a preset in exactly the brief\'s shape', () => {
    const preset = {
      id: 'premium-3d',
      name: 'Premium 3D',
      mainPrompt: 'premium minimal 3D visual',
      negativePrompt: 'clutter, noisy background',
      references: ['/references/ref-1.png', '/references/ref-2.png'],
    };
    expect(presetSchema.parse(preset)).toEqual(preset);
  });

  it('describes models by capability', () => {
    expect(
      imageModelSchema.safeParse({
        id: 'mock',
        label: 'Mock',
        provider: 'mock',
        default: true,
        enabled: true,
        unavailableReason: null,
        supportsEdit: true,
        supportsNegativePrompt: true,
        supportsSeed: true,
        maxReferenceImages: 14,
        aspectRatios: ['1:1'],
        costPerImageUsd: 0,
      }).success,
    ).toBe(true);
  });

  it('wraps a graph in the create-run body', () => {
    expect(createRunBodySchema.safeParse({ graph: branchingGraph() }).success).toBe(true);
  });

  it('describes errors with one envelope', () => {
    expect(
      errorEnvelopeSchema.safeParse({
        error: { code: 'INVALID_GRAPH', message: 'Fix 1 issue.', issues: [{ code: 'CYCLE', message: 'Loop.' }] },
      }).success,
    ).toBe(true);
  });

  it('builds asset URLs from SHA-256 ids', () => {
    const id = 'f'.repeat(64);
    expect(assetUrl(id)).toBe(`/api/assets/${id}`);
    expect(assetParamsSchema.safeParse({ assetId: id }).success).toBe(true);
    expect(assetParamsSchema.safeParse({ assetId: '../etc/passwd' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test`
Expected: FAIL — cannot load `./api.ts`, `./run.ts`, …

- [ ] **Step 3: Implement the run contract**

`packages/core/src/run.ts`:
```ts
import { z } from 'zod';
import { ASPECT_RATIOS, NODE_TYPES } from './nodes.ts';

export const RUN_STATUSES = ['queued', 'running', 'completed', 'failed'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const JOB_STATUSES = ['idle', 'queued', 'running', 'success', 'error'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_ERROR_CODES = ['PROVIDER_ERROR', 'TIMEOUT', 'UPSTREAM_FAILED', 'INVALID_INPUT', 'INTERNAL'] as const;
export type JobErrorCode = (typeof JOB_ERROR_CODES)[number];

export const isTerminalRunStatus = (status: RunStatus): boolean => status === 'completed' || status === 'failed';

export const textOutputSchema = z.object({ kind: z.literal('text'), text: z.string() });
export const imageOutputSchema = z.object({
  kind: z.literal('image'),
  assetId: z.string(),
  url: z.string(),
  width: z.number().int(),
  height: z.number().int(),
});
export const nodeOutputSchema = z.discriminatedUnion('kind', [textOutputSchema, imageOutputSchema]);

export const requestPreviewSchema = z.object({
  modelId: z.string(),
  prompt: z.string(),
  negativePrompt: z.string().nullable(),
  negativeMode: z.enum(['native', 'folded', 'none']),
  references: z.array(z.object({ assetId: z.string(), url: z.string(), role: z.enum(['source', 'preset']) })),
  aspectRatio: z.enum(ASPECT_RATIOS).nullable(),
  seed: z.number().int().nullable(),
  warnings: z.array(z.string()),
});

export const jobErrorSchema = z.object({
  code: z.enum(JOB_ERROR_CODES),
  message: z.string(),
  retryable: z.boolean(),
  upstreamNodeId: z.string().optional(),
});

export const jobModelSchema = z.object({
  id: z.string(),
  provider: z.string(),
  fallbackFrom: z.string().optional(),
});

export const jobSchema = z.object({
  nodeId: z.string(),
  nodeType: z.enum(NODE_TYPES),
  status: z.enum(JOB_STATUSES),
  attempt: z.number().int().min(1),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  cached: z.boolean(),
  output: nodeOutputSchema.optional(),
  error: jobErrorSchema.optional(),
  request: requestPreviewSchema.optional(),
  model: jobModelSchema.optional(),
});

export const runSummarySchema = z.object({
  aiNodes: z.number().int(),
  generated: z.number().int(),
  reused: z.number().int(),
  failed: z.number().int(),
  savedMs: z.number(),
  fallbacks: z.number().int(),
});

export const runSchema = z.object({
  id: z.string(),
  status: z.enum(RUN_STATUSES),
  version: z.number().int(),
  createdAt: z.number(),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  jobs: z.record(z.string(), jobSchema),
  summary: runSummarySchema,
});

export type TextOutput = z.infer<typeof textOutputSchema>;
export type ImageOutput = z.infer<typeof imageOutputSchema>;
export type NodeOutput = z.infer<typeof nodeOutputSchema>;
export type RequestPreview = z.infer<typeof requestPreviewSchema>;
export type JobError = z.infer<typeof jobErrorSchema>;
export type JobModel = z.infer<typeof jobModelSchema>;
export type Job = z.infer<typeof jobSchema>;
export type RunSummary = z.infer<typeof runSummarySchema>;
export type Run = z.infer<typeof runSchema>;

export const emptyRunSummary = (): RunSummary => ({
  aiNodes: 0,
  generated: 0,
  reused: 0,
  failed: 0,
  savedMs: 0,
  fallbacks: 0,
});
```

- [ ] **Step 4: Implement catalog, preset and API contracts**

`packages/core/src/catalog.ts`:
```ts
import { z } from 'zod';
import { ASPECT_RATIOS } from './nodes.ts';

export const PROVIDER_IDS = ['cloudflare', 'byteplus', 'mock'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const imageModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.enum(PROVIDER_IDS),
  default: z.boolean(),
  enabled: z.boolean(),
  unavailableReason: z.string().nullable(),
  supportsEdit: z.boolean(),
  supportsNegativePrompt: z.boolean(),
  supportsSeed: z.boolean(),
  maxReferenceImages: z.number().int().min(0),
  aspectRatios: z.array(z.enum(ASPECT_RATIOS)),
  costPerImageUsd: z.number().min(0),
});
export type ImageModel = z.infer<typeof imageModelSchema>;
```

`packages/core/src/preset.ts`:
```ts
import { z } from 'zod';

/** Exactly the brief's shape. The API serves `references` as asset URLs. */
export const presetSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  mainPrompt: z.string(),
  negativePrompt: z.string(),
  references: z.array(z.string()),
});
export type Preset = z.infer<typeof presetSchema>;
```

`packages/core/src/api.ts`:
```ts
import { z } from 'zod';
import { imageModelSchema } from './catalog.ts';
import { graphSchema } from './graph.ts';
import { presetSchema } from './preset.ts';
import { issueSchema } from './validate.ts';

export const createRunBodySchema = z.object({ graph: graphSchema });
export const runIdResponseSchema = z.object({ runId: z.string() });

export const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), issues: z.array(issueSchema).optional() }),
});

export const assetSchema = z.object({
  assetId: z.string(),
  url: z.string(),
  width: z.number().int(),
  height: z.number().int(),
});
export const sampleSchema = assetSchema.extend({ id: z.string(), name: z.string() });

export const catalogResponseSchema = z.object({ models: z.array(imageModelSchema) });
export const presetsResponseSchema = z.object({ presets: z.array(presetSchema) });
export const samplesResponseSchema = z.object({ samples: z.array(sampleSchema) });

export const runParamsSchema = z.object({ runId: z.string().min(1) });
export const retryParamsSchema = z.object({ runId: z.string().min(1), nodeId: z.string().min(1) });
export const assetParamsSchema = z.object({ assetId: z.string().regex(/^[a-f0-9]{64}$/) });

export type CreateRunBody = z.infer<typeof createRunBodySchema>;
export type RunIdResponse = z.infer<typeof runIdResponseSchema>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Sample = z.infer<typeof sampleSchema>;
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
export type PresetsResponse = z.infer<typeof presetsResponseSchema>;
export type SamplesResponse = z.infer<typeof samplesResponseSchema>;

export const assetUrl = (assetId: string): string => `/api/assets/${assetId}`;
```

`packages/core/src/index.ts` (final):
```ts
export * from './ports.ts';
export * from './nodes.ts';
export * from './graph.ts';
export * from './graph-index.ts';
export * from './connect.ts';
export * from './validate.ts';
export * from './run.ts';
export * from './catalog.ts';
export * from './preset.ts';
export * from './api.ts';
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS; `tsc` exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "feat(core): add run, job, catalog, preset and API contracts"
```

---
### Task 7: Server skeleton — config, logger, HTTP server, error envelope

**Files:**
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`
- Create: `apps/server/src/config.ts`, `apps/server/src/lib/logger.ts`, `apps/server/src/http/errors.ts`, `apps/server/src/http/server.ts`, `apps/server/src/app.ts`, `apps/server/src/main.ts`
- Modify: `vitest.config.ts`
- Test: `apps/server/src/config.test.ts`, `apps/server/src/http/server.test.ts`

**Interfaces:**
- Consumes: `Issue`, `ErrorEnvelope` from `@trafaret/core`.
- Produces:
  - `type Config = { env: 'development' | 'test' | 'production'; host: string; port: number; logLevel: LogLevel; cloudflare: { accountId: string; apiToken: string } | null; byteplus: { apiKey: string } | null; maxConcurrentJobs: number; jobTimeoutMs: number; dailyLimits: { cloudflare: number; byteplus: number }; mockLatencyMs: { min: number; max: number } }`
  - `loadConfig(env: Record<string, string | undefined>): Config` — throws `Error('Invalid environment: …')`
  - `createLogger(options: { level: string }): Logger` (pino)
  - `class AppError extends Error { statusCode; code; issues }`, `errorBody(code, message, issues?): ErrorEnvelope`
  - `MAX_UPLOAD_BYTES = 10 * 1024 * 1024`
  - `createHttpServer(options: { logger: Logger; trustProxy?: boolean; rateLimitKey?: (request: FastifyRequest) => string }): Promise<FastifyInstance>` — zod validation, error envelope, OpenAPI at `/api/docs` (JSON at `/api/docs/json`), multipart, rate-limit plugin (`global: false`), `GET /api/health`

- [ ] **Step 1: Create the package and install dependencies**

`apps/server/package.json`:
```json
{
  "name": "@trafaret/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch --env-file-if-exists=../../.env src/main.ts",
    "start": "node src/main.ts",
    "typecheck": "tsc -p tsconfig.json"
  }
}
```

`apps/server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "scripts"]
}
```

`vitest.config.ts` — change the projects line to:
```ts
    projects: ['packages/*', 'apps/*'],
```

Run:
```bash
pnpm --filter @trafaret/server add @trafaret/core@workspace:* fastify@^5.12.5 fastify-type-provider-zod@^7.0.0 @fastify/swagger@^9.9.1 @fastify/swagger-ui@^6.1.1 @fastify/multipart@^10.1.2 @fastify/rate-limit@^11.2.0 pino@^10.4.0 zod@^4.6.5
```
Expected: installs without peer warnings.

- [ ] **Step 2: Write the failing config test**

`apps/server/src/config.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('applies the documented defaults', () => {
    expect(loadConfig({})).toMatchObject({
      env: 'development',
      host: '0.0.0.0',
      port: 8080,
      maxConcurrentJobs: 4,
      jobTimeoutMs: 120_000,
      dailyLimits: { cloudflare: 80, byteplus: 20 },
      mockLatencyMs: { min: 1200, max: 3500 },
      cloudflare: null,
      byteplus: null,
    });
  });

  it('treats empty keys as missing', () => {
    const config = loadConfig({ ARK_API_KEY: '', CLOUDFLARE_ACCOUNT_ID: '', CLOUDFLARE_API_TOKEN: '' });
    expect(config.byteplus).toBeNull();
    expect(config.cloudflare).toBeNull();
  });

  it('enables a provider only when all of its keys are present', () => {
    expect(loadConfig({ CLOUDFLARE_ACCOUNT_ID: 'acc' }).cloudflare).toBeNull();
    expect(loadConfig({ CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok' }).cloudflare).toEqual({
      accountId: 'acc',
      apiToken: 'tok',
    });
    expect(loadConfig({ ARK_API_KEY: 'key' }).byteplus).toEqual({ apiKey: 'key' });
  });

  it('parses the mock latency range in either order', () => {
    expect(loadConfig({ MOCK_LATENCY_MS: '50-10' }).mockLatencyMs).toEqual({ min: 10, max: 50 });
  });

  it('fails fast with the name of the bad variable', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfig({ MOCK_LATENCY_MS: 'fast' })).toThrow(/MOCK_LATENCY_MS/);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm test apps/server`
Expected: FAIL — cannot load `./config.ts`.

- [ ] **Step 4: Implement the config**

`apps/server/src/config.ts`:
```ts
import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const optionalSecret = z.preprocess((value) => (value === '' ? undefined : value), z.string().min(1).optional());

const latencyRange = z
  .string()
  .regex(/^\d+-\d+$/, 'use "min-max", e.g. 1200-3500')
  .transform((value) => {
    const [a = 0, b = 0] = value.split('-').map(Number);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  CLOUDFLARE_ACCOUNT_ID: optionalSecret,
  CLOUDFLARE_API_TOKEN: optionalSecret,
  ARK_API_KEY: optionalSecret,
  MAX_CONCURRENT_JOBS: z.coerce.number().int().min(1).max(16).default(4),
  JOB_TIMEOUT_MS: z.coerce.number().int().min(1).default(120_000),
  DAILY_LIMIT_CLOUDFLARE: z.coerce.number().int().min(0).default(80),
  DAILY_LIMIT_BYTEPLUS: z.coerce.number().int().min(0).default(20),
  MOCK_LATENCY_MS: latencyRange.default({ min: 1200, max: 3500 }),
});

export type Config = {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: LogLevel;
  cloudflare: { accountId: string; apiToken: string } | null;
  byteplus: { apiKey: string } | null;
  maxConcurrentJobs: number;
  jobTimeoutMs: number;
  dailyLimits: { cloudflare: number; byteplus: number };
  mockLatencyMs: { min: number; max: number };
};

/** Validates the environment once at boot. Missing provider keys disable models; they never crash the server. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    cloudflare:
      e.CLOUDFLARE_ACCOUNT_ID && e.CLOUDFLARE_API_TOKEN
        ? { accountId: e.CLOUDFLARE_ACCOUNT_ID, apiToken: e.CLOUDFLARE_API_TOKEN }
        : null,
    byteplus: e.ARK_API_KEY ? { apiKey: e.ARK_API_KEY } : null,
    maxConcurrentJobs: e.MAX_CONCURRENT_JOBS,
    jobTimeoutMs: e.JOB_TIMEOUT_MS,
    dailyLimits: { cloudflare: e.DAILY_LIMIT_CLOUDFLARE, byteplus: e.DAILY_LIMIT_BYTEPLUS },
    mockLatencyMs: e.MOCK_LATENCY_MS,
  };
}
```

Note: in zod 4, `.default()` on a transformed schema takes the **output** value, hence `{ min: 1200, max: 3500 }`.

- [ ] **Step 5: Run the config test**

Run: `pnpm test apps/server`
Expected: PASS (5 tests).

- [ ] **Step 6: Write the failing HTTP server test**

`apps/server/src/http/server.test.ts`:
```ts
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from './errors.ts';
import { createHttpServer } from './server.ts';

const logger = pino({ level: 'silent' });

describe('createHttpServer', () => {
  it('answers health checks', async () => {
    const app = await createHttpServer({ logger });
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('serves the OpenAPI document', async () => {
    const app = await createHttpServer({ logger });
    const response = await app.inject({ method: 'GET', url: '/api/docs/json' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ openapi: expect.stringMatching(/^3\./), info: { title: 'Trafaret API' } });
  });

  it('answers unknown routes with the error envelope', async () => {
    const app = await createHttpServer({ logger });
    const response = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('turns AppError into the error envelope', async () => {
    const app = await createHttpServer({ logger });
    app.get('/boom', () => {
      throw new AppError(409, 'CONFLICT', 'Nope.');
    });
    const response = await app.inject({ method: 'GET', url: '/boom' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: 'CONFLICT', message: 'Nope.' } });
  });

  it('reports request-shape errors as SCHEMA_MISMATCH issues', async () => {
    const app = await createHttpServer({ logger });
    app
      .withTypeProvider<ZodTypeProvider>()
      .post('/echo', { schema: { body: z.object({ name: z.string() }) } }, (request) => request.body);
    const response = await app.inject({ method: 'POST', url: '/echo', payload: { name: 42 } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'INVALID_REQUEST', issues: [{ code: 'SCHEMA_MISMATCH' }] } });
  });

  it('never leaks internal error details', async () => {
    const app = await createHttpServer({ logger });
    app.get('/crash', () => {
      throw new Error('secret connection string');
    });
    const response = await app.inject({ method: 'GET', url: '/crash' });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('secret');
    expect(response.json()).toMatchObject({ error: { code: 'INTERNAL' } });
  });
});
```

- [ ] **Step 7: Run it to see it fail**

Run: `pnpm test apps/server`
Expected: FAIL — cannot load `./errors.ts` / `./server.ts`.

- [ ] **Step 8: Implement logger, errors and the HTTP server**

`apps/server/src/lib/logger.ts`:
```ts
import { pino, type Logger } from 'pino';

export function createLogger(options: { level: string }): Logger {
  return pino({
    level: options.level,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', '*.apiKey', '*.apiToken'],
      censor: '[redacted]',
    },
  });
}
```

`apps/server/src/http/errors.ts`:
```ts
import type { ErrorEnvelope, Issue } from '@trafaret/core';

/** An error with an HTTP status and a stable code; rendered as the error envelope. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly issues: Issue[] | undefined;

  constructor(statusCode: number, code: string, message: string, issues?: Issue[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.issues = issues;
  }
}

export function errorBody(code: string, message: string, issues?: Issue[]): ErrorEnvelope {
  return { error: issues === undefined ? { code, message } : { code, message, issues } };
}
```

`apps/server/src/http/server.ts`:
```ts
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyBaseLogger, type FastifyInstance, type FastifyRequest } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Logger } from 'pino';
import { z } from 'zod';
import type { Issue } from '@trafaret/core';
import { AppError, errorBody } from './errors.ts';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type HttpServerOptions = {
  logger: Logger;
  trustProxy?: boolean;
  /** Identifies a client for rate limiting; defaults to the request IP. */
  rateLimitKey?: (request: FastifyRequest) => string;
};

/** Fastify with zod validation, the error envelope, OpenAPI docs, uploads, rate limiting and /api/health. */
export async function createHttpServer(options: HttpServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: options.logger as FastifyBaseLogger,
    trustProxy: options.trustProxy ?? false,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(app);

  await app.register(swagger, {
    openapi: {
      info: { title: 'Trafaret API', description: 'Define and run node-based AI image workflows.', version: '0.1.0' },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });
  await app.register(rateLimit, {
    global: false,
    ...(options.rateLimitKey ? { keyGenerator: options.rateLimitKey } : {}),
    errorResponseBuilder: (_request, context) =>
      new AppError(429, 'RATE_LIMITED', `Too many requests. Try again in ${context.after}.`),
  });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, parts: 5 } });

  app
    .withTypeProvider<ZodTypeProvider>()
    .get('/api/health', { schema: { response: { 200: z.object({ ok: z.literal(true) }) } } }, () => ({
      ok: true as const,
    }));

  return app;
}

function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const issues: Issue[] = error.validation.map((item) => ({
        code: 'SCHEMA_MISMATCH',
        message: `${item.instancePath || 'body'} ${item.message ?? 'is invalid'}`.trim(),
      }));
      return reply.code(400).send(errorBody('INVALID_REQUEST', "The request doesn't match the API schema.", issues));
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(errorBody(error.code, error.message, error.issues));
    }
    if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.code(413).send(errorBody('FILE_TOO_LARGE', 'Images must be 10 MB or smaller.'));
    }
    if (error.statusCode === 429) {
      return reply.code(429).send(errorBody('RATE_LIMITED', 'Too many requests. Try again in a minute.'));
    }
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) return reply.code(status).send(errorBody('BAD_REQUEST', error.message));
    request.log.error({ err: error }, 'unhandled error');
    return reply.code(500).send(errorBody('INTERNAL', 'Something went wrong on our side. Try again in a moment.'));
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send(errorBody('NOT_FOUND', `Nothing at ${request.method} ${request.url}.`)),
  );
}
```

- [ ] **Step 9: Add the app factory and entry point**

`apps/server/src/app.ts` (Task 21 grows this into the full composition root):
```ts
import type { FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import type { Config } from './config.ts';
import { createHttpServer } from './http/server.ts';

export async function buildApp(config: Config, logger: Logger): Promise<FastifyInstance> {
  return createHttpServer({ logger, trustProxy: config.env === 'production' });
}
```

`apps/server/src/main.ts`:
```ts
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createLogger } from './lib/logger.ts';

const config = loadConfig(process.env);
const logger = createLogger({ level: config.logLevel });
const app = await buildApp(config, logger);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'shutting down');
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: config.host, port: config.port });
```

- [ ] **Step 10: Run the tests, typecheck and lint**

Run: `pnpm test && pnpm typecheck && pnpm format && pnpm lint`
Expected: all PASS.

- [ ] **Step 11: Smoke-test the server**

Run: `pnpm dev` (leave it running), then in another terminal:
```bash
curl -s localhost:8080/api/health
```
Expected: `{"ok":true}`. Open `http://localhost:8080/api/docs` — the Swagger UI loads. Stop the server with Ctrl+C.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(server): add config, HTTP server with error envelope, OpenAPI docs and health check"
```

---

### Task 8: Images and the content-addressed asset store

**Files:**
- Create: `apps/server/src/lib/hash.ts`, `apps/server/src/assets/image.ts`, `apps/server/src/assets/asset-store.ts`, `apps/server/src/test/images.ts`
- Test: `apps/server/src/assets/image.test.ts`, `apps/server/src/assets/asset-store.test.ts`

**Interfaces:**
- Consumes: `ASPECT_RATIOS`, `AspectRatio` from `@trafaret/core`.
- Produces:
  - `sha256Hex(data: string | Buffer): string`
  - `type ImageInfo = { format: 'png' | 'jpeg' | 'webp'; mime: string; width: number; height: number }`
  - `inspectImage(bytes: Buffer): Promise<ImageInfo | null>`, `toWebp(bytes: Buffer, quality?: number): Promise<Buffer>`, `fitWithin(bytes: Buffer, maxSide: number): Promise<Buffer>` (PNG out), `closestAspectRatio(width, height): AspectRatio`
  - `type StoredAsset = { id; bytes; mime; width; height; pinned }`, `class UnsupportedImageError`, `class AssetStore { constructor({ maxBytes }); put(bytes, { pinned? }): Promise<StoredAsset>; get(id); has(id); usage }`
  - test helper `makePng(width?, height?, color?): Promise<Buffer>`

- [ ] **Step 1: Install sharp and add the test helper**

Run:
```bash
pnpm --filter @trafaret/server add sharp@^0.35.5
```

`apps/server/src/test/images.ts`:
```ts
import sharp from 'sharp';

/** A solid-colour PNG for tests. */
export async function makePng(width = 8, height = 8, color = '#ff5f1f'): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
}
```

- [ ] **Step 2: Write the failing tests**

`apps/server/src/assets/image.test.ts`:
```ts
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { makePng } from '../test/images.ts';
import { closestAspectRatio, fitWithin, inspectImage, toWebp } from './image.ts';

describe('inspectImage', () => {
  it('reads format and size from the bytes', async () => {
    expect(await inspectImage(await makePng(6, 4))).toEqual({ format: 'png', mime: 'image/png', width: 6, height: 4 });
    expect(await inspectImage(await toWebp(await makePng(6, 4)))).toMatchObject({ format: 'webp', mime: 'image/webp' });
  });

  it('rejects anything that is not PNG, JPEG or WebP', async () => {
    expect(await inspectImage(Buffer.from('hello'))).toBeNull();
    expect(await inspectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>'))).toBeNull();
  });
});

describe('fitWithin', () => {
  it('shrinks large images to fit the box', async () => {
    const meta = await sharp(await fitWithin(await makePng(1200, 600), 511)).metadata();
    expect(meta.width).toBe(511);
    expect(meta.height).toBeLessThanOrEqual(511);
  });

  it('never enlarges small images', async () => {
    const meta = await sharp(await fitWithin(await makePng(40, 20), 511)).metadata();
    expect([meta.width, meta.height]).toEqual([40, 20]);
  });
});

describe('closestAspectRatio', () => {
  it.each([
    [1024, 1024, '1:1'],
    [1920, 1080, '16:9'],
    [1000, 1300, '3:4'],
    [500, 1200, '9:16'],
    [1300, 1000, '4:3'],
  ] as const)('maps %ix%i to %s', (width, height, expected) => {
    expect(closestAspectRatio(width, height)).toBe(expected);
  });
});
```

`apps/server/src/assets/asset-store.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../lib/hash.ts';
import { makePng } from '../test/images.ts';
import { AssetStore, UnsupportedImageError } from './asset-store.ts';

describe('AssetStore', () => {
  it('stores images under the SHA-256 of their bytes', async () => {
    const png = await makePng(4, 3);
    const store = new AssetStore({ maxBytes: 1_000_000 });
    const asset = await store.put(png);
    expect(asset).toMatchObject({ id: sha256Hex(png), mime: 'image/png', width: 4, height: 3, pinned: false });
    expect(store.get(asset.id)?.bytes.equals(png)).toBe(true);
  });

  it('deduplicates identical images', async () => {
    const png = await makePng();
    const store = new AssetStore({ maxBytes: 1_000_000 });
    await store.put(png);
    await store.put(png);
    expect(store.usage).toEqual({ count: 1, bytes: png.length });
  });

  it('rejects bytes that are not PNG, JPEG or WebP', async () => {
    const store = new AssetStore({ maxBytes: 1_000_000 });
    await expect(store.put(Buffer.from('hello'))).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it('evicts the least recently used image past the byte budget', async () => {
    const [a, b, c] = await Promise.all([makePng(8, 8, '#111111'), makePng(8, 8, '#222222'), makePng(8, 8, '#333333')]);
    const store = new AssetStore({ maxBytes: a.length + b.length + c.length - 1 });
    const first = await store.put(a);
    const second = await store.put(b);
    store.get(first.id); // touch: "a" becomes the most recently used
    const third = await store.put(c);
    expect(store.has(first.id)).toBe(true);
    expect(store.has(second.id)).toBe(false);
    expect(store.has(third.id)).toBe(true);
  });

  it('never evicts pinned images', async () => {
    const [a, b] = await Promise.all([makePng(8, 8, '#111111'), makePng(8, 8, '#222222')]);
    const store = new AssetStore({ maxBytes: 1 });
    const pinned = await store.put(a, { pinned: true });
    const loose = await store.put(b);
    expect(store.has(pinned.id)).toBe(true);
    expect(store.has(loose.id)).toBe(false);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm test apps/server`
Expected: FAIL — cannot load `./image.ts`, `./asset-store.ts`, `../lib/hash.ts`.

- [ ] **Step 4: Implement**

`apps/server/src/lib/hash.ts`:
```ts
import { createHash } from 'node:crypto';

export const sha256Hex = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex');
```

`apps/server/src/assets/image.ts`:
```ts
import sharp from 'sharp';
import { ASPECT_RATIOS, type AspectRatio } from '@trafaret/core';

export type ImageFormat = 'png' | 'jpeg' | 'webp';
export type ImageInfo = { format: ImageFormat; mime: string; width: number; height: number };

const MIME_BY_FORMAT: Record<ImageFormat, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
const isSupported = (format: string | undefined): format is ImageFormat =>
  format === 'png' || format === 'jpeg' || format === 'webp';

/** Reads the real format from the bytes (never trusts a file name or Content-Type). SVG is rejected on purpose. */
export async function inspectImage(bytes: Buffer): Promise<ImageInfo | null> {
  try {
    const { format, width, height } = await sharp(bytes).metadata();
    if (!isSupported(format) || !width || !height) return null;
    return { format, mime: MIME_BY_FORMAT[format], width, height };
  } catch {
    return null;
  }
}

export const toWebp = (bytes: Buffer, quality = 90): Promise<Buffer> => sharp(bytes).webp({ quality }).toBuffer();

/** Shrinks (never enlarges) an image to fit a square box; re-encodes as PNG. */
export const fitWithin = (bytes: Buffer, maxSide: number): Promise<Buffer> =>
  sharp(bytes).resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true }).png().toBuffer();

const RATIO_VALUES: Record<AspectRatio, number> = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '16:9': 16 / 9, '9:16': 9 / 16 };

/** The supported aspect ratio closest to width/height, compared on a log scale so 2:1 and 1:2 are symmetric. */
export function closestAspectRatio(width: number, height: number): AspectRatio {
  const target = Math.log(width / height);
  const distance = (ratio: AspectRatio): number => Math.abs(Math.log(RATIO_VALUES[ratio]) - target);
  return ASPECT_RATIOS.reduce((best, ratio) => (distance(ratio) < distance(best) ? ratio : best));
}
```

`apps/server/src/assets/asset-store.ts`:
```ts
import { sha256Hex } from '../lib/hash.ts';
import { inspectImage } from './image.ts';

export type StoredAsset = {
  readonly id: string;
  readonly bytes: Buffer;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  pinned: boolean;
};

export class UnsupportedImageError extends Error {
  constructor() {
    super('Only PNG, JPEG and WebP images are supported.');
    this.name = 'UnsupportedImageError';
  }
}

/**
 * In-memory, content-addressed image store. The id is the SHA-256 of the bytes, so identical images dedupe and an
 * id never points at different content. Past `maxBytes`, the least recently used unpinned images are evicted.
 */
export class AssetStore {
  private readonly assets = new Map<string, StoredAsset>();
  private readonly maxBytes: number;
  private totalBytes = 0;

  constructor(options: { maxBytes: number }) {
    this.maxBytes = options.maxBytes;
  }

  async put(bytes: Buffer, options: { pinned?: boolean } = {}): Promise<StoredAsset> {
    const id = sha256Hex(bytes);
    const existing = this.assets.get(id);
    if (existing) {
      if (options.pinned) existing.pinned = true;
      this.touch(existing);
      return existing;
    }
    const info = await inspectImage(bytes);
    if (!info) throw new UnsupportedImageError();
    const asset: StoredAsset = {
      id,
      bytes,
      mime: info.mime,
      width: info.width,
      height: info.height,
      pinned: options.pinned ?? false,
    };
    this.assets.set(id, asset);
    this.totalBytes += bytes.length;
    this.evict();
    return asset;
  }

  get(id: string): StoredAsset | undefined {
    const asset = this.assets.get(id);
    if (asset) this.touch(asset);
    return asset;
  }

  has(id: string): boolean {
    return this.assets.has(id);
  }

  get usage(): { count: number; bytes: number } {
    return { count: this.assets.size, bytes: this.totalBytes };
  }

  /** Map iteration order doubles as LRU order: re-inserting moves an asset to the end. */
  private touch(asset: StoredAsset): void {
    this.assets.delete(asset.id);
    this.assets.set(asset.id, asset);
  }

  private evict(): void {
    for (const asset of this.assets.values()) {
      if (this.totalBytes <= this.maxBytes) return;
      if (asset.pinned) continue;
      this.assets.delete(asset.id);
      this.totalBytes -= asset.bytes.length;
    }
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test apps/server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(server): add image inspection and a content-addressed LRU asset store"
```

---

### Task 9: Asset routes — upload and serve images

**Files:**
- Create: `apps/server/src/assets/routes.ts`
- Test: `apps/server/src/assets/routes.test.ts`

**Interfaces:**
- Consumes: `createHttpServer`, `MAX_UPLOAD_BYTES`, `AppError` (Task 7); `AssetStore`, `StoredAsset`, `inspectImage` (Task 8); `assetSchema`, `assetParamsSchema`, `assetUrl`, `type Asset` from `@trafaret/core`.
- Produces:
  - `MAX_UPLOAD_SIDE = 4096`
  - `toAssetResponse(asset: StoredAsset): Asset`
  - `registerAssetRoutes(app: FastifyInstance, options: { assets: AssetStore; uploadsPer10Minutes: number }): void` — `POST /api/assets` (multipart field `file`) → `201 Asset`; `GET /api/assets/:assetId` → bytes

- [ ] **Step 1: Install the multipart test client**

Run:
```bash
pnpm --filter @trafaret/server add -D form-data@^4.0.6
```

- [ ] **Step 2: Write the failing tests**

`apps/server/src/assets/routes.test.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import FormData from 'form-data';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { createHttpServer, MAX_UPLOAD_BYTES } from '../http/server.ts';
import { makePng } from '../test/images.ts';
import { AssetStore } from './asset-store.ts';
import { registerAssetRoutes } from './routes.ts';

async function setup(uploadsPer10Minutes = 100) {
  const app = await createHttpServer({ logger: pino({ level: 'silent' }) });
  const assets = new AssetStore({ maxBytes: 50 * 1024 * 1024 });
  registerAssetRoutes(app, { assets, uploadsPer10Minutes });
  return { app, assets };
}

function upload(app: FastifyInstance, bytes: Buffer, filename = 'photo.png') {
  const form = new FormData();
  form.append('file', bytes, { filename });
  return app.inject({ method: 'POST', url: '/api/assets', payload: form, headers: form.getHeaders() });
}

describe('asset routes', () => {
  it('stores an upload and serves it back with immutable caching', async () => {
    const { app } = await setup();
    const png = await makePng(6, 4);
    const created = await upload(app, png);
    expect(created.statusCode).toBe(201);
    const body = created.json<{ assetId: string; url: string; width: number; height: number }>();
    expect(body).toMatchObject({ width: 6, height: 4, url: `/api/assets/${body.assetId}` });

    const served = await app.inject({ method: 'GET', url: body.url });
    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(served.rawPayload.equals(png)).toBe(true);
  });

  it('rejects files that are not PNG, JPEG or WebP', async () => {
    const { app } = await setup();
    const response = await upload(app, Buffer.from('definitely not an image'), 'notes.png');
    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({ error: { code: 'UNSUPPORTED_IMAGE' } });
  });

  it('rejects images larger than 4096 px on a side', async () => {
    const { app } = await setup();
    const response = await upload(app, await makePng(4097, 2));
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: { code: 'IMAGE_TOO_LARGE' } });
  });

  it('rejects files over 10 MB', async () => {
    const { app } = await setup();
    const response = await upload(app, Buffer.alloc(MAX_UPLOAD_BYTES + 1));
    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ error: { code: 'FILE_TOO_LARGE' } });
  });

  it('requires a file', async () => {
    const { app } = await setup();
    const form = new FormData();
    form.append('note', 'no file here');
    const response = await app.inject({ method: 'POST', url: '/api/assets', payload: form, headers: form.getHeaders() });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'NO_FILE' } });
  });

  it('answers 404 for unknown ids and 400 for malformed ones', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'GET', url: `/api/assets/${'0'.repeat(64)}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/assets/not-a-hash' })).statusCode).toBe(400);
  });

  it('rate limits uploads per client', async () => {
    const { app } = await setup(1);
    expect((await upload(app, await makePng())).statusCode).toBe(201);
    const limited = await upload(app, await makePng(9, 9));
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm test apps/server`
Expected: FAIL — cannot load `./routes.ts`.

- [ ] **Step 4: Implement**

`apps/server/src/assets/routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { assetParamsSchema, assetSchema, assetUrl, type Asset } from '@trafaret/core';
import { AppError } from '../http/errors.ts';
import type { AssetStore, StoredAsset } from './asset-store.ts';
import { inspectImage } from './image.ts';

export const MAX_UPLOAD_SIDE = 4096;

export const toAssetResponse = (asset: StoredAsset): Asset => ({
  assetId: asset.id,
  url: assetUrl(asset.id),
  width: asset.width,
  height: asset.height,
});

export function registerAssetRoutes(
  app: FastifyInstance,
  options: { assets: AssetStore; uploadsPer10Minutes: number },
): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.post(
    '/api/assets',
    {
      config: { rateLimit: { max: options.uploadsPer10Minutes, timeWindow: '10 minutes' } },
      schema: {
        summary: 'Upload an image (PNG, JPEG or WebP, up to 10 MB) as the multipart field "file"',
        response: { 201: assetSchema },
      },
    },
    async (request, reply) => {
      const file = await request.file();
      if (!file) throw new AppError(400, 'NO_FILE', 'Attach an image in the "file" field.');
      const bytes = await file.toBuffer();
      const info = await inspectImage(bytes);
      if (!info) throw new AppError(415, 'UNSUPPORTED_IMAGE', 'Only PNG, JPEG and WebP images are supported.');
      if (info.width > MAX_UPLOAD_SIDE || info.height > MAX_UPLOAD_SIDE) {
        throw new AppError(422, 'IMAGE_TOO_LARGE', `Images must be at most ${MAX_UPLOAD_SIDE}×${MAX_UPLOAD_SIDE} px.`);
      }
      const asset = await options.assets.put(bytes);
      return reply.code(201).send(toAssetResponse(asset));
    },
  );

  routes.get('/api/assets/:assetId', { schema: { params: assetParamsSchema } }, (request, reply) => {
    const asset = options.assets.get(request.params.assetId);
    if (!asset) throw new AppError(404, 'ASSET_NOT_FOUND', 'This image is no longer available. Upload it again.');
    return reply
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('etag', `"${asset.id}"`)
      .type(asset.mime)
      .send(asset.bytes);
  });
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test apps/server`
Expected: PASS. If the rate-limit test returns a body without `RATE_LIMITED`, check that the `errorResponseBuilder` result reaches the error handler (the `statusCode === 429` branch in `server.ts` is the fallback).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(server): add image upload and immutable asset serving"
```

---

### Task 10: Library — presets and sample photos

**Files:**
- Create: `apps/server/src/lib/canonical-json.ts`, `apps/server/src/library/preset-repository.ts`, `apps/server/src/library/sample-repository.ts`, `apps/server/src/library/routes.ts`
- Create: `apps/server/scripts/make-placeholder-assets.ts`, `apps/server/library/presets/premium-3d.json`, `apps/server/library/presets/lifestyle.json`, `apps/server/library/presets/paper-craft.json` (+ generated `references/*.webp`, `samples/sample-product.webp`)
- Modify: `docs/specs/2026-10-08-trafaret-design.md` (spec delta)
- Test: `apps/server/src/lib/canonical-json.test.ts`, `apps/server/src/library/library.test.ts`

**Interfaces:**
- Consumes: `AssetStore` (Task 8), `toAssetResponse` (Task 9), `sha256Hex` (Task 8); `presetSchema`, `Preset`, `Sample`, `assetUrl`, `presetsResponseSchema`, `samplesResponseSchema` from `@trafaret/core`.
- Produces:
  - `canonicalJson(value: unknown): string`
  - `type ResolvedPreset = { preset: Preset; referenceAssetIds: string[]; contentHash: string }`
  - `class PresetRepository { constructor(presets: readonly ResolvedPreset[]); static load(dir, assets): Promise<PresetRepository>; get(id): ResolvedPreset | undefined; list(): Preset[] }` — `list()` returns references as asset URLs
  - `class SampleRepository { static load(dir, assets): Promise<SampleRepository>; list(): Sample[] }`
  - `registerLibraryRoutes(app, { presets, samples })` — `GET /api/presets`, `GET /api/samples`

- [ ] **Step 1: Write the failing canonical JSON test**

`apps/server/src/lib/canonical-json.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonical-json.ts';

describe('canonicalJson', () => {
  it('sorts object keys recursively', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [{ f: 1, e: 0 }] } })).toBe('{"a":{"c":[{"e":0,"f":1}],"d":2},"b":1}');
  });

  it('produces the same string for equal values written in a different order', () => {
    expect(canonicalJson({ x: 1, y: [1, 2] })).toBe(canonicalJson({ y: [1, 2], x: 1 }));
  });

  it('drops undefined properties', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});
```

- [ ] **Step 2: Run it to see it fail, then implement**

Run: `pnpm test apps/server` → FAIL (`./canonical-json.ts` missing).

`apps/server/src/lib/canonical-json.ts`:
```ts
/** JSON with object keys sorted recursively, so equal values always produce identical strings (used for hashing). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, sortKeys(child)]),
    );
  }
  return value;
}
```

Run: `pnpm test apps/server` → PASS.

- [ ] **Step 3: Create the preset files**

`apps/server/library/presets/premium-3d.json`:
```json
{
  "id": "premium-3d",
  "name": "Premium 3D",
  "mainPrompt": "premium minimal 3D render, soft studio lighting, matte materials, gentle shadows, clean pastel backdrop",
  "negativePrompt": "clutter, noisy background, text, watermark, low detail",
  "references": ["/references/premium-3d-1.webp", "/references/premium-3d-2.webp"]
}
```

`apps/server/library/presets/lifestyle.json`:
```json
{
  "id": "lifestyle",
  "name": "Lifestyle",
  "mainPrompt": "natural daylight lifestyle photo, warm tones, shallow depth of field, real home setting",
  "negativePrompt": "studio backdrop, artificial look, oversaturated colors",
  "references": ["/references/lifestyle-1.webp", "/references/lifestyle-2.webp"]
}
```

`apps/server/library/presets/paper-craft.json`:
```json
{
  "id": "paper-craft",
  "name": "Paper Craft",
  "mainPrompt": "handmade paper-craft diorama, layered cut paper, soft shadows, playful colors",
  "negativePrompt": "photorealistic, glossy plastic, metal",
  "references": ["/references/paper-craft-1.webp", "/references/paper-craft-2.webp"]
}
```

- [ ] **Step 4: Generate the placeholder images**

`apps/server/scripts/make-placeholder-assets.ts`:
```ts
/**
 * Writes simple generated images for preset references and the sample photo, so the server works before the real
 * AI-generated assets exist (Phase 3 replaces them). Run: node apps/server/scripts/make-placeholder-assets.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

type Placeholder = { path: string; label: string; from: string; to: string };

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'library');

const placeholders: Placeholder[] = [
  { path: 'presets/references/premium-3d-1.webp', label: 'Premium 3D · 1', from: '#f6d5e5', to: '#c7d2fe' },
  { path: 'presets/references/premium-3d-2.webp', label: 'Premium 3D · 2', from: '#fde68a', to: '#fbcfe8' },
  { path: 'presets/references/lifestyle-1.webp', label: 'Lifestyle · 1', from: '#fcd34d', to: '#f97316' },
  { path: 'presets/references/lifestyle-2.webp', label: 'Lifestyle · 2', from: '#a7f3d0', to: '#facc15' },
  { path: 'presets/references/paper-craft-1.webp', label: 'Paper Craft · 1', from: '#fca5a5', to: '#93c5fd' },
  { path: 'presets/references/paper-craft-2.webp', label: 'Paper Craft · 2', from: '#c4b5fd', to: '#86efac' },
  { path: 'samples/sample-product.webp', label: 'Sample product', from: '#e5e7eb', to: '#9ca3af' },
];

const svg = ({ label, from, to }: Placeholder): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">` +
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
  `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
  `<rect width="512" height="512" fill="url(#g)"/>` +
  `<text x="256" y="268" font-family="sans-serif" font-size="40" text-anchor="middle" fill="#1b1c1f">${label}</text>` +
  `</svg>`;

for (const placeholder of placeholders) {
  const target = join(root, placeholder.path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, await sharp(Buffer.from(svg(placeholder))).webp({ quality: 90 }).toBuffer());
  console.log(`wrote ${placeholder.path}`);
}
```

Run: `node apps/server/scripts/make-placeholder-assets.ts`
Expected: seven `wrote …` lines; files exist under `apps/server/library/`.

- [ ] **Step 5: Write the failing library tests**

`apps/server/src/library/library.test.ts`:
```ts
import { copyFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { AssetStore } from '../assets/asset-store.ts';
import { createHttpServer } from '../http/server.ts';
import { PresetRepository } from './preset-repository.ts';
import { registerLibraryRoutes } from './routes.ts';
import { SampleRepository } from './sample-repository.ts';

const libraryDir = fileURLToPath(new URL('../../library', import.meta.url));
const referenceFile = join(libraryDir, 'presets', 'references', 'premium-3d-1.webp');

async function presetDir(mainPrompt: string, file = 'custom.json', body?: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'trafaret-presets-'));
  await mkdir(join(dir, 'references'));
  await copyFile(referenceFile, join(dir, 'references', 'ref-1.webp'));
  const preset = body ?? { id: 'custom', name: 'Custom', mainPrompt, negativePrompt: '', references: ['/references/ref-1.webp'] };
  await writeFile(join(dir, file), JSON.stringify(preset));
  return dir;
}

describe('PresetRepository', () => {
  it('loads presets in the brief\'s shape and pins their reference images', async () => {
    const assets = new AssetStore({ maxBytes: 1 }); // tiny budget: pinned references must survive
    const presets = await PresetRepository.load(join(libraryDir, 'presets'), assets);
    const premium = presets.get('premium-3d');
    expect(premium?.preset).toMatchObject({
      name: 'Premium 3D',
      references: ['/references/premium-3d-1.webp', '/references/premium-3d-2.webp'],
    });
    expect(premium?.referenceAssetIds).toHaveLength(2);
    for (const id of premium?.referenceAssetIds ?? []) expect(assets.has(id)).toBe(true);
  });

  it('lists presets with references resolved to asset URLs', async () => {
    const presets = await PresetRepository.load(join(libraryDir, 'presets'), new AssetStore({ maxBytes: 1e8 }));
    expect(presets.list().map((preset) => preset.id).sort()).toEqual(['lifestyle', 'paper-craft', 'premium-3d']);
    expect(presets.list()[0]?.references[0]).toMatch(/^\/api\/assets\/[a-f0-9]{64}$/);
  });

  it('changes the content hash when the preset changes', async () => {
    const assets = new AssetStore({ maxBytes: 1e8 });
    const a = await PresetRepository.load(await presetDir('soft light'), assets);
    const b = await PresetRepository.load(await presetDir('hard light'), assets);
    expect(a.get('custom')?.contentHash).not.toBe(b.get('custom')?.contentHash);
  });

  it('names the file when a preset is invalid', async () => {
    const dir = await presetDir('', 'broken.json', { id: 'broken', mainPrompt: 'x' });
    await expect(PresetRepository.load(dir, new AssetStore({ maxBytes: 1e8 }))).rejects.toThrow(/broken\.json/);
  });
});

describe('library routes', () => {
  it('serves presets and samples', async () => {
    const assets = new AssetStore({ maxBytes: 1e8 });
    const app = await createHttpServer({ logger: pino({ level: 'silent' }) });
    registerLibraryRoutes(app, {
      presets: await PresetRepository.load(join(libraryDir, 'presets'), assets),
      samples: await SampleRepository.load(join(libraryDir, 'samples'), assets),
    });

    const presets = await app.inject({ method: 'GET', url: '/api/presets' });
    expect(presets.statusCode).toBe(200);
    expect(presets.json<{ presets: unknown[] }>().presets).toHaveLength(3);

    const samples = await app.inject({ method: 'GET', url: '/api/samples' });
    expect(samples.json()).toMatchObject({
      samples: [{ id: 'sample-product', name: 'Sample product', width: 512, height: 512 }],
    });
  });
});
```

- [ ] **Step 6: Run them to see them fail**

Run: `pnpm test apps/server`
Expected: FAIL — cannot load `./preset-repository.ts`.

- [ ] **Step 7: Implement the repositories and routes**

`apps/server/src/library/preset-repository.ts`:
```ts
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { assetUrl, presetSchema, type Preset } from '@trafaret/core';
import type { AssetStore } from '../assets/asset-store.ts';
import { canonicalJson } from '../lib/canonical-json.ts';
import { sha256Hex } from '../lib/hash.ts';

const presetFileSchema = presetSchema.extend({
  references: z.array(
    z.string().regex(/^\/references\/[a-z0-9-]+\.(?:webp|png|jpe?g)$/, 'must look like /references/<name>.webp'),
  ),
});

export type ResolvedPreset = { preset: Preset; referenceAssetIds: string[]; contentHash: string };

/** Presets are files on the server: the UI only ever stores a preset id, never the merge logic. */
export class PresetRepository {
  private readonly byId: ReadonlyMap<string, ResolvedPreset>;

  constructor(presets: readonly ResolvedPreset[]) {
    this.byId = new Map(presets.map((entry) => [entry.preset.id, entry]));
  }

  static async load(dir: string, assets: AssetStore): Promise<PresetRepository> {
    const files = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
    const presets: ResolvedPreset[] = [];
    for (const file of files) {
      const parsed = presetFileSchema.safeParse(JSON.parse(await readFile(join(dir, file), 'utf8')));
      if (!parsed.success) {
        const details = parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ');
        throw new Error(`Invalid preset ${file}: ${details}`);
      }
      const preset = parsed.data;
      if (presets.some((entry) => entry.preset.id === preset.id)) {
        throw new Error(`Duplicate preset id "${preset.id}" in ${file}`);
      }
      const referenceAssetIds: string[] = [];
      for (const reference of preset.references) {
        const asset = await assets.put(await readFile(join(dir, reference)), { pinned: true });
        referenceAssetIds.push(asset.id);
      }
      const contentHash = sha256Hex(canonicalJson({ ...preset, references: referenceAssetIds }));
      presets.push({ preset, referenceAssetIds, contentHash });
    }
    return new PresetRepository(presets);
  }

  get(id: string): ResolvedPreset | undefined {
    return this.byId.get(id);
  }

  /** Presets as the API exposes them: references resolved to asset URLs. */
  list(): Preset[] {
    return [...this.byId.values()].map(({ preset, referenceAssetIds }) => ({
      ...preset,
      references: referenceAssetIds.map(assetUrl),
    }));
  }
}
```

`apps/server/src/library/sample-repository.ts`:
```ts
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Sample } from '@trafaret/core';
import type { AssetStore, StoredAsset } from '../assets/asset-store.ts';
import { toAssetResponse } from '../assets/routes.ts';

type SampleEntry = { id: string; name: string; asset: StoredAsset };

const toName = (id: string): string => {
  const words = id.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Pinned sample photos (e.g. for the Edit templates); the file name is the sample id. */
export class SampleRepository {
  private readonly samples: readonly SampleEntry[];

  constructor(samples: readonly SampleEntry[]) {
    this.samples = samples;
  }

  static async load(dir: string, assets: AssetStore): Promise<SampleRepository> {
    const files = (await readdir(dir)).filter((name) => /\.(?:webp|png|jpe?g)$/.test(name)).sort();
    const samples: SampleEntry[] = [];
    for (const file of files) {
      const asset = await assets.put(await readFile(join(dir, file)), { pinned: true });
      const id = file.replace(/\.[^.]+$/, '');
      samples.push({ id, name: toName(id), asset });
    }
    return new SampleRepository(samples);
  }

  list(): Sample[] {
    return this.samples.map(({ id, name, asset }) => ({ id, name, ...toAssetResponse(asset) }));
  }
}
```

`apps/server/src/library/routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { presetsResponseSchema, samplesResponseSchema } from '@trafaret/core';
import type { PresetRepository } from './preset-repository.ts';
import type { SampleRepository } from './sample-repository.ts';

export function registerLibraryRoutes(
  app: FastifyInstance,
  options: { presets: PresetRepository; samples: SampleRepository },
): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  routes.get('/api/presets', { schema: { response: { 200: presetsResponseSchema } } }, () => ({
    presets: options.presets.list(),
  }));
  routes.get('/api/samples', { schema: { response: { 200: samplesResponseSchema } } }, () => ({
    samples: options.samples.list(),
  }));
}
```

- [ ] **Step 8: Run the tests**

Run: `pnpm test apps/server`
Expected: PASS.

- [ ] **Step 9: Record the spec delta**

In `docs/specs/2026-10-08-trafaret-design.md`:
- §7.1, in the endpoints table, add this row right after the `/api/presets` row:
  ```
  | GET    | `/api/samples`                          | `200 { samples: Sample[] }` — pinned sample photos for the Edit templates                   |
  ```
- §5.3, change `Issue codes: \`DUPLICATE_ID\`,` to `Issue codes: \`SCHEMA_MISMATCH\` (request shape, server only), \`DUPLICATE_ID\`,`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(server): add preset and sample library with placeholder reference images"
```

---

### Task 11: Model catalog

**Files:**
- Create: `apps/server/src/catalog/models.ts`, `apps/server/src/catalog/catalog.ts`, `apps/server/src/catalog/routes.ts`
- Test: `apps/server/src/catalog/catalog.test.ts`

**Interfaces:**
- Consumes: `Config` (Task 7); `ASPECT_RATIOS`, `AspectRatio`, `ImageModel`, `ProviderId`, `catalogResponseSchema` from `@trafaret/core`.
- Produces:
  - `type ModelDefinition = { id; label; provider: ProviderId; providerModel: string; supportsEdit; supportsNegativePrompt; supportsSeed; maxReferenceImages; sizes: Record<AspectRatio, { width: number; height: number }>; costPerImageUsd }`
  - `MODEL_DEFINITIONS: readonly ModelDefinition[]` — ids `seedream-4.5`, `flux-2-klein`, `mock`, `mock-fails-first`
  - `class ModelCatalog { constructor(credentials: Pick<Config, 'cloudflare' | 'byteplus'>, definitions?); list(): readonly ImageModel[]; get(id): ImageModel | undefined; definition(id): ModelDefinition | undefined }`
  - `registerCatalogRoutes(app, { catalog })` — `GET /api/catalog`

- [ ] **Step 1: Write the failing tests**

`apps/server/src/catalog/catalog.test.ts`:
```ts
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { createHttpServer } from '../http/server.ts';
import { ModelCatalog } from './catalog.ts';
import { registerCatalogRoutes } from './routes.ts';

const noKeys = { cloudflare: null, byteplus: null };
const allKeys = { cloudflare: { accountId: 'acc', apiToken: 'tok' }, byteplus: { apiKey: 'key' } };
const defaultOf = (catalog: ModelCatalog) => catalog.list().find((model) => model.default)?.id;

describe('ModelCatalog', () => {
  it('enables only the mock models without credentials and explains why', () => {
    const catalog = new ModelCatalog(noKeys);
    expect(catalog.list().filter((model) => model.enabled).map((model) => model.id)).toEqual(['mock', 'mock-fails-first']);
    expect(catalog.get('seedream-4.5')).toMatchObject({
      enabled: false,
      unavailableReason: 'Set ARK_API_KEY on the server to enable this model.',
    });
    expect(defaultOf(catalog)).toBe('mock');
  });

  it('prefers Seedream, then FLUX, as the default model', () => {
    expect(defaultOf(new ModelCatalog(allKeys))).toBe('seedream-4.5');
    expect(defaultOf(new ModelCatalog({ ...allKeys, byteplus: null }))).toBe('flux-2-klein');
  });

  it('describes capabilities and per-aspect sizes', () => {
    const catalog = new ModelCatalog(noKeys);
    expect(catalog.get('flux-2-klein')).toMatchObject({
      provider: 'cloudflare',
      supportsEdit: true,
      supportsNegativePrompt: false,
      supportsSeed: true,
      maxReferenceImages: 4,
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    });
    expect(catalog.definition('seedream-4.5')?.sizes['16:9']).toEqual({ width: 2560, height: 1440 });
    expect(catalog.get('nope')).toBeUndefined();
  });

  it('serves the catalog over HTTP', async () => {
    const app = await createHttpServer({ logger: pino({ level: 'silent' }) });
    registerCatalogRoutes(app, { catalog: new ModelCatalog(noKeys) });
    const response = await app.inject({ method: 'GET', url: '/api/catalog' });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ models: unknown[] }>().models).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test apps/server`
Expected: FAIL — cannot load `./catalog.ts`.

- [ ] **Step 3: Implement**

`apps/server/src/catalog/models.ts`:
```ts
import type { AspectRatio, ProviderId } from '@trafaret/core';

export type Size = { width: number; height: number };

export type ModelDefinition = {
  id: string;
  label: string;
  provider: ProviderId;
  /** The provider's own model identifier. */
  providerModel: string;
  supportsEdit: boolean;
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  maxReferenceImages: number;
  sizes: Record<AspectRatio, Size>;
  costPerImageUsd: number;
};

const STANDARD_SIZES: Record<AspectRatio, Size> = {
  '1:1': { width: 1024, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
};

/** Seedream 4.5 needs at least ~3.69 MP per image. */
const SEEDREAM_SIZES: Record<AspectRatio, Size> = {
  '1:1': { width: 2048, height: 2048 },
  '4:3': { width: 2304, height: 1728 },
  '3:4': { width: 1728, height: 2304 },
  '16:9': { width: 2560, height: 1440 },
  '9:16': { width: 1440, height: 2560 },
};

const mock = {
  provider: 'mock',
  supportsEdit: true,
  supportsNegativePrompt: true,
  supportsSeed: true,
  maxReferenceImages: 14,
  sizes: STANDARD_SIZES,
  costPerImageUsd: 0,
} as const;

export const MODEL_DEFINITIONS: readonly ModelDefinition[] = [
  {
    id: 'seedream-4.5',
    label: 'Seedream 4.5',
    provider: 'byteplus',
    providerModel: 'seedream-4-5-251128',
    supportsEdit: true,
    supportsNegativePrompt: false,
    supportsSeed: false,
    maxReferenceImages: 14,
    sizes: SEEDREAM_SIZES,
    costPerImageUsd: 0.04,
  },
  {
    id: 'flux-2-klein',
    label: 'FLUX.2 klein 4B',
    provider: 'cloudflare',
    providerModel: '@cf/black-forest-labs/flux-2-klein-4b',
    supportsEdit: true,
    supportsNegativePrompt: false,
    supportsSeed: true,
    maxReferenceImages: 4,
    sizes: STANDARD_SIZES,
    costPerImageUsd: 0.0012,
  },
  { id: 'mock', label: 'Mock', providerModel: 'mock', ...mock },
  { id: 'mock-fails-first', label: 'Mock · fails first attempt', providerModel: 'mock-fails-first', ...mock },
];
```

`apps/server/src/catalog/catalog.ts`:
```ts
import { ASPECT_RATIOS, type ImageModel } from '@trafaret/core';
import type { Config } from '../config.ts';
import { MODEL_DEFINITIONS, type ModelDefinition } from './models.ts';

const DEFAULT_PREFERENCE = ['seedream-4.5', 'flux-2-klein', 'mock'];

/** Capability-driven model list: models without credentials stay visible but disabled, with the reason. */
export class ModelCatalog {
  private readonly models: readonly ImageModel[];
  private readonly definitions: ReadonlyMap<string, ModelDefinition>;

  constructor(
    credentials: Pick<Config, 'cloudflare' | 'byteplus'>,
    definitions: readonly ModelDefinition[] = MODEL_DEFINITIONS,
  ) {
    this.definitions = new Map(definitions.map((definition) => [definition.id, definition]));
    const reasonFor = (definition: ModelDefinition): string | null => {
      switch (definition.provider) {
        case 'cloudflare':
          return credentials.cloudflare
            ? null
            : 'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN on the server to enable this model.';
        case 'byteplus':
          return credentials.byteplus ? null : 'Set ARK_API_KEY on the server to enable this model.';
        case 'mock':
          return null;
      }
    };
    const enabled = definitions.filter((definition) => reasonFor(definition) === null).map((definition) => definition.id);
    const defaultId = DEFAULT_PREFERENCE.find((id) => enabled.includes(id)) ?? null;
    this.models = definitions.map((definition) => {
      const reason = reasonFor(definition);
      return {
        id: definition.id,
        label: definition.label,
        provider: definition.provider,
        default: definition.id === defaultId,
        enabled: reason === null,
        unavailableReason: reason,
        supportsEdit: definition.supportsEdit,
        supportsNegativePrompt: definition.supportsNegativePrompt,
        supportsSeed: definition.supportsSeed,
        maxReferenceImages: definition.maxReferenceImages,
        aspectRatios: ASPECT_RATIOS.filter((ratio) => ratio in definition.sizes),
        costPerImageUsd: definition.costPerImageUsd,
      };
    });
  }

  list(): readonly ImageModel[] {
    return this.models;
  }

  get(id: string): ImageModel | undefined {
    return this.models.find((model) => model.id === id);
  }

  definition(id: string): ModelDefinition | undefined {
    return this.definitions.get(id);
  }
}
```

`apps/server/src/catalog/routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { catalogResponseSchema } from '@trafaret/core';
import type { ModelCatalog } from './catalog.ts';

export function registerCatalogRoutes(app: FastifyInstance, options: { catalog: ModelCatalog }): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get('/api/catalog', { schema: { response: { 200: catalogResponseSchema } } }, () => ({
      models: [...options.catalog.list()],
    }));
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test apps/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(server): add capability-driven model catalog"
```

---

### Task 12: Provider contract, HTTP error mapping and the Mock provider

**Files:**
- Create: `apps/server/src/providers/types.ts`, `apps/server/src/providers/http.ts`, `apps/server/src/providers/mock.ts`
- Test: `apps/server/src/providers/http.test.ts`, `apps/server/src/providers/mock.test.ts`

**Interfaces:**
- Consumes: `ProviderId` from `@trafaret/core`; `makePng` (Task 8).
- Produces:
  - `type ProviderImage = { bytes: Buffer; mime: string }`
  - `type ProviderRequest = { model: string; mode: 'generate' | 'edit'; prompt: string; negativePrompt: string | null; images: ProviderImage[]; width: number; height: number; seed: number | null; attempt: number }`
  - `type ProviderResult = { bytes: Buffer }`
  - `interface ImageProvider { readonly id: ProviderId; generate(request: ProviderRequest, signal: AbortSignal): Promise<ProviderResult> }`
  - `class ProviderError extends Error { code: 'PROVIDER_ERROR' | 'INVALID_INPUT'; retryable: boolean; detail?: string }`
  - `postToProvider(fetchFn: typeof fetch, url: string, init: RequestInit): Promise<Response>`, `errorFromResponse(response: Response): Promise<ProviderError>`, `isAbortError(error: unknown): boolean`
  - `createMockProvider(options: { latencyMs: { min: number; max: number } }): ImageProvider`, `MOCK_FAILS_FIRST_MODEL = 'mock-fails-first'`, `hashString(text): number`, `sleep(ms, signal): Promise<void>`

- [ ] **Step 1: Write the failing tests**

`apps/server/src/providers/http.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { errorFromResponse, postToProvider } from './http.ts';

describe('errorFromResponse', () => {
  it.each([
    [401, '', 'PROVIDER_ERROR', false, "The server's AI credentials were rejected."],
    [403, '', 'PROVIDER_ERROR', false, "The server's AI credentials were rejected."],
    [429, '', 'PROVIDER_ERROR', true, 'The AI service is busy. Retry in a few seconds.'],
    [503, '', 'PROVIDER_ERROR', true, "The AI service didn't respond. Retry in a few seconds."],
    [
      400,
      '{"error":{"code":"InputTextSensitiveContentDetected","message":"The request was blocked"}}',
      'INVALID_INPUT',
      false,
      'The model declined this prompt. Rephrase it and run again.',
    ],
    [
      400,
      '{"error":{"message":"width must be at most 1920"}}',
      'INVALID_INPUT',
      false,
      'The AI service rejected the request: width must be at most 1920',
    ],
  ] as const)('maps HTTP %i', async (status, body, code, retryable, message) => {
    expect(await errorFromResponse(new Response(body, { status }))).toMatchObject({ code, retryable, message });
  });
});

describe('postToProvider', () => {
  it('maps network failures to a retryable error', async () => {
    const failing = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    await expect(postToProvider(failing, 'https://ai.example.test', {})).rejects.toMatchObject({
      name: 'ProviderError',
      code: 'PROVIDER_ERROR',
      retryable: true,
    });
  });

  it('lets abort errors through untouched', async () => {
    const aborting = (() => Promise.reject(new DOMException('timed out', 'TimeoutError'))) as typeof fetch;
    await expect(postToProvider(aborting, 'https://ai.example.test', {})).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('returns successful responses', async () => {
    const ok = (() => Promise.resolve(new Response('{}', { status: 200 }))) as typeof fetch;
    expect((await postToProvider(ok, 'https://ai.example.test', {})).status).toBe(200);
  });
});
```

`apps/server/src/providers/mock.test.ts`:
```ts
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { makePng } from '../test/images.ts';
import { createMockProvider } from './mock.ts';
import type { ProviderRequest } from './types.ts';

const request = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
  model: 'mock',
  mode: 'generate',
  prompt: 'A white sneaker on a stone pedestal',
  negativePrompt: null,
  images: [],
  width: 64,
  height: 48,
  seed: 7,
  attempt: 1,
  ...overrides,
});
const instant = createMockProvider({ latencyMs: { min: 0, max: 0 } });
const signal = new AbortController().signal;

describe('mock provider', () => {
  it('renders a PNG of the requested size', async () => {
    const { bytes } = await instant.generate(request(), signal);
    expect(await sharp(bytes).metadata()).toMatchObject({ format: 'png', width: 64, height: 48 });
  });

  it('is deterministic for the same prompt and seed', async () => {
    const [a, b, c] = await Promise.all([
      instant.generate(request(), signal),
      instant.generate(request(), signal),
      instant.generate(request({ seed: 8 }), signal),
    ]);
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.bytes.equals(c.bytes)).toBe(false);
  });

  it('builds on the source image in edit mode', async () => {
    const source = { bytes: await makePng(20, 20, '#00ff00'), mime: 'image/png' };
    const { bytes } = await instant.generate(request({ mode: 'edit', images: [source] }), signal);
    expect(await sharp(bytes).metadata()).toMatchObject({ width: 64, height: 48 });
  });

  it('fails only the first attempt of the "fails first attempt" model', async () => {
    await expect(instant.generate(request({ model: 'mock-fails-first', attempt: 1 }), signal)).rejects.toMatchObject({
      name: 'ProviderError',
      retryable: true,
    });
    await expect(instant.generate(request({ model: 'mock-fails-first', attempt: 2 }), signal)).resolves.toBeDefined();
  });

  it('stops waiting when the signal aborts', async () => {
    const slow = createMockProvider({ latencyMs: { min: 5_000, max: 5_000 } });
    await expect(slow.generate(request(), AbortSignal.timeout(10))).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test apps/server`
Expected: FAIL — cannot load `./http.ts`, `./mock.ts`.

- [ ] **Step 3: Implement the contract and HTTP helpers**

`apps/server/src/providers/types.ts`:
```ts
import type { ProviderId } from '@trafaret/core';

export type ProviderImage = { bytes: Buffer; mime: string };

export type ProviderRequest = {
  /** The provider's own model identifier, e.g. `seedream-4-5-251128`. */
  model: string;
  mode: 'generate' | 'edit';
  prompt: string;
  /** Only for models with a native negative-prompt field; otherwise it is already folded into `prompt`. */
  negativePrompt: string | null;
  /** Edit source first, then preset references. */
  images: ProviderImage[];
  width: number;
  height: number;
  seed: number | null;
  /** 1 on a job's first run, +1 for every retry. */
  attempt: number;
};

export type ProviderResult = { bytes: Buffer };

export interface ImageProvider {
  readonly id: ProviderId;
  generate(request: ProviderRequest, signal: AbortSignal): Promise<ProviderResult>;
}

export type ProviderErrorCode = 'PROVIDER_ERROR' | 'INVALID_INPUT';

/** A provider failure with a user-facing message; `detail` is for server logs only. */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly detail: string | undefined;

  constructor(code: ProviderErrorCode, message: string, retryable: boolean, detail?: string) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = retryable;
    this.detail = detail;
  }
}
```

`apps/server/src/providers/http.ts`:
```ts
import { ProviderError } from './types.ts';

const MODERATION = /sensitive|moderation|safety|nsfw|content.?(?:policy|filter)/i;
const UNAVAILABLE = "The AI service didn't respond. Retry in a few seconds.";

export const isAbortError = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');

/** POSTs to a provider and turns transport and HTTP failures into ProviderError. Abort errors pass through. */
export async function postToProvider(fetchFn: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetchFn(url, { ...init, method: 'POST' });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ProviderError('PROVIDER_ERROR', UNAVAILABLE, true, error instanceof Error ? error.message : 'network error');
  }
  if (!response.ok) throw await errorFromResponse(response);
  return response;
}

export async function errorFromResponse(response: Response): Promise<ProviderError> {
  const body = await response.text().catch(() => '');
  const detail = `HTTP ${response.status}: ${body.slice(0, 500)}`;
  const { status } = response;
  if (status === 401 || status === 403) {
    return new ProviderError('PROVIDER_ERROR', "The server's AI credentials were rejected.", false, detail);
  }
  if (status === 429) return new ProviderError('PROVIDER_ERROR', 'The AI service is busy. Retry in a few seconds.', true, detail);
  if (status >= 500) return new ProviderError('PROVIDER_ERROR', UNAVAILABLE, true, detail);
  if ((status === 400 || status === 422) && MODERATION.test(body)) {
    return new ProviderError('INVALID_INPUT', 'The model declined this prompt. Rephrase it and run again.', false, detail);
  }
  return new ProviderError('INVALID_INPUT', rejectionMessage(body), false, detail);
}

function rejectionMessage(body: string): string {
  const text = extractMessage(body)
    .replace(/[^\x20-\x7E]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  return text ? `The AI service rejected the request: ${text}` : 'The AI service rejected the request.';
}

function extractMessage(body: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }
  const candidates = [at(parsed, ['error', 'message']), at(parsed, ['errors', 0, 'message']), at(parsed, ['message'])];
  return candidates.find((candidate): candidate is string => typeof candidate === 'string') ?? '';
}

const at = (value: unknown, path: ReadonlyArray<string | number>): unknown =>
  path.reduce<unknown>(
    (current, key) =>
      current !== null && typeof current === 'object' ? (current as Record<string | number, unknown>)[key] : undefined,
    value,
  );
```

- [ ] **Step 4: Implement the Mock provider**

`apps/server/src/providers/mock.ts`:
```ts
import sharp from 'sharp';
import { ProviderError, type ImageProvider, type ProviderRequest } from './types.ts';

export const MOCK_FAILS_FIRST_MODEL = 'mock-fails-first';

export type MockProviderOptions = { latencyMs: { min: number; max: number } };

/** Deterministic placeholder images with realistic latency — the app works without any API key. */
export function createMockProvider(options: MockProviderOptions): ImageProvider {
  return {
    id: 'mock',
    async generate(request, signal) {
      await sleep(latencyFor(request, options.latencyMs), signal);
      if (request.model === MOCK_FAILS_FIRST_MODEL && request.attempt === 1) {
        throw new ProviderError(
          'PROVIDER_ERROR',
          'This mock model always fails its first attempt. Retry to see it succeed.',
          true,
        );
      }
      return { bytes: await renderMockImage(request) };
    },
  };
}

/** FNV-1a: a tiny, stable string hash. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abortReason = (): Error => (signal.reason instanceof Error ? signal.reason : new Error('Aborted'));
    if (signal.aborted) {
      reject(abortReason());
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortReason());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function latencyFor(request: ProviderRequest, range: { min: number; max: number }): number {
  const spread = range.max - range.min;
  return spread <= 0 ? range.min : range.min + (hashString(`${request.prompt}|${request.seed ?? 0}`) % (spread + 1));
}

const escapeXml = (text: string): string => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function wrap(text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length > maxLines ? [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1] ?? ''}…`] : lines;
}

async function renderMockImage(request: ProviderRequest): Promise<Buffer> {
  const { width, height } = request;
  const hue = hashString(`${request.prompt}|${request.seed ?? 0}`) % 360;
  const fontSize = Math.round(Math.min(width, height) / 18);
  const lines = wrap(request.prompt, 34, 5);
  const text = lines
    .map((line, i) => {
      const y = height / 2 + (i - (lines.length - 1) / 2) * fontSize * 1.3;
      return `<text x="50%" y="${y}" font-size="${fontSize}" text-anchor="middle" fill="#ffffff" font-family="sans-serif">${escapeXml(line)}</text>`;
    })
    .join('');
  const label =
    `<text x="${fontSize}" y="${height - fontSize}" font-size="${Math.round(fontSize * 0.7)}" fill="#ffffff" ` +
    `fill-opacity="0.75" font-family="monospace">MOCK · ${request.mode} · seed ${request.seed ?? '–'}</text>`;

  const source = request.mode === 'edit' ? request.images[0] : undefined;
  if (source) {
    const overlay =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="100%" height="100%" fill="hsl(${hue}, 70%, 35%)" fill-opacity="0.45"/>${text}${label}</svg>`;
    return sharp(source.bytes)
      .resize(width, height, { fit: 'cover' })
      .composite([{ input: Buffer.from(overlay) }])
      .png()
      .toBuffer();
  }
  const scene =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue}, 70%, 55%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360}, 70%, 35%)"/>` +
    `</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${text}${label}</svg>`;
  return sharp(Buffer.from(scene)).png().toBuffer();
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test apps/server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(server): add provider contract, HTTP error mapping and the mock provider"
```

---
### Task 13: Cloudflare Workers AI provider (FLUX.2 klein 4B)

**Files:**
- Create: `apps/server/src/providers/cloudflare.ts`
- Test: `apps/server/src/providers/cloudflare.test.ts`

**Interfaces:**
- Consumes: `ImageProvider`, `ProviderError` (Task 12); `postToProvider` (Task 12); `fitWithin` (Task 8).
- Produces: `createCloudflareProvider(options: { accountId: string; apiToken: string; fetch?: typeof fetch }): ImageProvider`

Provider facts (re-check https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/ before coding): `POST https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/@cf/black-forest-labs/flux-2-klein-4b`, `Authorization: Bearer <token>`, **multipart** fields `prompt` (required), `width`/`height` (256–1920), `seed`, `input_image_0` … `input_image_3` (each under 512×512); JSON response `{ result: { image: <base64> } }`.

- [ ] **Step 1: Write the failing tests**

`apps/server/src/providers/cloudflare.test.ts`:
```ts
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { makePng } from '../test/images.ts';
import { createCloudflareProvider } from './cloudflare.ts';
import type { ProviderRequest } from './types.ts';

type Captured = { url: string; init: RequestInit };

function stubFetch(response: Response): { fetch: typeof fetch; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetchStub = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(response);
  }) as typeof fetch;
  return { fetch: fetchStub, calls };
}

const okResponse = (image: Buffer) =>
  new Response(JSON.stringify({ success: true, result: { image: image.toString('base64') } }), { status: 200 });

const baseRequest = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
  model: '@cf/black-forest-labs/flux-2-klein-4b',
  mode: 'generate',
  prompt: 'A white sneaker',
  negativePrompt: null,
  images: [],
  width: 1024,
  height: 768,
  seed: 42,
  attempt: 1,
  ...overrides,
});

describe('Cloudflare provider', () => {
  it('sends prompt, size, seed and shrunken reference images as multipart', async () => {
    const output = await makePng(8, 8);
    const { fetch, calls } = stubFetch(okResponse(output));
    const provider = createCloudflareProvider({ accountId: 'acc-1', apiToken: 'tok-1', fetch });
    const signal = new AbortController().signal;
    const source = { bytes: await makePng(1200, 800), mime: 'image/png' };

    const result = await provider.generate(baseRequest({ mode: 'edit', images: [source] }), signal);

    expect(result.bytes.equals(output)).toBe(true);
    const call = calls[0]!;
    expect(call.url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acc-1/ai/run/@cf/black-forest-labs/flux-2-klein-4b',
    );
    expect(new Headers(call.init.headers).get('authorization')).toBe('Bearer tok-1');
    expect(call.init.signal).toBe(signal);
    const form = call.init.body as FormData;
    expect(form.get('prompt')).toBe('A white sneaker');
    expect(form.get('width')).toBe('1024');
    expect(form.get('height')).toBe('768');
    expect(form.get('seed')).toBe('42');
    const reference = form.get('input_image_0') as Blob;
    const meta = await sharp(Buffer.from(await reference.arrayBuffer())).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThan(512);
  });

  it('sends at most four reference images and no seed when there is none', async () => {
    const { fetch, calls } = stubFetch(okResponse(await makePng()));
    const provider = createCloudflareProvider({ accountId: 'acc', apiToken: 'tok', fetch });
    const image = { bytes: await makePng(), mime: 'image/png' };
    await provider.generate(baseRequest({ images: [image, image, image, image, image], seed: null }), new AbortController().signal);
    const form = calls[0]!.init.body as FormData;
    expect(form.get('input_image_3')).not.toBeNull();
    expect(form.get('input_image_4')).toBeNull();
    expect(form.get('seed')).toBeNull();
  });

  it('maps provider failures to ProviderError', async () => {
    const { fetch } = stubFetch(new Response('{"errors":[{"message":"Capacity temporarily exceeded"}]}', { status: 503 }));
    const provider = createCloudflareProvider({ accountId: 'acc', apiToken: 'tok', fetch });
    await expect(provider.generate(baseRequest(), new AbortController().signal)).rejects.toMatchObject({
      name: 'ProviderError',
      retryable: true,
    });
  });

  it('rejects unexpected response bodies', async () => {
    const { fetch } = stubFetch(new Response('{"success":true}', { status: 200 }));
    const provider = createCloudflareProvider({ accountId: 'acc', apiToken: 'tok', fetch });
    await expect(provider.generate(baseRequest(), new AbortController().signal)).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test apps/server`
Expected: FAIL — cannot load `./cloudflare.ts`.

- [ ] **Step 3: Implement**

`apps/server/src/providers/cloudflare.ts`:
```ts
import { z } from 'zod';
import { fitWithin } from '../assets/image.ts';
import { postToProvider } from './http.ts';
import { ProviderError, type ImageProvider } from './types.ts';

const MAX_INPUT_IMAGES = 4;
/** The model requires reference images smaller than 512×512. */
const MAX_INPUT_SIDE = 511;

const responseSchema = z.object({ result: z.object({ image: z.string().min(1) }) });

export type CloudflareProviderOptions = { accountId: string; apiToken: string; fetch?: typeof fetch };

export function createCloudflareProvider(options: CloudflareProviderOptions): ImageProvider {
  const fetchFn = options.fetch ?? fetch;
  return {
    id: 'cloudflare',
    async generate(request, signal) {
      const form = new FormData();
      form.set('prompt', request.prompt);
      form.set('width', String(request.width));
      form.set('height', String(request.height));
      if (request.seed !== null) form.set('seed', String(request.seed));
      const inputs = await Promise.all(
        request.images.slice(0, MAX_INPUT_IMAGES).map((image) => fitWithin(image.bytes, MAX_INPUT_SIDE)),
      );
      inputs.forEach((bytes, index) => {
        form.set(`input_image_${index}`, new Blob([new Uint8Array(bytes)], { type: 'image/png' }), `input-${index}.png`);
      });

      const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.accountId)}/ai/run/${request.model}`;
      const response = await postToProvider(fetchFn, url, {
        headers: { authorization: `Bearer ${options.apiToken}` },
        body: form,
        signal,
      });
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new ProviderError(
          'PROVIDER_ERROR',
          'The AI service returned an unexpected response. Retry in a few seconds.',
          true,
          JSON.stringify(parsed.error.issues).slice(0, 500),
        );
      }
      return { bytes: Buffer.from(parsed.data.result.image, 'base64') };
    },
  };
}
```

`new Uint8Array(bytes)` copies the Buffer into a plain `ArrayBuffer`-backed view, which `Blob` accepts under TypeScript's stricter `BlobPart` typing.

- [ ] **Step 4: Run the tests**

Run: `pnpm test apps/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(server): add Cloudflare Workers AI provider for FLUX.2 klein"
```

---

### Task 14: BytePlus ModelArk provider (Seedream 4.5)

**Files:**
- Create: `apps/server/src/providers/byteplus.ts`
- Test: `apps/server/src/providers/byteplus.test.ts`

**Interfaces:**
- Consumes: `ImageProvider`, `ProviderError`, `postToProvider` (Task 12).
- Produces: `BYTEPLUS_BASE_URL`, `createBytePlusProvider(options: { apiKey: string; fetch?: typeof fetch; baseUrl?: string }): ImageProvider`

Provider facts (re-check https://docs.byteplus.com/en/docs/modelark/image-generation-api before coding): `POST https://ark.ap-southeast.bytepluses.com/api/v3/images/generations`, `Authorization: Bearer <ARK_API_KEY>`, JSON body `{ model, prompt, image?: string[] (data URIs, up to 14), size: "<w>x<h>" (Seedream 4.5 needs ≥ ~3.69 MP), response_format: "b64_json", watermark: false, sequential_image_generation: "disabled" }`; response `{ data: [{ b64_json }] }`. No negative prompt, no seed.

- [ ] **Step 1: Write the failing tests**

`apps/server/src/providers/byteplus.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { makePng } from '../test/images.ts';
import { BYTEPLUS_BASE_URL, createBytePlusProvider } from './byteplus.ts';
import type { ProviderRequest } from './types.ts';

type Captured = { url: string; init: RequestInit };

function stubFetch(response: Response): { fetch: typeof fetch; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetchStub = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(response);
  }) as typeof fetch;
  return { fetch: fetchStub, calls };
}

const request = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
  model: 'seedream-4-5-251128',
  mode: 'generate',
  prompt: 'A white sneaker. premium minimal 3D render. Avoid: clutter.',
  negativePrompt: null,
  images: [],
  width: 2560,
  height: 1440,
  seed: null,
  attempt: 1,
  ...overrides,
});

describe('BytePlus provider', () => {
  it('sends an OpenAI-style JSON request with images as data URIs', async () => {
    const output = await makePng(8, 8);
    const { fetch, calls } = stubFetch(new Response(JSON.stringify({ data: [{ b64_json: output.toString('base64') }] })));
    const provider = createBytePlusProvider({ apiKey: 'ark-key', fetch });
    const source = { bytes: await makePng(4, 4, '#000000'), mime: 'image/png' };
    const reference = { bytes: await makePng(4, 4, '#ffffff'), mime: 'image/webp' };

    const result = await provider.generate(request({ mode: 'edit', images: [source, reference] }), new AbortController().signal);

    expect(result.bytes.equals(output)).toBe(true);
    const call = calls[0]!;
    expect(call.url).toBe(`${BYTEPLUS_BASE_URL}/images/generations`);
    expect(new Headers(call.init.headers).get('authorization')).toBe('Bearer ark-key');
    expect(JSON.parse(call.init.body as string)).toEqual({
      model: 'seedream-4-5-251128',
      prompt: 'A white sneaker. premium minimal 3D render. Avoid: clutter.',
      size: '2560x1440',
      response_format: 'b64_json',
      watermark: false,
      sequential_image_generation: 'disabled',
      image: [
        `data:image/png;base64,${source.bytes.toString('base64')}`,
        `data:image/webp;base64,${reference.bytes.toString('base64')}`,
      ],
    });
  });

  it('omits the image field for plain text-to-image', async () => {
    const { fetch, calls } = stubFetch(new Response(JSON.stringify({ data: [{ b64_json: 'aGk=' }] })));
    await createBytePlusProvider({ apiKey: 'k', fetch }).generate(request(), new AbortController().signal);
    expect(JSON.parse(calls[0]!.init.body as string)).not.toHaveProperty('image');
  });

  it('maps moderation refusals to a non-retryable error', async () => {
    const body = '{"error":{"code":"InputTextSensitiveContentDetected","message":"The request failed."}}';
    const { fetch } = stubFetch(new Response(body, { status: 400 }));
    await expect(
      createBytePlusProvider({ apiKey: 'k', fetch }).generate(request(), new AbortController().signal),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', retryable: false });
  });

  it('rejects unexpected response bodies', async () => {
    const { fetch } = stubFetch(new Response('{"data":[]}'));
    await expect(
      createBytePlusProvider({ apiKey: 'k', fetch }).generate(request(), new AbortController().signal),
    ).rejects.toMatchObject({ code: 'PROVIDER_ERROR', retryable: true });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test apps/server`
Expected: FAIL — cannot load `./byteplus.ts`.

- [ ] **Step 3: Implement**

`apps/server/src/providers/byteplus.ts`:
```ts
import { z } from 'zod';
import { postToProvider } from './http.ts';
import { ProviderError, type ImageProvider } from './types.ts';

export const BYTEPLUS_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';

const responseSchema = z.object({ data: z.array(z.object({ b64_json: z.string().min(1) })).min(1) });

export type BytePlusProviderOptions = { apiKey: string; fetch?: typeof fetch; baseUrl?: string };

export function createBytePlusProvider(options: BytePlusProviderOptions): ImageProvider {
  const fetchFn = options.fetch ?? fetch;
  const baseUrl = options.baseUrl ?? BYTEPLUS_BASE_URL;
  return {
    id: 'byteplus',
    async generate(request, signal) {
      const body = {
        model: request.model,
        prompt: request.prompt,
        size: `${request.width}x${request.height}`,
        response_format: 'b64_json',
        watermark: false,
        sequential_image_generation: 'disabled',
        ...(request.images.length > 0
          ? { image: request.images.map((image) => `data:${image.mime};base64,${image.bytes.toString('base64')}`) }
          : {}),
      };
      const response = await postToProvider(fetchFn, `${baseUrl}/images/generations`, {
        headers: { authorization: `Bearer ${options.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
      const parsed = responseSchema.safeParse(await response.json());
      const first = parsed.success ? parsed.data.data[0] : undefined;
      if (!first) {
        throw new ProviderError('PROVIDER_ERROR', 'The AI service returned an unexpected response. Retry in a few seconds.', true);
      }
      return { bytes: Buffer.from(first.b64_json, 'base64') };
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test apps/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(server): add BytePlus ModelArk provider for Seedream 4.5"
```

---

### Task 15: Request builder — preset + prompt + model capabilities → provider request

**Files:**
- Create: `apps/server/src/engine/request-builder.ts`
- Test: `apps/server/src/engine/request-builder.test.ts`

**Interfaces:**
- Consumes: `ModelDefinition`, `MODEL_DEFINITIONS` (Task 11); `assetUrl`, `AspectRatio`, `Preset`, `RequestPreview` from `@trafaret/core`.
- Produces:
  - `type RequestBuilderInput = { userText: string; aspectRatio: AspectRatio; seed: number; model: ModelDefinition; preset: { preset: Preset; referenceAssetIds: readonly string[] } | null; sourceAssetId: string | null }`
  - `type BuiltRequest = { prompt: string; negativePrompt: string | null; referenceAssetIds: string[]; width: number; height: number; seed: number | null; preview: RequestPreview }`
  - `buildRequest(input: RequestBuilderInput): BuiltRequest` — pure

- [ ] **Step 1: Write the failing tests**

`apps/server/src/engine/request-builder.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Preset } from '@trafaret/core';
import { MODEL_DEFINITIONS, type ModelDefinition } from '../catalog/models.ts';
import { buildRequest, type RequestBuilderInput } from './request-builder.ts';

const model = (id: string): ModelDefinition => {
  const found = MODEL_DEFINITIONS.find((definition) => definition.id === id);
  if (!found) throw new Error(`no model ${id}`);
  return found;
};

const premium = (references = 2): { preset: Preset; referenceAssetIds: string[] } => ({
  preset: {
    id: 'premium-3d',
    name: 'Premium 3D',
    mainPrompt: 'premium minimal 3D render, soft studio lighting.',
    negativePrompt: 'clutter, text',
    references: [],
  },
  referenceAssetIds: Array.from({ length: references }, (_, i) => `ref-${i + 1}`),
});

const input = (overrides: Partial<RequestBuilderInput> = {}): RequestBuilderInput => ({
  userText: 'A white sneaker',
  aspectRatio: '1:1',
  seed: 7,
  model: model('flux-2-klein'),
  preset: null,
  sourceAssetId: null,
  ...overrides,
});

describe('buildRequest', () => {
  it('uses the user text alone when there is no preset', () => {
    const built = buildRequest(input());
    expect(built).toMatchObject({ prompt: 'A white sneaker', negativePrompt: null, referenceAssetIds: [], seed: 7 });
    expect(built.preview).toMatchObject({ negativeMode: 'none', negativePrompt: null, warnings: [] });
  });

  it('merges the main prompt and folds the negative prompt for models without a native field', () => {
    const built = buildRequest(input({ preset: premium() }));
    expect(built.prompt).toBe('A white sneaker. premium minimal 3D render, soft studio lighting. Avoid: clutter, text.');
    expect(built.negativePrompt).toBeNull();
    expect(built.preview).toMatchObject({ negativeMode: 'folded', negativePrompt: 'clutter, text' });
  });

  it('sends the negative prompt natively when the model supports it', () => {
    const built = buildRequest(input({ model: model('mock'), preset: premium() }));
    expect(built.prompt).toBe('A white sneaker. premium minimal 3D render, soft studio lighting');
    expect(built.negativePrompt).toBe('clutter, text');
    expect(built.preview.negativeMode).toBe('native');
  });

  it('puts the edit source first, then preset references', () => {
    const built = buildRequest(input({ preset: premium(), sourceAssetId: 'src' }));
    expect(built.referenceAssetIds).toEqual(['src', 'ref-1', 'ref-2']);
    expect(built.preview.references.map((reference) => reference.role)).toEqual(['source', 'preset', 'preset']);
    expect(built.preview.references[0]?.url).toBe('/api/assets/src');
  });

  it('drops references beyond the model limit and says so', () => {
    const built = buildRequest(input({ preset: premium(5), sourceAssetId: 'src' }));
    expect(built.referenceAssetIds).toEqual(['src', 'ref-1', 'ref-2', 'ref-3']);
    expect(built.preview.warnings).toEqual(['2 of 6 reference images dropped: FLUX.2 klein 4B accepts 4.']);
  });

  it('uses the model size for the aspect ratio and drops the seed when unsupported', () => {
    const built = buildRequest(input({ model: model('seedream-4.5'), aspectRatio: '16:9' }));
    expect(built).toMatchObject({ width: 2560, height: 1440, seed: null });
    expect(built.preview).toMatchObject({ aspectRatio: '16:9', seed: null, modelId: 'seedream-4.5' });
  });

  it('trims trailing punctuation before joining', () => {
    expect(buildRequest(input({ userText: 'A white sneaker!!! ', preset: premium() })).prompt).toMatch(
      /^A white sneaker\. premium/,
    );
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test apps/server`
Expected: FAIL — cannot load `./request-builder.ts`.

- [ ] **Step 3: Implement**

`apps/server/src/engine/request-builder.ts`:
```ts
import { assetUrl, type AspectRatio, type Preset, type RequestPreview } from '@trafaret/core';
import type { ModelDefinition } from '../catalog/models.ts';

export type RequestBuilderInput = {
  /** The wired prompt, or an Edit node's instruction. */
  userText: string;
  aspectRatio: AspectRatio;
  seed: number;
  model: ModelDefinition;
  preset: { preset: Preset; referenceAssetIds: readonly string[] } | null;
  /** Edit Image only. */
  sourceAssetId: string | null;
};

export type BuiltRequest = {
  prompt: string;
  /** Set only when the model has a native negative-prompt field. */
  negativePrompt: string | null;
  /** Edit source first, then preset references, cut to the model limit. */
  referenceAssetIds: string[];
  width: number;
  height: number;
  seed: number | null;
  /** What the inspector shows as "Request sent to AI". */
  preview: RequestPreview;
};

const trimTrailingPunctuation = (text: string): string => text.trim().replace(/[\s.,;:!?]+$/u, '');

/** The brief's request builder: user prompt + selected preset + model capabilities → one provider request. */
export function buildRequest(input: RequestBuilderInput): BuiltRequest {
  const { model, preset } = input;
  let prompt = [input.userText, preset?.preset.mainPrompt ?? '']
    .map(trimTrailingPunctuation)
    .filter((part) => part.length > 0)
    .join('. ');

  const negativeText = trimTrailingPunctuation(preset?.preset.negativePrompt ?? '');
  let negativeMode: RequestPreview['negativeMode'] = 'none';
  let negativePrompt: string | null = null;
  if (negativeText) {
    if (model.supportsNegativePrompt) {
      negativeMode = 'native';
      negativePrompt = negativeText;
    } else {
      negativeMode = 'folded';
      prompt = `${prompt}. Avoid: ${negativeText}.`;
    }
  }

  const references = [
    ...(input.sourceAssetId ? [{ assetId: input.sourceAssetId, role: 'source' as const }] : []),
    ...(preset?.referenceAssetIds ?? []).map((assetId) => ({ assetId, role: 'preset' as const })),
  ];
  const kept = references.slice(0, model.maxReferenceImages);
  const dropped = references.length - kept.length;
  const warnings =
    dropped > 0
      ? [`${dropped} of ${references.length} reference images dropped: ${model.label} accepts ${model.maxReferenceImages}.`]
      : [];

  const size = model.sizes[input.aspectRatio];
  const seed = model.supportsSeed ? input.seed : null;

  return {
    prompt,
    negativePrompt,
    referenceAssetIds: kept.map((reference) => reference.assetId),
    width: size.width,
    height: size.height,
    seed,
    preview: {
      modelId: model.id,
      prompt,
      negativePrompt: negativeText || null,
      negativeMode,
      references: kept.map((reference) => ({ ...reference, url: assetUrl(reference.assetId) })),
      aspectRatio: input.aspectRatio,
      seed,
      warnings,
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test apps/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(server): add capability-aware request builder with request preview"
```

---

### Task 16: Engine primitives — semaphore, cache keys, result cache, daily budget

**Files:**
- Create: `apps/server/src/lib/semaphore.ts`, `apps/server/src/engine/cache-key.ts`, `apps/server/src/engine/result-cache.ts`, `apps/server/src/engine/daily-budget.ts`
- Test: `apps/server/src/lib/semaphore.test.ts`, `apps/server/src/engine/cache-key.test.ts`, `apps/server/src/engine/result-cache.test.ts`, `apps/server/src/engine/daily-budget.test.ts`

**Interfaces:**
- Consumes: `canonicalJson` (Task 10), `sha256Hex` (Task 8); `GraphIndex`, `GraphNode`, `ImageOutput`, `JobModel`, `RequestPreview`, `ProviderId` from `@trafaret/core`.
- Produces:
  - `class Semaphore { constructor(max: number); acquire(): Promise<() => void>; get waiting(): number }` — FIFO; the returned release is idempotent
  - `CACHE_VERSION = 1`, `computeCacheKeys(index: GraphIndex, order: readonly string[], presetHash: (presetId: string) => string | undefined): Map<string, string>`
  - `type CacheEntry = { output: ImageOutput; durationMs: number; request: RequestPreview; model: JobModel }`, `class ResultCache { constructor({ maxEntries, isValid? }); get(key); set(key, entry); get size() }`
  - `class DailyBudget { constructor(limits: Partial<Record<ProviderId, number>>, now?: () => number); tryConsume(provider: ProviderId): boolean }`

- [ ] **Step 1: Write the failing tests**

`apps/server/src/lib/semaphore.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Semaphore } from './semaphore.ts';

describe('Semaphore', () => {
  it('admits up to max holders and queues the rest in order', async () => {
    const semaphore = new Semaphore(2);
    const order: string[] = [];
    const releaseA = await semaphore.acquire();
    const releaseB = await semaphore.acquire();
    const third = semaphore.acquire().then((release) => (order.push('third'), release));
    const fourth = semaphore.acquire().then((release) => (order.push('fourth'), release));
    await Promise.resolve();
    expect(order).toEqual([]);
    expect(semaphore.waiting).toBe(2);

    releaseA();
    const releaseThird = await third;
    expect(order).toEqual(['third']);
    releaseB();
    await fourth;
    expect(order).toEqual(['third', 'fourth']);
    releaseThird();
  });

  it('ignores a second release of the same permit', async () => {
    const semaphore = new Semaphore(1);
    const release = await semaphore.acquire();
    release();
    release();
    const held = await semaphore.acquire();
    let admitted = false;
    const next = semaphore.acquire().then(() => {
      admitted = true;
    });
    await Promise.resolve();
    expect(admitted).toBe(false);
    held();
    await next;
    expect(admitted).toBe(true);
  });
});
```

`apps/server/src/engine/cache-key.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { indexGraph, topologicalOrder, type Graph } from '@trafaret/core';
import { branchingGraph, edge, editNode, imageInputNode, promptNode } from '@trafaret/core/testing';
import { computeCacheKeys } from './cache-key.ts';

const keysOf = (graph: Graph, presetHash: (id: string) => string | undefined = () => undefined) => {
  const index = indexGraph(graph);
  return computeCacheKeys(index, topologicalOrder(index)!, presetHash);
};

const withNode = (graph: Graph, id: string, patch: (node: Graph['nodes'][number]) => Graph['nodes'][number]): Graph => ({
  ...graph,
  nodes: graph.nodes.map((node) => (node.id === id ? patch(node) : node)),
});

describe('computeCacheKeys', () => {
  it('is stable for equal graphs', () => {
    expect(keysOf(branchingGraph())).toEqual(keysOf(branchingGraph()));
  });

  it('changes a node and its dependents when the node changes', () => {
    const before = keysOf(branchingGraph());
    const after = keysOf(
      withNode(branchingGraph(), 'gen-b', (node) =>
        node.type === 'generateImage' ? { ...node, data: { ...node.data, seed: 99 } } : node,
      ),
    );
    expect(after.get('gen-b')).not.toBe(before.get('gen-b'));
    expect(after.get('result-b')).not.toBe(before.get('result-b'));
    expect(after.get('gen-a')).toBe(before.get('gen-a'));
    expect(after.get('result-a')).toBe(before.get('result-a'));
    expect(after.get('prompt')).toBe(before.get('prompt'));
  });

  it('includes the preset content', () => {
    const graph = withNode(branchingGraph(), 'gen-a', (node) =>
      node.type === 'generateImage' ? { ...node, data: { ...node.data, presetId: 'premium-3d' } } : node,
    );
    expect(keysOf(graph, () => 'hash-1').get('gen-a')).not.toBe(keysOf(graph, () => 'hash-2').get('gen-a'));
  });

  it('ignores the edit instruction when a prompt is wired, and node positions', () => {
    const graph = (instruction: string): Graph => ({
      nodes: [promptNode('p'), imageInputNode('img'), editNode('e', { instruction })],
      edges: [edge('img', 'e', 'image'), edge('p', 'e', 'prompt')],
    });
    expect(keysOf(graph('one')).get('e')).toBe(keysOf(graph('two')).get('e'));
    const moved = withNode(branchingGraph(), 'gen-a', (node) => ({ ...node, position: { x: 500, y: 500 } }));
    expect(keysOf(moved)).toEqual(keysOf(branchingGraph()));
  });
});
```

`apps/server/src/engine/result-cache.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ResultCache, type CacheEntry } from './result-cache.ts';

const entry = (assetId: string): CacheEntry => ({
  output: { kind: 'image', assetId, url: `/api/assets/${assetId}`, width: 1, height: 1 },
  durationMs: 1000,
  request: { modelId: 'mock', prompt: 'p', negativePrompt: null, negativeMode: 'none', references: [], aspectRatio: '1:1', seed: 1, warnings: [] },
  model: { id: 'mock', provider: 'mock' },
});

describe('ResultCache', () => {
  it('returns stored entries', () => {
    const cache = new ResultCache({ maxEntries: 10 });
    cache.set('k', entry('a'));
    expect(cache.get('k')?.output.assetId).toBe('a');
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts the least recently used entry past the limit', () => {
    const cache = new ResultCache({ maxEntries: 2 });
    cache.set('a', entry('a'));
    cache.set('b', entry('b'));
    cache.get('a');
    cache.set('c', entry('c'));
    expect(cache.get('a')).toBeDefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.size).toBe(2);
  });

  it('drops entries that are no longer valid', () => {
    const cache = new ResultCache({ maxEntries: 10, isValid: (cached) => cached.output.assetId !== 'gone' });
    cache.set('k', entry('gone'));
    expect(cache.get('k')).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});
```

`apps/server/src/engine/daily-budget.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DailyBudget } from './daily-budget.ts';

describe('DailyBudget', () => {
  it('allows calls up to the daily limit', () => {
    const budget = new DailyBudget({ cloudflare: 2 }, () => Date.parse('2026-10-08T10:00:00Z'));
    expect([budget.tryConsume('cloudflare'), budget.tryConsume('cloudflare'), budget.tryConsume('cloudflare')]).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('starts over at 00:00 UTC', () => {
    let now = Date.parse('2026-10-08T23:59:00Z');
    const budget = new DailyBudget({ byteplus: 1 }, () => now);
    expect(budget.tryConsume('byteplus')).toBe(true);
    expect(budget.tryConsume('byteplus')).toBe(false);
    now = Date.parse('2026-10-09T00:00:01Z');
    expect(budget.tryConsume('byteplus')).toBe(true);
  });

  it('never limits providers without a configured cap', () => {
    const budget = new DailyBudget({ cloudflare: 0 });
    expect(budget.tryConsume('cloudflare')).toBe(false);
    expect(budget.tryConsume('mock')).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test apps/server`
Expected: FAIL — the four modules do not exist.

- [ ] **Step 3: Implement**

`apps/server/src/lib/semaphore.ts`:
```ts
/** FIFO counting semaphore. `acquire` resolves with an idempotent release function. */
export class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(max: number) {
    this.available = max;
  }

  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available -= 1;
    } else {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    return this.releaser();
  }

  get waiting(): number {
    return this.waiters.length;
  }

  private releaser(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiters.shift();
      if (next) next(); // hand the permit straight to the next waiter
      else this.available += 1;
    };
  }
}
```

`apps/server/src/engine/cache-key.ts`:
```ts
import type { GraphIndex, GraphNode } from '@trafaret/core';
import { canonicalJson } from '../lib/canonical-json.ts';
import { sha256Hex } from '../lib/hash.ts';

/** Bump to invalidate every cached result (e.g. after changing how requests are built). */
export const CACHE_VERSION = 1;

/**
 * Input-addressed keys (Nix/Bazel style): a node's key depends on its own settings and on its upstream *keys*,
 * never on outputs — so every cache hit is known before anything runs.
 */
export function computeCacheKeys(
  index: GraphIndex,
  order: readonly string[],
  presetHash: (presetId: string) => string | undefined,
): Map<string, string> {
  const keys = new Map<string, string>();
  for (const nodeId of order) {
    const node = index.nodes.get(nodeId);
    if (!node) continue;
    const inputs: Record<string, string | undefined> = {};
    for (const edge of index.incoming.get(nodeId) ?? []) inputs[edge.targetHandle] = keys.get(edge.source);
    const presetId = 'presetId' in node.data ? node.data.presetId : null;
    const preset = presetId ? (presetHash(presetId) ?? `missing:${presetId}`) : null;
    keys.set(
      nodeId,
      sha256Hex(canonicalJson({ v: CACHE_VERSION, type: node.type, data: relevantData(node, inputs), preset, inputs })),
    );
  }
  return keys;
}

function relevantData(node: GraphNode, inputs: Record<string, string | undefined>): unknown {
  switch (node.type) {
    case 'prompt':
      return { text: node.data.text };
    case 'imageInput':
      return { assetId: node.data.assetId };
    case 'generateImage':
      return { modelId: node.data.modelId, aspectRatio: node.data.aspectRatio, seed: node.data.seed };
    case 'editImage':
      return {
        modelId: node.data.modelId,
        seed: node.data.seed,
        instruction: inputs.prompt === undefined ? node.data.instruction : null,
      };
    case 'result':
      return {};
  }
}
```

`apps/server/src/engine/result-cache.ts`:
```ts
import type { ImageOutput, JobModel, RequestPreview } from '@trafaret/core';

export type CacheEntry = { output: ImageOutput; durationMs: number; request: RequestPreview; model: JobModel };

/** LRU map of successful AI results by cache key. */
export class ResultCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly isValid: (entry: CacheEntry) => boolean;

  constructor(options: { maxEntries: number; isValid?: (entry: CacheEntry) => boolean }) {
    this.maxEntries = options.maxEntries;
    this.isValid = options.isValid ?? (() => true);
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (!this.isValid(entry)) return undefined;
    this.entries.set(key, entry);
    return entry;
  }

  set(key: string, entry: CacheEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
    for (const oldest of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
```

`apps/server/src/engine/daily-budget.ts`:
```ts
import type { ProviderId } from '@trafaret/core';

/** Per-provider daily caps on real generations, reset at 00:00 UTC. Providers without a cap are unlimited. */
export class DailyBudget {
  private readonly limits: Partial<Record<ProviderId, number>>;
  private readonly now: () => number;
  private readonly used = new Map<ProviderId, number>();
  private day = '';

  constructor(limits: Partial<Record<ProviderId, number>>, now: () => number = Date.now) {
    this.limits = limits;
    this.now = now;
  }

  tryConsume(provider: ProviderId): boolean {
    const limit = this.limits[provider];
    if (limit === undefined) return true;
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.used.clear();
    }
    const used = this.used.get(provider) ?? 0;
    if (used >= limit) return false;
    this.used.set(provider, used + 1);
    return true;
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test apps/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(server): add semaphore, input-addressed cache keys, result cache and daily budget"
```

---
### Task 17: Run execution — dependency-driven scheduling, failures, timeouts

**Files:**
- Create: `apps/server/src/engine/errors.ts`, `apps/server/src/engine/run-execution.ts`, `apps/server/src/engine/node-executors.ts`, `apps/server/src/engine/engine.ts`, `apps/server/src/runs/run-repository.ts`, `apps/server/src/test/engine-harness.ts`
- Test: `apps/server/src/runs/run-repository.test.ts`, `apps/server/src/engine/engine.test.ts`

**Interfaces:**
- Consumes: `buildRequest` (Task 15); `Semaphore` (Task 16); `ModelCatalog`, `ModelDefinition` (Task 11); `PresetRepository`, `ResolvedPreset` (Task 10); `AssetStore`, `StoredAsset`, `closestAspectRatio`, `toWebp` (Task 8); `ImageProvider`, `ProviderError` (Task 12); `createMockProvider` (Task 12); core: `indexGraph`, `topologicalOrder`, `isAiNodeType`, `NODE_DEFINITIONS`, `emptyRunSummary`, `assetUrl`, types `Graph`, `GraphIndex`, `GraphNodeOf`, `Job`, `JobError`, `JobModel`, `NodeOutput`, `ImageOutput`, `RequestPreview`, `Run`, `RunSummary`, `NodeType`, `AspectRatio`, `ProviderId`.
- Produces:
  - `class JobFailure extends Error { jobError: JobError }`, `toJobError(error: unknown): JobError`
  - `type NodeInputs = { prompt?: NodeOutput; image?: NodeOutput }`, `type ExecutedNode = { output: NodeOutput; request?: RequestPreview; model?: JobModel }`, `type NodeExecutor = (context: { nodeId; inputs; attempt; markRunning }) => Promise<ExecutedNode>`
  - `class RunExecution { readonly run: Run; constructor(run, options); start(): Promise<void> }`, `summarize(jobs, savedMs?): RunSummary`
  - `type NodeExecutorDeps = { catalog; presets; assets; providers: Partial<Record<ProviderId, ImageProvider>>; semaphore; jobTimeoutMs }`, `createNodeExecutor(index, deps): NodeExecutor`, `imageOutput(asset): ImageOutput`
  - `type RunRecord = { run: Run; execution: RunExecution }`, `class RunRepository { constructor({ maxRuns, retentionMs, now? }); add(record); get(runId); snapshot(runId): Run | undefined }`
  - `class Engine { constructor(deps: EngineDeps); startRun(graph: Graph): string; getRun(runId): Run | undefined }`, `type EngineDeps = NodeExecutorDeps & { runs: RunRepository; logger: Pick<Logger, 'warn'>; now?: () => number }`
  - test harness: `ControlledProvider` (`calls`, `call(seed)`), `createHarness(options)` → `{ engine, provider, assets, catalog, presets }`

- [ ] **Step 1: Install nanoid**

Run:
```bash
pnpm --filter @trafaret/server add nanoid@^6.0.2
```

- [ ] **Step 2: Write the failing run-repository test**

`apps/server/src/runs/run-repository.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { emptyRunSummary, type Run } from '@trafaret/core';
import type { RunExecution } from '../engine/run-execution.ts';
import { RunRepository } from './run-repository.ts';

const run = (id: string, finishedAt: number | null = null): Run => ({
  id,
  status: finishedAt === null ? 'running' : 'completed',
  version: 1,
  createdAt: 0,
  startedAt: 0,
  finishedAt,
  jobs: {},
  summary: emptyRunSummary(),
});
const record = (value: Run) => ({ run: value, execution: {} as RunExecution });

describe('RunRepository', () => {
  it('hands out deep copies', () => {
    const repository = new RunRepository({ maxRuns: 10, retentionMs: 1_000 });
    repository.add(record(run('a')));
    const snapshot = repository.snapshot('a')!;
    snapshot.status = 'failed';
    expect(repository.snapshot('a')?.status).toBe('running');
  });

  it('keeps only the newest runs', () => {
    const repository = new RunRepository({ maxRuns: 2, retentionMs: 1_000 });
    for (const id of ['a', 'b', 'c']) repository.add(record(run(id)));
    expect(repository.get('a')).toBeUndefined();
    expect(repository.get('b')).toBeDefined();
    expect(repository.get('c')).toBeDefined();
  });

  it('drops runs that finished before the retention window', () => {
    const now = 10_000;
    const repository = new RunRepository({ maxRuns: 10, retentionMs: 1_000, now: () => now });
    repository.add(record(run('old', 5_000)));
    repository.add(record(run('recent', 9_500)));
    expect(repository.get('old')).toBeUndefined();
    expect(repository.get('recent')).toBeDefined();
  });
});
```

- [ ] **Step 3: Run it to see it fail, then implement the repository**

Run: `pnpm test apps/server` → FAIL (`./run-repository.ts` missing).

`apps/server/src/runs/run-repository.ts`:
```ts
import type { Run } from '@trafaret/core';
import type { RunExecution } from '../engine/run-execution.ts';

export type RunRecord = { readonly run: Run; readonly execution: RunExecution };

/** In-memory run store: keeps the newest `maxRuns` and drops runs that finished more than `retentionMs` ago. */
export class RunRepository {
  private readonly records = new Map<string, RunRecord>();
  private readonly maxRuns: number;
  private readonly retentionMs: number;
  private readonly now: () => number;

  constructor(options: { maxRuns: number; retentionMs: number; now?: () => number }) {
    this.maxRuns = options.maxRuns;
    this.retentionMs = options.retentionMs;
    this.now = options.now ?? Date.now;
  }

  add(record: RunRecord): void {
    this.records.set(record.run.id, record);
    this.evict();
  }

  get(runId: string): RunRecord | undefined {
    return this.records.get(runId);
  }

  /** A deep copy that is safe to serialise while the run keeps changing. */
  snapshot(runId: string): Run | undefined {
    const record = this.records.get(runId);
    return record ? structuredClone(record.run) : undefined;
  }

  private evict(): void {
    const cutoff = this.now() - this.retentionMs;
    for (const [id, { run }] of this.records) {
      if (run.finishedAt !== null && run.finishedAt < cutoff) this.records.delete(id);
    }
    for (const id of this.records.keys()) {
      if (this.records.size <= this.maxRuns) break;
      this.records.delete(id);
    }
  }
}
```

Run: `pnpm test apps/server` → the repository tests PASS.

- [ ] **Step 4: Add the engine test harness**

`apps/server/src/test/engine-harness.ts`:
```ts
import { pino } from 'pino';
import type { ProviderId } from '@trafaret/core';
import { AssetStore } from '../assets/asset-store.ts';
import { ModelCatalog } from '../catalog/catalog.ts';
import { Engine } from '../engine/engine.ts';
import { Semaphore } from '../lib/semaphore.ts';
import { PresetRepository, type ResolvedPreset } from '../library/preset-repository.ts';
import { createMockProvider } from '../providers/mock.ts';
import type { ImageProvider, ProviderRequest, ProviderResult } from '../providers/types.ts';
import { RunRepository } from '../runs/run-repository.ts';
import { makePng } from './images.ts';

export type PendingCall = {
  request: ProviderRequest;
  signal: AbortSignal;
  resolve: () => void;
  reject: (error: Error) => void;
};

/** A provider whose calls stay pending until the test resolves or rejects them. */
export class ControlledProvider implements ImageProvider {
  readonly id = 'mock' as const;
  readonly calls: PendingCall[] = [];
  private readonly image: Buffer;

  constructor(image: Buffer) {
    this.image = image;
  }

  generate(request: ProviderRequest, signal: AbortSignal): Promise<ProviderResult> {
    return new Promise((resolve, reject) => {
      this.calls.push({ request, signal, resolve: () => resolve({ bytes: this.image }), reject });
      signal.addEventListener(
        'abort',
        () => reject(signal.reason instanceof Error ? signal.reason : new Error('aborted')),
        { once: true },
      );
    });
  }

  /** The most recent call for the node with this seed (fixtures give every AI node its own seed). */
  call(seed: number): PendingCall {
    const found = this.calls.findLast((pending) => pending.request.seed === seed);
    if (!found) throw new Error(`no provider call with seed ${seed}`);
    return found;
  }
}

export type HarnessOptions = {
  maxConcurrentJobs?: number;
  jobTimeoutMs?: number;
  presets?: ResolvedPreset[];
  /** Use the real (instant) mock provider instead of the controlled one. */
  realMock?: boolean;
  now?: () => number;
};

export async function createHarness(options: HarnessOptions = {}) {
  const provider = new ControlledProvider(await makePng(16, 16));
  const assets = new AssetStore({ maxBytes: 64 * 1024 * 1024 });
  const catalog = new ModelCatalog({ cloudflare: null, byteplus: null });
  const presets = new PresetRepository(options.presets ?? []);
  const providers: Partial<Record<ProviderId, ImageProvider>> = {
    mock: options.realMock ? createMockProvider({ latencyMs: { min: 0, max: 0 } }) : provider,
  };
  const engine = new Engine({
    catalog,
    presets,
    assets,
    providers,
    runs: new RunRepository({ maxRuns: 50, retentionMs: 60 * 60 * 1000 }),
    semaphore: new Semaphore(options.maxConcurrentJobs ?? 4),
    jobTimeoutMs: options.jobTimeoutMs ?? 5_000,
    logger: pino({ level: 'silent' }),
    ...(options.now ? { now: options.now } : {}),
  });
  return { engine, provider, assets, catalog, presets };
}
```

- [ ] **Step 5: Write the failing engine tests**

`apps/server/src/engine/engine.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import type { Graph } from '@trafaret/core';
import { branchingGraph, edge, editNode, generateNode, promptNode } from '@trafaret/core/testing';
import { ProviderError } from '../providers/types.ts';
import { createHarness } from '../test/engine-harness.ts';

const busy = () => new ProviderError('PROVIDER_ERROR', 'The AI service is busy. Retry in a few seconds.', true);

describe('Engine', () => {
  it('reports queued with idle jobs before execution starts', async () => {
    const { engine } = await createHarness();
    const runId = engine.startRun(branchingGraph());
    const run = engine.getRun(runId)!;
    expect(run).toMatchObject({ status: 'queued', version: 0, startedAt: null });
    expect(Object.values(run.jobs).every((job) => job.status === 'idle')).toBe(true);
    expect(run.summary.aiNodes).toBe(2);
  });

  it('runs independent branches at the same time', async () => {
    const { engine, provider } = await createHarness();
    const runId = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    const running = engine.getRun(runId)!;
    expect(running.status).toBe('running');
    expect(running.jobs['gen-a']?.status).toBe('running');
    expect(running.jobs['gen-b']?.status).toBe('running');

    provider.call(1).resolve();
    provider.call(2).resolve();
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('completed'));
    const done = engine.getRun(runId)!;
    expect(done.jobs['result-a']?.output).toMatchObject({ kind: 'image', url: expect.stringMatching(/^\/api\/assets\//) });
    expect(done.jobs['gen-a']).toMatchObject({
      request: { prompt: 'A white sneaker on a stone pedestal', modelId: 'mock' },
      model: { id: 'mock', provider: 'mock' },
    });
    expect(done.summary).toMatchObject({ aiNodes: 2, generated: 2, reused: 0, failed: 0 });
    expect(done.finishedAt).not.toBeNull();
  });

  it('starts a node as soon as its own inputs are ready, not level by level', async () => {
    const graph: Graph = {
      nodes: [promptNode('prompt'), generateNode('gen-a', { seed: 1 }), editNode('edit-a', { seed: 3 }), generateNode('gen-b', { seed: 2 })],
      edges: [edge('prompt', 'gen-a', 'prompt'), edge('gen-a', 'edit-a', 'image'), edge('prompt', 'gen-b', 'prompt')],
    };
    const { engine, provider } = await createHarness();
    const runId = engine.startRun(graph);
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));

    provider.call(1).resolve(); // Generate A is done while Generate B keeps running
    await vi.waitFor(() => expect(provider.calls).toHaveLength(3));
    const run = engine.getRun(runId)!;
    expect(run.jobs['edit-a']?.status).toBe('running');
    expect(run.jobs['gen-b']?.status).toBe('running');
  });

  it('keeps branches beyond the concurrency limit queued', async () => {
    const { engine, provider } = await createHarness({ maxConcurrentJobs: 1 });
    const runId = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(1));
    const statuses = ['gen-a', 'gen-b'].map((id) => engine.getRun(runId)?.jobs[id]?.status).sort();
    expect(statuses).toEqual(['queued', 'running']);

    provider.calls[0]!.resolve();
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
  });

  it('isolates a failure to its own branch', async () => {
    const { engine, provider } = await createHarness();
    const runId = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.call(1).reject(busy());
    provider.call(2).resolve();

    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('failed'));
    const run = engine.getRun(runId)!;
    expect(run.jobs['gen-a']).toMatchObject({ status: 'error', error: { code: 'PROVIDER_ERROR', retryable: true } });
    expect(run.jobs['result-a']).toMatchObject({
      status: 'error',
      error: { code: 'UPSTREAM_FAILED', upstreamNodeId: 'gen-a', message: 'Skipped: Generate Image failed.' },
    });
    expect(run.jobs['gen-b']?.status).toBe('success');
    expect(run.jobs['result-b']?.status).toBe('success');
    expect(run.summary).toMatchObject({ generated: 1, failed: 1 });
  });

  it('times out provider calls that take too long', async () => {
    const { engine } = await createHarness({ jobTimeoutMs: 30 });
    const runId = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('failed'));
    expect(engine.getRun(runId)?.jobs['gen-a']?.error).toMatchObject({ code: 'TIMEOUT', retryable: true });
  });
});
```

- [ ] **Step 6: Run them to see them fail**

Run: `pnpm test apps/server`
Expected: FAIL — cannot load `../engine/engine.ts`.

- [ ] **Step 7: Implement job errors**

`apps/server/src/engine/errors.ts`:
```ts
import type { JobError } from '@trafaret/core';
import { ProviderError } from '../providers/types.ts';

/** A failure that already carries its user-facing job error. */
export class JobFailure extends Error {
  readonly jobError: JobError;

  constructor(jobError: JobError) {
    super(jobError.message);
    this.name = 'JobFailure';
    this.jobError = jobError;
  }
}

export function toJobError(error: unknown): JobError {
  if (error instanceof JobFailure) return error.jobError;
  if (error instanceof ProviderError) return { code: error.code, message: error.message, retryable: error.retryable };
  return { code: 'INTERNAL', message: 'Something went wrong on our side. Retry in a few seconds.', retryable: true };
}
```

- [ ] **Step 8: Implement the run execution**

`apps/server/src/engine/run-execution.ts`:
```ts
import { isAiNodeType, NODE_DEFINITIONS } from '@trafaret/core';
import type { GraphIndex, Job, JobError, JobModel, NodeOutput, RequestPreview, Run, RunSummary } from '@trafaret/core';
import { toJobError } from './errors.ts';

export type NodeInputs = { prompt?: NodeOutput; image?: NodeOutput };
export type ExecutedNode = { output: NodeOutput; request?: RequestPreview; model?: JobModel };
export type NodeExecutionContext = { nodeId: string; inputs: NodeInputs; attempt: number; markRunning: () => void };
export type NodeExecutor = (context: NodeExecutionContext) => Promise<ExecutedNode>;

export type RunExecutionOptions = {
  index: GraphIndex;
  order: readonly string[];
  executeNode: NodeExecutor;
  now: () => number;
  onJobFailed: (nodeId: string, error: unknown) => void;
};

/** Rejection that tells dependents which node actually failed. */
class UpstreamFailure extends Error {
  readonly rootNodeId: string;

  constructor(rootNodeId: string) {
    super(`Node ${rootNodeId} failed`);
    this.name = 'UpstreamFailure';
    this.rootNodeId = rootNodeId;
  }
}

/**
 * Executes one run. Each node is a memoised promise that awaits only its own inputs, so independent branches run
 * concurrently and a node starts the moment its dependencies succeed — not level by level.
 */
export class RunExecution {
  readonly run: Run;
  private readonly options: RunExecutionOptions;
  private readonly promises = new Map<string, Promise<NodeOutput>>();

  constructor(run: Run, options: RunExecutionOptions) {
    this.run = run;
    this.options = options;
  }

  /** Queues every node and settles all of them; resolves once nothing is left to run. */
  async start(): Promise<void> {
    this.run.startedAt = this.options.now();
    for (const nodeId of this.options.order) this.job(nodeId).status = 'queued';
    this.changed();
    await Promise.allSettled(this.options.order.map((nodeId) => this.settle(nodeId)));
  }

  private settle(nodeId: string): Promise<NodeOutput> {
    const existing = this.promises.get(nodeId);
    if (existing) return existing;
    const promise = this.execute(nodeId);
    promise.catch(() => undefined); // failures are recorded on the job itself
    this.promises.set(nodeId, promise);
    return promise;
  }

  private async execute(nodeId: string): Promise<NodeOutput> {
    const job = this.job(nodeId);
    let inputs: NodeInputs;
    try {
      inputs = await this.collectInputs(nodeId);
    } catch (error) {
      const rootNodeId = error instanceof UpstreamFailure ? error.rootNodeId : nodeId;
      this.fail(job, {
        code: 'UPSTREAM_FAILED',
        message: `Skipped: ${this.label(rootNodeId)} failed.`,
        retryable: true,
        upstreamNodeId: rootNodeId,
      });
      throw new UpstreamFailure(rootNodeId);
    }
    try {
      const executed = await this.options.executeNode({
        nodeId,
        inputs,
        attempt: job.attempt,
        markRunning: () => this.markRunning(job),
      });
      this.succeed(job, executed);
      return executed.output;
    } catch (error) {
      this.options.onJobFailed(nodeId, error);
      this.fail(job, toJobError(error));
      throw new UpstreamFailure(nodeId);
    }
  }

  private async collectInputs(nodeId: string): Promise<NodeInputs> {
    const edges = this.options.index.incoming.get(nodeId) ?? [];
    const outputs = await Promise.all(edges.map((edge) => this.settle(edge.source)));
    const inputs: NodeInputs = {};
    edges.forEach((edge, position) => {
      inputs[edge.targetHandle] = outputs[position];
    });
    return inputs;
  }

  private markRunning(job: Job): void {
    job.status = 'running';
    job.startedAt = this.options.now();
    this.changed();
  }

  private succeed(job: Job, executed: ExecutedNode): void {
    const now = this.options.now();
    job.status = 'success';
    job.startedAt ??= now;
    job.finishedAt = now;
    job.output = executed.output;
    if (executed.request) job.request = executed.request;
    if (executed.model) job.model = executed.model;
    this.changed();
  }

  private fail(job: Job, error: JobError): void {
    job.status = 'error';
    job.finishedAt = this.options.now();
    job.error = error;
    this.changed();
  }

  private job(nodeId: string): Job {
    const job = this.run.jobs[nodeId];
    if (!job) throw new Error(`Run ${this.run.id} has no job for node ${nodeId}`);
    return job;
  }

  private label(nodeId: string): string {
    const node = this.options.index.nodes.get(nodeId);
    return node ? NODE_DEFINITIONS[node.type].label : nodeId;
  }

  /** Derives the run status and summary from the jobs and bumps the version on every change. */
  private changed(): void {
    const jobs = Object.values(this.run.jobs);
    const active = jobs.some((job) => job.status === 'idle' || job.status === 'queued' || job.status === 'running');
    const failed = jobs.some((job) => job.status === 'error');
    this.run.status = this.run.startedAt === null ? 'queued' : active ? 'running' : failed ? 'failed' : 'completed';
    const terminal = this.run.status === 'completed' || this.run.status === 'failed';
    this.run.finishedAt = terminal ? (this.run.finishedAt ?? this.options.now()) : null;
    this.run.summary = summarize(jobs);
    this.run.version += 1;
  }
}

export function summarize(jobs: readonly Job[], savedMs = 0): RunSummary {
  const ai = jobs.filter((job) => isAiNodeType(job.nodeType));
  const succeeded = ai.filter((job) => job.status === 'success' && !job.cached);
  return {
    aiNodes: ai.length,
    generated: succeeded.filter((job) => job.model?.fallbackFrom === undefined).length,
    reused: ai.filter((job) => job.cached).length,
    failed: jobs.filter((job) => job.status === 'error' && job.error?.code !== 'UPSTREAM_FAILED').length,
    savedMs,
    fallbacks: succeeded.filter((job) => job.model?.fallbackFrom !== undefined).length,
  };
}
```

- [ ] **Step 9: Implement the node executors**

`apps/server/src/engine/node-executors.ts`:
```ts
import { assetUrl, type AspectRatio, type GraphIndex, type GraphNodeOf, type ImageOutput } from '@trafaret/core';
import type { JobModel, ProviderId } from '@trafaret/core';
import type { AssetStore, StoredAsset } from '../assets/asset-store.ts';
import { closestAspectRatio, toWebp } from '../assets/image.ts';
import type { ModelCatalog } from '../catalog/catalog.ts';
import type { ModelDefinition } from '../catalog/models.ts';
import type { Semaphore } from '../lib/semaphore.ts';
import type { PresetRepository } from '../library/preset-repository.ts';
import type { ImageProvider } from '../providers/types.ts';
import { JobFailure } from './errors.ts';
import { buildRequest } from './request-builder.ts';
import type { ExecutedNode, NodeExecutor, NodeInputs } from './run-execution.ts';

export type NodeExecutorDeps = {
  catalog: ModelCatalog;
  presets: PresetRepository;
  assets: AssetStore;
  providers: Partial<Record<ProviderId, ImageProvider>>;
  semaphore: Semaphore;
  jobTimeoutMs: number;
};

export const imageOutput = (asset: StoredAsset): ImageOutput => ({
  kind: 'image',
  assetId: asset.id,
  url: assetUrl(asset.id),
  width: asset.width,
  height: asset.height,
});

const imageGone = (): JobFailure =>
  new JobFailure({ code: 'INVALID_INPUT', message: 'This image is no longer on the server. Upload it again.', retryable: false });

const notConfigured = (): JobFailure =>
  new JobFailure({ code: 'PROVIDER_ERROR', message: 'This model is not configured on the server.', retryable: false });

export function createNodeExecutor(index: GraphIndex, deps: NodeExecutorDeps): NodeExecutor {
  return async ({ nodeId, inputs, attempt, markRunning }) => {
    const node = index.nodes.get(nodeId);
    if (!node) throw new Error(`Unknown node ${nodeId}`);
    switch (node.type) {
      case 'prompt':
        markRunning();
        return { output: { kind: 'text', text: node.data.text } };
      case 'imageInput': {
        markRunning();
        const asset = node.data.assetId ? deps.assets.get(node.data.assetId) : undefined;
        if (!asset) throw imageGone();
        return { output: imageOutput(asset) };
      }
      case 'result':
        markRunning();
        if (inputs.image?.kind !== 'image') {
          throw new JobFailure({ code: 'INTERNAL', message: 'The image for this result is missing. Run again.', retryable: true });
        }
        return { output: inputs.image };
      case 'generateImage':
      case 'editImage':
        return await runAiNode(node, inputs, attempt, markRunning, deps);
    }
  };
}

async function runAiNode(
  node: GraphNodeOf<'generateImage'> | GraphNodeOf<'editImage'>,
  inputs: NodeInputs,
  attempt: number,
  markRunning: () => void,
  deps: NodeExecutorDeps,
): Promise<ExecutedNode> {
  const model = deps.catalog.definition(node.data.modelId);
  if (!model) throw notConfigured();
  const preset = node.data.presetId ? (deps.presets.get(node.data.presetId) ?? null) : null;

  let userText: string;
  let aspectRatio: AspectRatio;
  let sourceAssetId: string | null = null;
  if (node.type === 'generateImage') {
    userText = inputs.prompt?.kind === 'text' ? inputs.prompt.text : '';
    aspectRatio = node.data.aspectRatio;
  } else {
    const source = inputs.image?.kind === 'image' ? deps.assets.get(inputs.image.assetId) : undefined;
    if (!source) throw imageGone();
    userText = inputs.prompt?.kind === 'text' ? inputs.prompt.text : node.data.instruction;
    aspectRatio = closestAspectRatio(source.width, source.height);
    sourceAssetId = source.id;
  }

  const built = buildRequest({ userText, aspectRatio, seed: node.data.seed, model, preset, sourceAssetId });
  const images = built.referenceAssetIds.flatMap((id) => {
    const asset = deps.assets.get(id);
    return asset ? [{ bytes: asset.bytes, mime: asset.mime }] : [];
  });

  const release = await deps.semaphore.acquire();
  try {
    markRunning();
    const target = pickProvider(model, deps);
    const result = await withTimeout(deps.jobTimeoutMs, (signal) =>
      target.provider.generate(
        {
          model: target.providerModel,
          mode: node.type === 'editImage' ? 'edit' : 'generate',
          prompt: built.prompt,
          negativePrompt: built.negativePrompt,
          images,
          width: built.width,
          height: built.height,
          seed: built.seed,
          attempt,
        },
        signal,
      ),
    );
    const stored = await storeOutput(result.bytes, deps.assets);
    return { output: imageOutput(stored), request: built.preview, model: target.jobModel };
  } finally {
    release();
  }
}

type ProviderTarget = { provider: ImageProvider; providerModel: string; jobModel: JobModel };

function pickProvider(model: ModelDefinition, deps: NodeExecutorDeps): ProviderTarget {
  const provider = deps.providers[model.provider];
  if (!provider) throw notConfigured();
  return { provider, providerModel: model.providerModel, jobModel: { id: model.id, provider: model.provider } };
}

async function storeOutput(bytes: Buffer, assets: AssetStore): Promise<StoredAsset> {
  let webp: Buffer;
  try {
    webp = await toWebp(bytes);
  } catch {
    throw new JobFailure({
      code: 'PROVIDER_ERROR',
      message: 'The AI service returned an unreadable image. Retry in a few seconds.',
      retryable: true,
    });
  }
  return assets.put(webp);
}

async function withTimeout<T>(timeoutMs: number, call: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    return await call(signal);
  } catch (error) {
    if (signal.aborted) {
      const seconds = Math.max(1, Math.round(timeoutMs / 1000));
      throw new JobFailure({
        code: 'TIMEOUT',
        message: `No answer from the AI service in ${seconds} s. Retry to try again.`,
        retryable: true,
      });
    }
    throw error;
  }
}
```

- [ ] **Step 10: Implement the engine**

`apps/server/src/engine/engine.ts`:
```ts
import { nanoid } from 'nanoid';
import { emptyRunSummary, indexGraph, topologicalOrder } from '@trafaret/core';
import type { Graph, Job, NodeType, Run } from '@trafaret/core';
import type { Logger } from 'pino';
import type { RunRepository } from '../runs/run-repository.ts';
import { createNodeExecutor, type NodeExecutorDeps } from './node-executors.ts';
import { RunExecution, summarize } from './run-execution.ts';

export type EngineDeps = NodeExecutorDeps & {
  runs: RunRepository;
  logger: Pick<Logger, 'warn'>;
  now?: () => number;
};

const newJob = (nodeId: string, nodeType: NodeType): Job => ({
  nodeId,
  nodeType,
  status: 'idle',
  attempt: 1,
  startedAt: null,
  finishedAt: null,
  cached: false,
});

export class Engine {
  private readonly deps: EngineDeps;
  private readonly now: () => number;

  constructor(deps: EngineDeps) {
    this.deps = deps;
    this.now = deps.now ?? Date.now;
  }

  /** Starts a validated graph in the background and returns the new run's id. */
  startRun(graph: Graph): string {
    const index = indexGraph(graph);
    const order = topologicalOrder(index);
    if (!order) throw new Error('startRun needs a validated, acyclic graph');

    const run: Run = {
      id: `run_${nanoid(12)}`,
      status: 'queued',
      version: 0,
      createdAt: this.now(),
      startedAt: null,
      finishedAt: null,
      jobs: {},
      summary: emptyRunSummary(),
    };
    for (const nodeId of order) {
      const node = index.nodes.get(nodeId);
      if (node) run.jobs[nodeId] = newJob(nodeId, node.type);
    }
    run.summary = summarize(Object.values(run.jobs));

    const execution = new RunExecution(run, {
      index,
      order,
      now: this.now,
      executeNode: createNodeExecutor(index, this.deps),
      onJobFailed: (nodeId, error) => this.deps.logger.warn({ runId: run.id, nodeId, err: error }, 'job failed'),
    });
    this.deps.runs.add({ run, execution });
    setImmediate(() => {
      void execution.start();
    });
    return run.id;
  }

  getRun(runId: string): Run | undefined {
    return this.deps.runs.snapshot(runId);
  }
}
```

- [ ] **Step 11: Run the tests**

Run: `pnpm test apps/server && pnpm typecheck`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(server): execute runs with dependency-driven parallelism, failure isolation and timeouts"
```

---

### Task 18: Retry of failed nodes

**Files:**
- Modify: `apps/server/src/engine/run-execution.ts`, `apps/server/src/engine/engine.ts`
- Test: `apps/server/src/engine/retry.test.ts`

**Interfaces:**
- Consumes: `ancestorsOf`, `descendantsOf` from `@trafaret/core`; harness (Task 17).
- Produces:
  - `RunExecution.retry(nodeId: string): 'ok' | 'not-failed'`
  - `Engine.retryNode(runId: string, nodeId: string): 'ok' | 'run-not-found' | 'node-not-failed'`

- [ ] **Step 1: Write the failing tests**

`apps/server/src/engine/retry.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import type { Graph, GraphNode } from '@trafaret/core';
import { branchingGraph, generateNode } from '@trafaret/core/testing';
import { ProviderError } from '../providers/types.ts';
import { createHarness } from '../test/engine-harness.ts';

const busy = () => new ProviderError('PROVIDER_ERROR', 'The AI service is busy. Retry in a few seconds.', true);
const withNode = (graph: Graph, node: GraphNode): Graph => ({
  ...graph,
  nodes: graph.nodes.map((existing) => (existing.id === node.id ? node : existing)),
});

describe('retry', () => {
  it('re-runs only the failed node and the dependents it blocked', async () => {
    const { engine, provider } = await createHarness();
    const runId = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.call(1).reject(busy());
    provider.call(2).resolve();
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('failed'));

    expect(engine.retryNode(runId, 'result-a')).toBe('ok'); // retrying a skipped node retries its root cause
    expect(engine.getRun(runId)).toMatchObject({ status: 'running', finishedAt: null });
    await vi.waitFor(() => expect(provider.calls).toHaveLength(3));
    expect(provider.calls[2]?.request).toMatchObject({ seed: 1, attempt: 2 }); // only Generate A is called again

    provider.calls[2]!.resolve();
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('completed'));
    const run = engine.getRun(runId)!;
    expect(run.jobs['gen-a']).toMatchObject({ status: 'success', attempt: 2 });
    expect(run.jobs['result-a']).toMatchObject({ status: 'success', attempt: 1 });
    expect(run.jobs['gen-b']?.attempt).toBe(1);
  });

  it('works while a sibling branch is still running', async () => {
    const { engine, provider } = await createHarness();
    const runId = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.call(1).reject(busy());
    await vi.waitFor(() => expect(engine.getRun(runId)?.jobs['result-a']?.status).toBe('error'));
    expect(engine.getRun(runId)?.status).toBe('running'); // Generate B is still in flight

    expect(engine.retryNode(runId, 'gen-a')).toBe('ok');
    await vi.waitFor(() => expect(provider.calls).toHaveLength(3));
    provider.call(2).resolve();
    provider.call(1).resolve(); // the retried call
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('completed'));
  });

  it('refuses nodes that did not fail and unknown runs', async () => {
    const { engine } = await createHarness({ realMock: true });
    const runId = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('completed'));
    expect(engine.retryNode(runId, 'gen-a')).toBe('node-not-failed');
    expect(engine.retryNode('run_missing', 'gen-a')).toBe('run-not-found');
  });

  it('turns the "fails first attempt" model green on retry', async () => {
    const { engine } = await createHarness({ realMock: true });
    const graph = withNode(branchingGraph(), generateNode('gen-a', { seed: 1, modelId: 'mock-fails-first' }));
    const runId = engine.startRun(graph);
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('failed'));
    expect(engine.getRun(runId)?.jobs['gen-a']?.error).toMatchObject({ code: 'PROVIDER_ERROR', retryable: true });

    engine.retryNode(runId, 'gen-a');
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('completed'));
    expect(engine.getRun(runId)?.jobs['gen-a']?.attempt).toBe(2);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test apps/server`
Expected: FAIL — `engine.retryNode is not a function`.

- [ ] **Step 3: Add retry to `RunExecution`**

In `apps/server/src/engine/run-execution.ts`:
- change the core import to `import { ancestorsOf, descendantsOf, isAiNodeType, NODE_DEFINITIONS } from '@trafaret/core';`
- add these two methods to `RunExecution`, right after `start()`:

```ts
  /** Re-runs a failed node together with the failed ancestors it depends on and the dependents it blocked. */
  retry(nodeId: string): 'ok' | 'not-failed' {
    if (this.run.jobs[nodeId]?.status !== 'error') return 'not-failed';
    const reset = this.resetSet(nodeId);
    for (const id of reset) {
      const job = this.job(id);
      if (job.error?.code !== 'UPSTREAM_FAILED') job.attempt += 1;
      job.status = 'queued';
      job.startedAt = null;
      job.finishedAt = null;
      delete job.error;
      delete job.output;
      delete job.request;
      delete job.model;
      this.promises.delete(id);
    }
    this.changed();
    for (const id of reset) void this.settle(id);
    return 'ok';
  }

  private resetSet(nodeId: string): Set<string> {
    const failed = (id: string): boolean => this.run.jobs[id]?.status === 'error';
    const reset = new Set([nodeId]);
    for (const id of ancestorsOf(this.options.index, nodeId)) if (failed(id)) reset.add(id);
    for (const id of [...reset]) {
      for (const dependent of descendantsOf(this.options.index, id)) if (failed(dependent)) reset.add(dependent);
    }
    return reset;
  }
```

Successful nodes keep their outputs and in-flight siblings keep their promises, so the reset nodes simply await them again.

- [ ] **Step 4: Add `retryNode` to `Engine`**

In `apps/server/src/engine/engine.ts`, add this method after `getRun`:
```ts
  retryNode(runId: string, nodeId: string): 'ok' | 'run-not-found' | 'node-not-failed' {
    const record = this.deps.runs.get(runId);
    if (!record) return 'run-not-found';
    return record.execution.retry(nodeId) === 'ok' ? 'ok' : 'node-not-failed';
  }
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test apps/server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(server): retry failed nodes and the dependents they blocked, even mid-run"
```

---

### Task 19: Incremental runs and the daily-budget fallback

**Files:**
- Modify: `apps/server/src/engine/run-execution.ts`, `apps/server/src/engine/node-executors.ts`, `apps/server/src/engine/engine.ts`, `apps/server/src/test/engine-harness.ts`
- Test: `apps/server/src/engine/incremental.test.ts`

**Interfaces:**
- Consumes: `computeCacheKeys`, `ResultCache`, `CacheEntry`, `DailyBudget` (Task 16).
- Produces:
  - `RunExecutionOptions` gains `cacheKeys: ReadonlyMap<string, string>` and `cache: ResultCache`
  - `NodeExecutorDeps` gains `budget: DailyBudget`; `EngineDeps` gains `cache: ResultCache`
  - jobs reused from the cache: `status: 'success'`, `cached: true`, zero duration at `run.startedAt`; `summary.reused` / `summary.savedMs`
  - budget fallback jobs: `model: { id: 'mock', provider: 'mock', fallbackFrom: <requested model id> }`; never cached
  - harness options gain `credentials`, `dailyLimits`; harness returns `cache`

- [ ] **Step 1: Write the failing tests**

`apps/server/src/engine/incremental.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import type { Graph, GraphNode } from '@trafaret/core';
import { branchingGraph, edge, editNode, generateNode, promptNode } from '@trafaret/core/testing';
import type { ResolvedPreset } from '../library/preset-repository.ts';
import { ProviderError } from '../providers/types.ts';
import { createHarness } from '../test/engine-harness.ts';

const withNode = (graph: Graph, node: GraphNode): Graph => ({
  ...graph,
  nodes: graph.nodes.map((existing) => (existing.id === node.id ? node : existing)),
});
const fakePreset = (id: string, contentHash: string): ResolvedPreset => ({
  preset: { id, name: id, mainPrompt: `${id} style`, negativePrompt: '', references: [] },
  referenceAssetIds: [],
  contentHash,
});

describe('incremental runs', () => {
  it('reuses unchanged AI nodes on the next run', async () => {
    const { engine, provider } = await createHarness();
    const first = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.calls.forEach((call) => call.resolve());
    await vi.waitFor(() => expect(engine.getRun(first)?.status).toBe('completed'));

    const second = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(engine.getRun(second)?.status).toBe('completed'));
    expect(provider.calls).toHaveLength(2); // no new provider calls
    const run = engine.getRun(second)!;
    expect(run.jobs['gen-a']).toMatchObject({ status: 'success', cached: true });
    expect(run.jobs['result-a']?.output).toEqual(engine.getRun(first)?.jobs['result-a']?.output);
    expect(run.summary).toMatchObject({ generated: 0, reused: 2 });
  });

  it('re-runs only the branch whose preset changed', async () => {
    const presets = [fakePreset('premium-3d', 'h1'), fakePreset('lifestyle', 'h2')];
    const { engine, provider } = await createHarness({ presets });
    const graph = withNode(branchingGraph(), generateNode('gen-b', { seed: 2, presetId: 'premium-3d' }));
    const first = engine.startRun(graph);
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.calls.forEach((call) => call.resolve());
    await vi.waitFor(() => expect(engine.getRun(first)?.status).toBe('completed'));

    const second = engine.startRun(withNode(graph, generateNode('gen-b', { seed: 2, presetId: 'lifestyle' })));
    await vi.waitFor(() => expect(provider.calls).toHaveLength(3));
    expect(provider.calls[2]?.request.seed).toBe(2);
    expect(engine.getRun(second)?.jobs['gen-a']?.cached).toBe(true);
    provider.calls[2]!.resolve();
    await vi.waitFor(() => expect(engine.getRun(second)?.status).toBe('completed'));
    expect(engine.getRun(second)?.summary).toMatchObject({ generated: 1, reused: 1 });
  });

  it('treats a new seed as a change to the node and everything after it', async () => {
    const chain = (seed: number): Graph => ({
      nodes: [promptNode('p'), generateNode('gen', { seed }), editNode('edit', { seed: 50 })],
      edges: [edge('p', 'gen', 'prompt'), edge('gen', 'edit', 'image')],
    });
    const { engine } = await createHarness({ realMock: true });
    const first = engine.startRun(chain(1));
    await vi.waitFor(() => expect(engine.getRun(first)?.status).toBe('completed'));
    const second = engine.startRun(chain(2));
    await vi.waitFor(() => expect(engine.getRun(second)?.status).toBe('completed'));
    expect(engine.getRun(second)?.jobs['gen']?.cached).toBe(false);
    expect(engine.getRun(second)?.jobs['edit']?.cached).toBe(false);
  });

  it('never caches failures', async () => {
    const { engine, provider } = await createHarness();
    const first = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.call(1).reject(new ProviderError('PROVIDER_ERROR', 'busy', true));
    provider.call(2).resolve();
    await vi.waitFor(() => expect(engine.getRun(first)?.status).toBe('failed'));

    const second = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(3));
    expect(provider.calls[2]?.request.seed).toBe(1);
    expect(engine.getRun(second)?.jobs['gen-b']?.cached).toBe(true);
  });

  it('reports the time saved by reused results', async () => {
    let now = 1_000;
    const { engine, provider } = await createHarness({ now: () => now });
    const first = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    now = 4_000; // each generation took 3 s
    provider.calls.forEach((call) => call.resolve());
    await vi.waitFor(() => expect(engine.getRun(first)?.status).toBe('completed'));

    const second = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(engine.getRun(second)?.status).toBe('completed'));
    expect(engine.getRun(second)?.summary.savedMs).toBe(6_000);
  });

  it('falls back to the mock model once the daily budget is spent, and does not cache that', async () => {
    const { engine } = await createHarness({ realMock: true, credentials: { cloudflare: true }, dailyLimits: { cloudflare: 0 } });
    const graph = withNode(branchingGraph(), generateNode('gen-a', { seed: 1, modelId: 'flux-2-klein' }));
    const first = engine.startRun(graph);
    await vi.waitFor(() => expect(engine.getRun(first)?.status).toBe('completed'));
    expect(engine.getRun(first)?.jobs['gen-a']).toMatchObject({
      status: 'success',
      model: { id: 'mock', provider: 'mock', fallbackFrom: 'flux-2-klein' },
      request: { modelId: 'flux-2-klein' },
    });
    expect(engine.getRun(first)?.summary).toMatchObject({ generated: 1, fallbacks: 1 });

    const second = engine.startRun(graph);
    await vi.waitFor(() => expect(engine.getRun(second)?.status).toBe('completed'));
    expect(engine.getRun(second)?.jobs['gen-a']?.cached).toBe(false);
    expect(engine.getRun(second)?.jobs['gen-b']?.cached).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test apps/server`
Expected: FAIL — runs are never reused (`cached: false`), the harness rejects `credentials`/`dailyLimits`.

- [ ] **Step 3: Teach `RunExecution` about cache hits**

In `apps/server/src/engine/run-execution.ts`:

1. Add the import:
```ts
import type { CacheEntry, ResultCache } from './result-cache.ts';
```

2. Extend the options type:
```ts
export type RunExecutionOptions = {
  index: GraphIndex;
  order: readonly string[];
  cacheKeys: ReadonlyMap<string, string>;
  cache: ResultCache;
  executeNode: NodeExecutor;
  now: () => number;
  onJobFailed: (nodeId: string, error: unknown) => void;
};
```

3. Add a field next to `promises`:
```ts
  private readonly hits = new Map<string, CacheEntry>();
```

4. Replace `start()` with:
```ts
  /** Marks cache hits as done, queues everything else and settles every node. */
  async start(): Promise<void> {
    const startedAt = this.options.now();
    this.run.startedAt = startedAt;
    for (const nodeId of this.options.order) {
      const job = this.job(nodeId);
      const key = this.options.cacheKeys.get(nodeId);
      const hit = key !== undefined && isAiNodeType(job.nodeType) ? this.options.cache.get(key) : undefined;
      if (!hit) {
        job.status = 'queued';
        continue;
      }
      this.hits.set(nodeId, hit);
      job.status = 'success';
      job.cached = true;
      job.startedAt = startedAt;
      job.finishedAt = startedAt;
      job.output = hit.output;
      job.request = hit.request;
      job.model = hit.model;
    }
    this.changed();
    await Promise.allSettled(this.options.order.map((nodeId) => this.settle(nodeId)));
  }
```

5. In `execute()`, insert at the very top:
```ts
    const hit = this.hits.get(nodeId);
    if (hit) return hit.output; // known at planning time: no need to wait for inputs
```
   and right after `this.succeed(job, executed);` add:
```ts
      this.remember(nodeId, job, executed);
```

6. Add this method to the class:
```ts
  /** Stores successful AI results under the node's cache key; fallbacks and failures are never cached. */
  private remember(nodeId: string, job: Job, executed: ExecutedNode): void {
    const key = this.options.cacheKeys.get(nodeId);
    const { output, request, model } = executed;
    if (key === undefined || output.kind !== 'image' || !request || !model || model.fallbackFrom !== undefined) return;
    this.options.cache.set(key, {
      output,
      request,
      model,
      durationMs: (job.finishedAt ?? 0) - (job.startedAt ?? 0),
    });
  }
```

7. In `changed()`, replace `this.run.summary = summarize(jobs);` with:
```ts
    const savedMs = [...this.hits.values()].reduce((sum, hit) => sum + hit.durationMs, 0);
    this.run.summary = summarize(jobs, savedMs);
```

- [ ] **Step 4: Add the budget fallback to the node executors**

In `apps/server/src/engine/node-executors.ts`:

1. Add the import:
```ts
import type { DailyBudget } from './daily-budget.ts';
```

2. Add `budget: DailyBudget;` to `NodeExecutorDeps` (after `semaphore`).

3. Replace `pickProvider` with:
```ts
/** The model's own provider while today's budget lasts; afterwards the Mock model, labelled as a fallback. */
function pickProvider(model: ModelDefinition, deps: NodeExecutorDeps): ProviderTarget {
  if (deps.budget.tryConsume(model.provider)) {
    const provider = deps.providers[model.provider];
    if (!provider) throw notConfigured();
    return { provider, providerModel: model.providerModel, jobModel: { id: model.id, provider: model.provider } };
  }
  const mock = deps.providers.mock;
  if (!mock) {
    throw new JobFailure({
      code: 'PROVIDER_ERROR',
      message: "Today's demo budget is used up. Try again after 00:00 UTC.",
      retryable: false,
    });
  }
  return { provider: mock, providerModel: 'mock', jobModel: { id: 'mock', provider: 'mock', fallbackFrom: model.id } };
}
```

- [ ] **Step 5: Wire keys and cache in the engine**

In `apps/server/src/engine/engine.ts`:

1. Add the imports:
```ts
import { computeCacheKeys } from './cache-key.ts';
import type { ResultCache } from './result-cache.ts';
```

2. Extend the deps type:
```ts
export type EngineDeps = NodeExecutorDeps & {
  runs: RunRepository;
  cache: ResultCache;
  logger: Pick<Logger, 'warn'>;
  now?: () => number;
};
```

3. In `startRun`, pass the two new options to `new RunExecution(run, { … })`:
```ts
      cacheKeys: computeCacheKeys(index, order, (presetId) => this.deps.presets.get(presetId)?.contentHash),
      cache: this.deps.cache,
```

- [ ] **Step 6: Update the harness**

Replace the bottom part of `apps/server/src/test/engine-harness.ts` (from `export type HarnessOptions` to the end) with:
```ts
export type HarnessOptions = {
  maxConcurrentJobs?: number;
  jobTimeoutMs?: number;
  presets?: ResolvedPreset[];
  /** Use the real (instant) mock provider instead of the controlled one. */
  realMock?: boolean;
  credentials?: { cloudflare?: boolean; byteplus?: boolean };
  dailyLimits?: Partial<Record<ProviderId, number>>;
  now?: () => number;
};

export async function createHarness(options: HarnessOptions = {}) {
  const provider = new ControlledProvider(await makePng(16, 16));
  const assets = new AssetStore({ maxBytes: 64 * 1024 * 1024 });
  const catalog = new ModelCatalog({
    cloudflare: options.credentials?.cloudflare ? { accountId: 'acc', apiToken: 'tok' } : null,
    byteplus: options.credentials?.byteplus ? { apiKey: 'key' } : null,
  });
  const presets = new PresetRepository(options.presets ?? []);
  const cache = new ResultCache({ maxEntries: 100, isValid: (entry) => assets.has(entry.output.assetId) });
  const providers: Partial<Record<ProviderId, ImageProvider>> = {
    mock: options.realMock ? createMockProvider({ latencyMs: { min: 0, max: 0 } }) : provider,
  };
  const engine = new Engine({
    catalog,
    presets,
    assets,
    providers,
    cache,
    runs: new RunRepository({ maxRuns: 50, retentionMs: 60 * 60 * 1000 }),
    semaphore: new Semaphore(options.maxConcurrentJobs ?? 4),
    budget: new DailyBudget(options.dailyLimits ?? {}),
    jobTimeoutMs: options.jobTimeoutMs ?? 5_000,
    logger: pino({ level: 'silent' }),
    ...(options.now ? { now: options.now } : {}),
  });
  return { engine, provider, assets, catalog, presets, cache };
}
```
and add the imports:
```ts
import { DailyBudget } from '../engine/daily-budget.ts';
import { ResultCache } from '../engine/result-cache.ts';
```

- [ ] **Step 7: Run all tests and typecheck**

Run: `pnpm test apps/server && pnpm typecheck`
Expected: PASS — including the Task 17 and 18 suites.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(server): reuse unchanged AI results across runs and fall back to mock past the daily budget"
```

---

### Task 20: Runs API — create, poll, retry

**Files:**
- Create: `apps/server/src/runs/validate-run-graph.ts`, `apps/server/src/runs/routes.ts`
- Test: `apps/server/src/runs/validate-run-graph.test.ts`, `apps/server/src/runs/routes.test.ts`

**Interfaces:**
- Consumes: `Engine` (Tasks 17–19), `ModelCatalog` (Task 11), `PresetRepository` (Task 10), `AssetStore` (Task 8), `AppError`, `createHttpServer` (Task 7); core: `validateGraph`, `createRunBodySchema`, `runIdResponseSchema`, `runParamsSchema`, `retryParamsSchema`, `runSchema`, `Graph`, `Issue`.
- Produces:
  - `validateRunGraph(graph: Graph, context: { catalog; presets; assets }): Issue[]`
  - `registerRunRoutes(app, { engine, catalog, presets, assets, runsPer10Minutes })` — `POST /api/runs` → `202 { runId }` | `400 INVALID_GRAPH` (issues); `GET /api/runs/:runId` → `200 Run` | `404 RUN_NOT_FOUND`; `POST /api/runs/:runId/nodes/:nodeId/retry` → `202 { runId }` | `404` | `409 NODE_NOT_FAILED`; run creation and retries share one rate-limit group

- [ ] **Step 1: Write the failing validation test**

`apps/server/src/runs/validate-run-graph.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Graph, GraphNode } from '@trafaret/core';
import { branchingGraph, edge, editNode, generateNode, imageInputNode, resultNode } from '@trafaret/core/testing';
import { AssetStore } from '../assets/asset-store.ts';
import { ModelCatalog } from '../catalog/catalog.ts';
import { MODEL_DEFINITIONS } from '../catalog/models.ts';
import { PresetRepository } from '../library/preset-repository.ts';
import { validateRunGraph } from './validate-run-graph.ts';

const mock = MODEL_DEFINITIONS.find((model) => model.id === 'mock')!;
const context = {
  catalog: new ModelCatalog({ cloudflare: null, byteplus: null }, [...MODEL_DEFINITIONS, { ...mock, id: 'no-edit', supportsEdit: false }]),
  presets: new PresetRepository([]),
  assets: new AssetStore({ maxBytes: 1e6 }),
};
const withNode = (graph: Graph, node: GraphNode): Graph => ({
  ...graph,
  nodes: graph.nodes.map((existing) => (existing.id === node.id ? node : existing)),
});

describe('validateRunGraph', () => {
  it('accepts a runnable graph', () => {
    expect(validateRunGraph(branchingGraph(), context)).toEqual([]);
  });

  it('adds catalog, preset and asset checks to the graph rules', () => {
    const graph: Graph = {
      nodes: [
        ...withNode(branchingGraph(), generateNode('gen-a', { seed: 1, modelId: 'seedream-4.5' })).nodes.map((node) =>
          node.id === 'gen-b' ? generateNode('gen-b', { seed: 2, presetId: 'nope' }) : node,
        ),
        imageInputNode('img', 'b'.repeat(64)),
        editNode('edit', { modelId: 'no-edit' }),
        resultNode('edited'),
      ],
      edges: [...branchingGraph().edges, edge('img', 'edit', 'image'), edge('edit', 'edited', 'image')],
    };
    expect(validateRunGraph(graph, context).map((issue) => [issue.code, issue.nodeId])).toEqual([
      ['MODEL_UNAVAILABLE', 'gen-a'],
      ['UNKNOWN_PRESET', 'gen-b'],
      ['UNKNOWN_ASSET', 'img'],
      ['MODEL_CANNOT_EDIT', 'edit'],
    ]);
  });

  it('reports unknown models', () => {
    const graph = withNode(branchingGraph(), generateNode('gen-a', { modelId: 'imaginary' }));
    expect(validateRunGraph(graph, context)).toContainEqual(
      expect.objectContaining({ code: 'UNKNOWN_MODEL', nodeId: 'gen-a' }),
    );
  });
});
```

- [ ] **Step 2: Run it to see it fail, then implement**

Run: `pnpm test apps/server` → FAIL (`./validate-run-graph.ts` missing).

`apps/server/src/runs/validate-run-graph.ts`:
```ts
import { validateGraph, type Graph, type Issue } from '@trafaret/core';
import type { AssetStore } from '../assets/asset-store.ts';
import type { ModelCatalog } from '../catalog/catalog.ts';
import type { PresetRepository } from '../library/preset-repository.ts';

export type RunGraphContext = { catalog: ModelCatalog; presets: PresetRepository; assets: AssetStore };

/** The shared graph rules plus what only the server knows: models, presets and stored images. */
export function validateRunGraph(graph: Graph, context: RunGraphContext): Issue[] {
  const issues = validateGraph(graph);
  for (const node of graph.nodes) {
    if (node.type === 'generateImage' || node.type === 'editImage') {
      const model = context.catalog.get(node.data.modelId);
      if (!model) {
        issues.push({ code: 'UNKNOWN_MODEL', message: `Unknown model "${node.data.modelId}".`, nodeId: node.id });
      } else if (!model.enabled) {
        issues.push({ code: 'MODEL_UNAVAILABLE', message: model.unavailableReason ?? 'This model is not available.', nodeId: node.id });
      } else if (node.type === 'editImage' && !model.supportsEdit) {
        issues.push({ code: 'MODEL_CANNOT_EDIT', message: `${model.label} can't edit images. Pick another model.`, nodeId: node.id });
      }
      if (node.data.presetId && !context.presets.get(node.data.presetId)) {
        issues.push({ code: 'UNKNOWN_PRESET', message: `Unknown preset "${node.data.presetId}".`, nodeId: node.id });
      }
    }
    if (node.type === 'imageInput' && node.data.assetId && !context.assets.has(node.data.assetId)) {
      issues.push({ code: 'UNKNOWN_ASSET', message: 'This image is no longer on the server. Upload it again.', nodeId: node.id });
    }
  }
  return issues;
}
```

Run: `pnpm test apps/server` → PASS.

- [ ] **Step 3: Write the failing routes test**

`apps/server/src/runs/routes.test.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { Graph, GraphNode, Run } from '@trafaret/core';
import { branchingGraph, generateNode } from '@trafaret/core/testing';
import { createHttpServer } from '../http/server.ts';
import { createHarness } from '../test/engine-harness.ts';
import { registerRunRoutes } from './routes.ts';

async function setup(runsPer10Minutes = 100) {
  const harness = await createHarness({ realMock: true });
  const app = await createHttpServer({ logger: pino({ level: 'silent' }) });
  registerRunRoutes(app, { ...harness, runsPer10Minutes });
  return app;
}

const createRun = (app: FastifyInstance, graph: unknown) =>
  app.inject({ method: 'POST', url: '/api/runs', payload: { graph } });

async function waitForStatus(app: FastifyInstance, runId: string, status: Run['status']): Promise<Run> {
  let run: Run | undefined;
  await vi.waitFor(async () => {
    run = (await app.inject({ method: 'GET', url: `/api/runs/${runId}` })).json<Run>();
    expect(run.status).toBe(status);
  });
  return run!;
}

const withNode = (graph: Graph, node: GraphNode): Graph => ({
  ...graph,
  nodes: graph.nodes.map((existing) => (existing.id === node.id ? node : existing)),
});

describe('runs API', () => {
  it('starts a run and exposes its progress until it completes', async () => {
    const app = await setup();
    const created = await createRun(app, branchingGraph());
    expect(created.statusCode).toBe(202);
    const { runId } = created.json<{ runId: string }>();
    const run = await waitForStatus(app, runId, 'completed');
    expect(run.jobs['result-a']?.output).toMatchObject({ kind: 'image' });
    expect(run.summary).toMatchObject({ aiNodes: 2, generated: 2 });
  });

  it('rejects malformed bodies with schema issues', async () => {
    const response = await createRun(await setup(), { nodes: 'nope' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
  });

  it('rejects unrunnable graphs with per-node issues', async () => {
    const response = await createRun(await setup(), { nodes: [generateNode('gen')], edges: [] });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_GRAPH',
        message: 'The Prompt input needs a connection.',
        issues: [{ code: 'MISSING_INPUT', message: 'The Prompt input needs a connection.', nodeId: 'gen' }],
      },
    });
  });

  it('answers 404 for unknown runs', async () => {
    const response = await (await setup()).inject({ method: 'GET', url: '/api/runs/run_missing' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'RUN_NOT_FOUND' } });
  });

  it('retries a failed node and refuses to retry one that did not fail', async () => {
    const app = await setup();
    const graph = withNode(branchingGraph(), generateNode('gen-a', { seed: 1, modelId: 'mock-fails-first' }));
    const { runId } = (await createRun(app, graph)).json<{ runId: string }>();
    await waitForStatus(app, runId, 'failed');

    const retried = await app.inject({ method: 'POST', url: `/api/runs/${runId}/nodes/gen-a/retry` });
    expect(retried.statusCode).toBe(202);
    await waitForStatus(app, runId, 'completed');

    const again = await app.inject({ method: 'POST', url: `/api/runs/${runId}/nodes/gen-a/retry` });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: { code: 'NODE_NOT_FAILED' } });
    expect((await app.inject({ method: 'POST', url: '/api/runs/run_missing/nodes/x/retry' })).statusCode).toBe(404);
  });

  it('rate limits run creation per client', async () => {
    const app = await setup(1);
    expect((await createRun(app, branchingGraph())).statusCode).toBe(202);
    const limited = await createRun(app, branchingGraph());
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `pnpm test apps/server`
Expected: FAIL — cannot load `./routes.ts`.

- [ ] **Step 5: Implement the routes**

`apps/server/src/runs/routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createRunBodySchema, retryParamsSchema, runIdResponseSchema, runParamsSchema, runSchema } from '@trafaret/core';
import type { Engine } from '../engine/engine.ts';
import { AppError } from '../http/errors.ts';
import { validateRunGraph, type RunGraphContext } from './validate-run-graph.ts';

export type RunRoutesOptions = RunGraphContext & { engine: Engine; runsPer10Minutes: number };

const runNotFound = (): AppError =>
  new AppError(404, 'RUN_NOT_FOUND', 'This run no longer exists. Runs are kept for an hour after they finish.');

export function registerRunRoutes(app: FastifyInstance, options: RunRoutesOptions): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const rateLimit = { max: options.runsPer10Minutes, timeWindow: '10 minutes', groupId: 'runs' };

  routes.post(
    '/api/runs',
    {
      config: { rateLimit },
      schema: {
        summary: 'Start a workflow run',
        body: createRunBodySchema,
        response: { 202: runIdResponseSchema },
      },
    },
    (request, reply) => {
      const issues = validateRunGraph(request.body.graph, options);
      if (issues.length > 0) {
        const message = issues.length === 1 ? (issues[0]?.message ?? '') : `Fix ${issues.length} issues to run this workflow.`;
        throw new AppError(400, 'INVALID_GRAPH', message, issues);
      }
      return reply.code(202).send({ runId: options.engine.startRun(request.body.graph) });
    },
  );

  routes.get(
    '/api/runs/:runId',
    { schema: { summary: 'Poll a run', params: runParamsSchema, response: { 200: runSchema } } },
    (request) => {
      const run = options.engine.getRun(request.params.runId);
      if (!run) throw runNotFound();
      return run;
    },
  );

  routes.post(
    '/api/runs/:runId/nodes/:nodeId/retry',
    {
      config: { rateLimit },
      schema: { summary: 'Retry a failed node', params: retryParamsSchema, response: { 202: runIdResponseSchema } },
    },
    (request, reply) => {
      const outcome = options.engine.retryNode(request.params.runId, request.params.nodeId);
      if (outcome === 'run-not-found') throw runNotFound();
      if (outcome === 'node-not-failed') throw new AppError(409, 'NODE_NOT_FAILED', 'Only failed nodes can be retried.');
      return reply.code(202).send({ runId: request.params.runId });
    },
  );
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm test apps/server`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(server): add runs API with server-side validation, polling and retry"
```

---

### Task 21: Composition root, example workflow and API quickstart

**Files:**
- Create: `apps/server/src/services.ts`, `examples/branching.json`
- Modify: `apps/server/src/app.ts`, `apps/server/src/main.ts`, `README.md`
- Test: `apps/server/src/app.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `createServices(config: Config, logger: Logger, libraryDir?: string): Promise<Services>`, `type Services = { assets; presets; samples; catalog; engine }`, `ASSET_STORE_MAX_BYTES = 150 * 1024 * 1024`
  - `buildApp(config: Config, services: Services, logger: Logger, options?: { rateLimits?: { runsPer10Minutes: number; uploadsPer10Minutes: number } }): Promise<FastifyInstance>`

- [ ] **Step 1: Add the example workflow**

`examples/branching.json`:
```json
{
  "graph": {
    "nodes": [
      { "id": "prompt", "type": "prompt", "data": { "text": "A white sneaker on a stone pedestal" } },
      { "id": "gen-a", "type": "generateImage", "data": { "modelId": "mock", "presetId": "premium-3d", "aspectRatio": "1:1", "seed": 101 } },
      { "id": "gen-b", "type": "generateImage", "data": { "modelId": "mock", "presetId": "lifestyle", "aspectRatio": "1:1", "seed": 202 } },
      { "id": "result-a", "type": "result", "data": {} },
      { "id": "result-b", "type": "result", "data": {} }
    ],
    "edges": [
      { "id": "e1", "source": "prompt", "sourceHandle": "out", "target": "gen-a", "targetHandle": "prompt" },
      { "id": "e2", "source": "prompt", "sourceHandle": "out", "target": "gen-b", "targetHandle": "prompt" },
      { "id": "e3", "source": "gen-a", "sourceHandle": "out", "target": "result-a", "targetHandle": "image" },
      { "id": "e4", "source": "gen-b", "sourceHandle": "out", "target": "result-b", "targetHandle": "image" }
    ]
  }
}
```

- [ ] **Step 2: Write the failing integration test**

`apps/server/src/app.test.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogResponse, Run } from '@trafaret/core';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createServices } from './services.ts';

describe('app', () => {
  it('serves the whole API and runs the example workflow end to end', async () => {
    const config = loadConfig({ NODE_ENV: 'test', MOCK_LATENCY_MS: '0-5' });
    const logger = pino({ level: 'silent' });
    const app = await buildApp(config, await createServices(config, logger), logger);

    const catalog = (await app.inject({ method: 'GET', url: '/api/catalog' })).json<CatalogResponse>();
    expect(catalog.models.find((model) => model.default)?.id).toBe('mock');
    expect((await app.inject({ method: 'GET', url: '/api/presets' })).json()).toMatchObject({
      presets: expect.arrayContaining([expect.objectContaining({ id: 'premium-3d' })]),
    });
    expect((await app.inject({ method: 'GET', url: '/api/samples' })).json()).toMatchObject({
      samples: [expect.objectContaining({ id: 'sample-product' })],
    });

    const body: unknown = JSON.parse(await readFile(new URL('../../../examples/branching.json', import.meta.url), 'utf8'));
    const created = await app.inject({ method: 'POST', url: '/api/runs', payload: body as object });
    expect(created.statusCode).toBe(202);
    const { runId } = created.json<{ runId: string }>();

    let run: Run | undefined;
    await vi.waitFor(
      async () => {
        run = (await app.inject({ method: 'GET', url: `/api/runs/${runId}` })).json<Run>();
        expect(run.status).toBe('completed');
      },
      { timeout: 5_000 },
    );
    const output = run?.jobs['result-a']?.output;
    expect(output?.kind).toBe('image');
    const image = await app.inject({ method: 'GET', url: output?.kind === 'image' ? output.url : '/missing' });
    expect(image.statusCode).toBe(200);
    expect(image.headers['content-type']).toBe('image/webp');

    const docs = (await app.inject({ method: 'GET', url: '/api/docs/json' })).json<{ paths: Record<string, unknown> }>();
    expect(Object.keys(docs.paths)).toEqual(
      expect.arrayContaining(['/api/runs', '/api/runs/{runId}', '/api/runs/{runId}/nodes/{nodeId}/retry', '/api/assets']),
    );
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm test apps/server`
Expected: FAIL — cannot load `./services.ts`.

- [ ] **Step 4: Implement the composition root**

`apps/server/src/services.ts`:
```ts
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from 'pino';
import type { ProviderId } from '@trafaret/core';
import { AssetStore } from './assets/asset-store.ts';
import { ModelCatalog } from './catalog/catalog.ts';
import type { Config } from './config.ts';
import { DailyBudget } from './engine/daily-budget.ts';
import { Engine } from './engine/engine.ts';
import { ResultCache } from './engine/result-cache.ts';
import { Semaphore } from './lib/semaphore.ts';
import { PresetRepository } from './library/preset-repository.ts';
import { SampleRepository } from './library/sample-repository.ts';
import { createBytePlusProvider } from './providers/byteplus.ts';
import { createCloudflareProvider } from './providers/cloudflare.ts';
import { createMockProvider } from './providers/mock.ts';
import type { ImageProvider } from './providers/types.ts';
import { RunRepository } from './runs/run-repository.ts';

/** The demo host has 512 MB of RAM. */
export const ASSET_STORE_MAX_BYTES = 150 * 1024 * 1024;
const LIBRARY_DIR = fileURLToPath(new URL('../library', import.meta.url));

export type Services = Awaited<ReturnType<typeof createServices>>;

export async function createServices(config: Config, logger: Logger, libraryDir = LIBRARY_DIR) {
  const assets = new AssetStore({ maxBytes: ASSET_STORE_MAX_BYTES });
  const presets = await PresetRepository.load(join(libraryDir, 'presets'), assets);
  const samples = await SampleRepository.load(join(libraryDir, 'samples'), assets);
  const catalog = new ModelCatalog(config);

  const providers: Partial<Record<ProviderId, ImageProvider>> = {
    mock: createMockProvider({ latencyMs: config.mockLatencyMs }),
  };
  if (config.cloudflare) providers.cloudflare = createCloudflareProvider(config.cloudflare);
  if (config.byteplus) providers.byteplus = createBytePlusProvider(config.byteplus);

  const engine = new Engine({
    catalog,
    presets,
    assets,
    providers,
    cache: new ResultCache({ maxEntries: 500, isValid: (entry) => assets.has(entry.output.assetId) }),
    runs: new RunRepository({ maxRuns: 200, retentionMs: 60 * 60 * 1000 }),
    semaphore: new Semaphore(config.maxConcurrentJobs),
    budget: new DailyBudget({ cloudflare: config.dailyLimits.cloudflare, byteplus: config.dailyLimits.byteplus }),
    jobTimeoutMs: config.jobTimeoutMs,
    logger,
  });

  return { assets, presets, samples, catalog, engine };
}
```

`apps/server/src/app.ts` (replace the whole file):
```ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import { registerAssetRoutes } from './assets/routes.ts';
import { registerCatalogRoutes } from './catalog/routes.ts';
import type { Config } from './config.ts';
import { createHttpServer } from './http/server.ts';
import { registerLibraryRoutes } from './library/routes.ts';
import { registerRunRoutes } from './runs/routes.ts';
import type { Services } from './services.ts';

export type AppOptions = { rateLimits?: { runsPer10Minutes: number; uploadsPer10Minutes: number } };

/** Behind the demo host's edge, the visitor's address arrives in cf-connecting-ip. */
const clientKey = (request: FastifyRequest): string => {
  const header = request.headers['cf-connecting-ip'];
  return typeof header === 'string' && header !== '' ? header : request.ip;
};

export async function buildApp(
  config: Config,
  services: Services,
  logger: Logger,
  options: AppOptions = {},
): Promise<FastifyInstance> {
  const production = config.env === 'production';
  const app = await createHttpServer({
    logger,
    trustProxy: production,
    ...(production ? { rateLimitKey: clientKey } : {}),
  });
  const limits =
    options.rateLimits ??
    (production ? { runsPer10Minutes: 20, uploadsPer10Minutes: 30 } : { runsPer10Minutes: 1000, uploadsPer10Minutes: 1000 });

  registerAssetRoutes(app, { assets: services.assets, uploadsPer10Minutes: limits.uploadsPer10Minutes });
  registerLibraryRoutes(app, { presets: services.presets, samples: services.samples });
  registerCatalogRoutes(app, { catalog: services.catalog });
  registerRunRoutes(app, {
    engine: services.engine,
    catalog: services.catalog,
    presets: services.presets,
    assets: services.assets,
    runsPer10Minutes: limits.runsPer10Minutes,
  });
  return app;
}
```

`apps/server/src/main.ts` (replace the whole file):
```ts
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createLogger } from './lib/logger.ts';
import { createServices } from './services.ts';

const config = loadConfig(process.env);
const logger = createLogger({ level: config.logLevel });
const app = await buildApp(config, await createServices(config, logger), logger);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'shutting down');
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: config.host, port: config.port });
```

- [ ] **Step 5: Run the full suite**

Run: `pnpm test && pnpm typecheck && pnpm format && pnpm lint`
Expected: everything PASSES.

- [ ] **Step 6: Document the API quickstart**

`README.md` (replace the whole file; Phase 3 writes the final README):
````md
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
````

- [ ] **Step 7: Smoke-test the running server**

Run `pnpm dev`, then in another terminal:
```bash
RUN=$(curl -s -X POST localhost:8080/api/runs -H 'content-type: application/json' -d @examples/branching.json | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).runId))")
sleep 5
curl -s localhost:8080/api/runs/$RUN | node -e "process.stdin.on('data', d => { const r = JSON.parse(d); console.log(r.status, JSON.stringify(r.summary)) })"
curl -s -X POST localhost:8080/api/runs -H 'content-type: application/json' -d @examples/branching.json
```
Expected: the first run prints `completed {"aiNodes":2,"generated":2,...}`; posting the same workflow again returns a new `runId` whose snapshot shows `"reused":2` immediately. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(server): wire the composition root and document the API quickstart"
```

---

## After Phase 1

The API satisfies the brief's mandatory, UI-independent requirements (R6–R15). Next: write the Phase 2 plan (web
editor) against the contracts in `packages/core`, using superpowers:writing-plans.
