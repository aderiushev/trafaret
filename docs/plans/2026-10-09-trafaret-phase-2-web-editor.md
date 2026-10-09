# Trafaret — Phase 2: Web Editor Implementation Plan

**Goal:** The editor on top of the Phase 1 API: a React Flow canvas with typed wiring and five node cards, runs with live statuses, Retry and 🎲, a run timeline and an inspector, templates, export/import — covered by unit tests and three Playwright scenarios.

**Architecture:** `apps/web` is a Vite 8 single-page app (React 19 with the React Compiler) laid out in Feature-Sliced Design layers — `app → pages → widgets → features → entities → shared` — and linted by Steiger. A zustand + immer store, saved to `localStorage`, fully controls React Flow; TanStack Query holds server state, and exactly one component polls the active run. Node definitions, `canConnect`, `validateGraph` and the API schemas all come from `@trafaret/core`, so the canvas and the server can never disagree about a workflow. In development Vite proxies `/api` to the Fastify server.

**Tech Stack:** React 19.3 · Vite 8.3 · @vitejs/plugin-react 6 + React Compiler (babel-plugin-react-compiler 1.0 through @rolldown/plugin-babel) · @xyflow/react 12.12 · zustand 5 + immer 11 · TanStack Query 5 · ky 2 · nanoid 6 · CSS Modules · Fontsource · Vitest 5 + jsdom + Testing Library · Playwright 1.64 · Steiger 0.7

**Spec:** `docs/specs/2026-10-08-trafaret-design.md` — mainly §8 (frontend), §9 (testing) and §10 (tooling). The server it talks to was built by `docs/plans/2026-10-08-trafaret-phase-1-core-and-server.md`.

## Roadmap

| Phase | Plan | Deliverable |
|---|---|---|
| 1 (done) | Core + server | API that runs workflows end to end, fully tested |
| **2 (this plan)** | Web editor | FSD React app: canvas, typed wiring, run/poll, timeline, inspector, templates, Playwright e2e |
| 3 | Delivery | Dockerfile + SPA serving, CI, provider accounts + real preset images, Render demo, README, portfolio page |

## How this plan was made

Every file in this plan was built and run before the plan was written. In a scratch copy of the repository the complete Phase 2 passed `pnpm lint` (ESLint + Steiger + Prettier), `pnpm typecheck`, `pnpm test` (346 tests) and `pnpm e2e` (3 specs, five runs in a row), and the editor was exercised by hand against the server in mock mode. The plan was then replayed task by task on a fresh checkout of `main`: each task's gate passed on its own (245 → 257 → 267 → 283 → 297 → 319 → 321 → 329 → 331 → 340 → 342 → 346 tests) and the result was identical to the scratch copy. Type the code as it is written. If a step does not behave as the plan says, stop and report it instead of improvising a fix.

## Global Constraints

- Node runs the repository's TypeScript natively (type stripping, Node ≥ 22.18; `engines` asks for 24, which CI uses). pnpm `10.15.0`, TypeScript `~6.0.3`. pnpm prints an "Unsupported engine" warning on Node 22 — that is expected.
- Dependency ranges are exactly the ones in Task 2's `package.json` files (and `@playwright/test` `^1.64.0` in Task 13).
- Web code uses bundler module resolution: it imports through the `@/` alias, **without file extensions**, and imports a slice only through its `index.ts`. (`packages/core` and `apps/server` keep Node's explicit `.ts` imports.)
- Feature-Sliced Design: layers import downward only (`app → pages → widgets → features → entities → shared`), and slices of one layer never import each other — a higher layer composes them. `pnpm lint` runs Steiger; `fsd/insignificant-slice` is switched off because the app has a single page.
- The React Compiler is on: no hand-written `useMemo`, `useCallback` or `memo`. A zustand selector that builds a new array or object goes through `useShallow`.
- React Flow is fully controlled by the workflow store. `nodeTypes` is defined outside components. Controls inside a card carry the `nodrag` class (and `nowheel` on text areas).
- Exactly one component polls the active run: `useRunPolling`, called by the editor page. Every other reader uses `useActiveRun` / `useNodeJob`, which never send a request.
- HTTP: one ky client with the `/api` prefix and no automatic retries. Every call goes through `request()`, so a failure arrives as an `ApiError` whose message the UI shows as is. The retry POST has no body.
- Styling: CSS Modules and the design tokens of spec §8.7 as CSS custom properties (`app/styles/tokens.css`). No UI or CSS framework. Fonts are self-hosted through Fontsource.
- Accessibility: visible focus (`:focus-visible`), every control labelled (a `Field` caption or `aria-label`), icon-only buttons carry `aria-label`, `prefers-reduced-motion` is respected.
- Copy: English, terse, and it says how to recover. Never name the company or quote the brief in committed files.
- Tests sit next to their code (`*.test.ts(x)`) and run in jsdom. Playwright specs live in `e2e/` and run against their own mock-mode server.
- Conventional commits, at least one per task (`feat(web): …`, `test(e2e): …`, `docs: …`), straight on `main`.

**Spec deltas introduced by this plan** (Task 14 writes them into the spec):

1. The image-model entity is `entities/catalog` (named after `GET /api/catalog`): an entity called `model` would read `entities/model/model/` and clash with FSD's `model` segment. The `app` layer uses the `entrypoint/` and `styles/` segments.
2. Timeline rows are the Generate and Edit nodes only: Prompt, Image Input and Result finish in ~0 ms and would only add empty rows.
3. Uploads show a spinner rather than a percentage: `fetch` reports upload progress only over HTTP/2 with request streams.
4. Disabled models show their reason in the option text; other hints use the native `title` attribute, so there is no Tooltip component.
5. Wires take the colour of the port type they carry. Generate/Edit cards show a 72 px thumbnail of their output; the Result card shows it large.
6. An export is exactly the body of `POST /api/runs` (`{ "graph": … }`), so it can be posted with curl; import also accepts a bare graph.
7. The logotype uses Saira Stencil One. The Vite dev server listens on `127.0.0.1:5173`; `pnpm dev` starts it together with the API (`pnpm -r --parallel dev`).
8. The e2e run starts its own API (port 8090, provider keys blanked) and editor (port 5174) and never reuses a running dev server.

## File map

```
trafaret/
├─ package.json                 + dev/build/e2e scripts, Steiger in lint, React ESLint plugins, Playwright
├─ eslint.config.js             + React Hooks / React Refresh rules for apps/web
├─ tsconfig.json                + e2e/
├─ playwright.config.ts         e2e: starts its own mock-mode API and editor
├─ e2e/                         editor.ts (helpers) · branching / retry / incremental specs
├─ packages/core/src/           + isAspectRatio, isInputHandle, UPLOAD_LIMITS, testing: job(), runSnapshot()
├─ apps/server/src/             uses UPLOAD_LIMITS from core (no behaviour change)
└─ apps/web/
   ├─ package.json · tsconfig.json · vite.config.ts · vitest.setup.ts · steiger.config.js · index.html · public/favicon.svg
   └─ src/
      ├─ app/        entrypoint/ (main, App, Providers, query-client) · styles/ (tokens.css, global.css)
      ├─ pages/      editor/ (EditorPage)
      ├─ widgets/    workflow-canvas/ (canvas + node cards) · editor-toolbar/ · node-inspector/ · run-timeline/
      ├─ features/   add-node · connect-nodes · delete-selection · run-workflow · retry-node · regenerate-node ·
      │              upload-image · load-template · export-import
      ├─ entities/   workflow · catalog · preset · asset · run · node
      └─ shared/     api/ (ky client, ApiError) · ui/ (kit, toasts, error boundary) · lib/ (format, cx, useNow, download)
```

## Commands used throughout

- After a dependency change: `pnpm install`
- One web test file or folder: `pnpm exec vitest run --project @trafaret/web <path fragment>`
- Web typecheck and FSD lint: `pnpm --filter @trafaret/web typecheck` · `pnpm --filter @trafaret/web lint:fsd`
- Everything (the gate at the end of every task): `pnpm lint && pnpm typecheck && pnpm test`
- Format before committing: `pnpm format`
- The app: `pnpm dev` → editor at http://127.0.0.1:5173, API at http://127.0.0.1:8080

---

### Task 1: Core additions — type guards, upload limits, run fixtures

The editor needs two small type guards for values that come from `<select>` elements and React Flow, the upload limits the server enforces (so it can check a file before sending it), and run fixtures for its tests. Moving the limits into `core` also gives the server a single source for them.

**Files:**
- Modify: `packages/core/src/nodes.ts`, `packages/core/src/api.ts`, `packages/core/src/testing.ts`
- Modify: `apps/server/src/http/server.ts`, `apps/server/src/assets/routes.ts`, `apps/server/src/assets/routes.test.ts`
- Test: `packages/core/src/nodes.test.ts`

**Interfaces:**
- Produces, from `@trafaret/core`:
  - `isAspectRatio(value: unknown): value is AspectRatio`
  - `isInputHandle(value: unknown): value is InputHandle`
  - `UPLOAD_LIMITS = { maxBytes: 10 * 1024 * 1024, maxSide: 4096, mimeTypes: ['image/png', 'image/jpeg', 'image/webp'] } as const`
- Produces, from `@trafaret/core/testing`:
  - `job(nodeId: string, fields?: Partial<Job>): Job` — a successful Generate Image job that ran from t=1000 to t=2000
  - `runSnapshot(jobs: readonly Job[], fields?: Partial<Run>): Run` — a completed run from t=1000 to t=2000 holding `jobs`
- Removes: `MAX_UPLOAD_BYTES` (`apps/server/src/http/server.ts`) and `MAX_UPLOAD_SIDE` (`apps/server/src/assets/routes.ts`).

- [ ] **Step 1: Write the failing tests**

In `packages/core/src/nodes.test.ts`, replace the import line with:

```ts
import {
  AI_NODE_TYPES,
  MAX_SEED,
  NODE_DEFINITIONS,
  NODE_TYPES,
  isAiNodeType,
  isAspectRatio,
  isInputHandle,
  randomSeed,
} from './nodes.ts';
```

and append:

```ts
describe('type guards', () => {
  it('recognises input handles', () => {
    expect(isInputHandle('prompt')).toBe(true);
    expect(isInputHandle('image')).toBe(true);
    expect(isInputHandle('out')).toBe(false);
    expect(isInputHandle(null)).toBe(false);
  });

  it('recognises aspect ratios', () => {
    expect(isAspectRatio('16:9')).toBe(true);
    expect(isAspectRatio('2:1')).toBe(false);
    expect(isAspectRatio(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project @trafaret/core nodes`
Expected: FAIL — `isAspectRatio` / `isInputHandle` are not exported.

- [ ] **Step 3: Add the guards**

In `packages/core/src/nodes.ts`, directly below `export type AspectRatio = …`:

```ts
export const isAspectRatio = (value: unknown): value is AspectRatio =>
  ASPECT_RATIOS.some((ratio) => ratio === value);
```

and directly below `export type InputHandle = …`:

```ts
export const isInputHandle = (value: unknown): value is InputHandle =>
  INPUT_HANDLES.some((handle) => handle === value);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project @trafaret/core nodes`
Expected: PASS.

- [ ] **Step 5: Move the upload limits into core**

Append to `packages/core/src/api.ts`:

```ts
/** What POST /api/assets accepts. The editor checks the same limits before it uploads. */
export const UPLOAD_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxSide: 4096,
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
} as const;
```

In `apps/server/src/http/server.ts`: change `import type { Issue } from '@trafaret/core';` to `import { UPLOAD_LIMITS, type Issue } from '@trafaret/core';`, delete `export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;` (and the blank line after it), and register multipart with the shared limit:

```ts
  await app.register(multipart, { limits: { fileSize: UPLOAD_LIMITS.maxBytes, files: 1, parts: 5 } });
```

In `apps/server/src/assets/routes.ts`: import `UPLOAD_LIMITS` from `@trafaret/core` (the import becomes `import { assetParamsSchema, assetSchema, assetUrl, UPLOAD_LIMITS, type Asset } from '@trafaret/core';`), delete `export const MAX_UPLOAD_SIDE = 4096;`, and replace the size check with:

```ts
      const { maxSide } = UPLOAD_LIMITS;
      if (info.width > maxSide || info.height > maxSide) {
        throw new AppError(422, 'IMAGE_TOO_LARGE', `Images must be at most ${maxSide}×${maxSide} px.`);
      }
```

In `apps/server/src/assets/routes.test.ts`: import `createHttpServer` alone from `'../http/server.ts'`, add `import { UPLOAD_LIMITS } from '@trafaret/core';` after the `vitest` import, and use `Buffer.alloc(UPLOAD_LIMITS.maxBytes + 1)` in the "rejects files over 10 MB" test.

- [ ] **Step 6: Run the server's asset tests**

Run: `pnpm exec vitest run --project @trafaret/server assets`
Expected: PASS (same behaviour, one constant moved).

- [ ] **Step 7: Add the run fixtures**

In `packages/core/src/testing.ts`, add below the existing imports:

```ts
import { emptyRunSummary, type Job, type Run } from './run.ts';
```

and append:

```ts
/** A job in a run snapshot: a successful Generate Image job that ran from t=1000 to t=2000 unless told otherwise. */
export const job = (nodeId: string, fields: Partial<Job> = {}): Job => ({
  nodeId,
  nodeType: 'generateImage',
  status: 'success',
  attempt: 1,
  startedAt: 1_000,
  finishedAt: 2_000,
  cached: false,
  ...fields,
});

/** A run snapshot holding `jobs`: completed, from t=1000 to t=2000, unless told otherwise. */
export const runSnapshot = (jobs: readonly Job[], fields: Partial<Run> = {}): Run => ({
  id: 'run_test',
  status: 'completed',
  version: 1,
  createdAt: 0,
  startedAt: 1_000,
  finishedAt: 2_000,
  jobs: Object.fromEntries(jobs.map((item) => [item.nodeId, item])),
  summary: emptyRunSummary(),
  ...fields,
});
```

- [ ] **Step 8: Run the gate**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: all green, 245 tests.

- [ ] **Step 9: Commit**

```bash
git add packages/core apps/server
git commit -m "feat(core): share upload limits, type guards and run fixtures with the editor"
```

---

### Task 2: Editor scaffold, shared API client and helpers

A runnable Vite + React app in the FSD layout: tooling (Vite with the React Compiler, Vitest in jsdom, Steiger, the React ESLint rules), the app shell with design tokens and fonts, a placeholder editor page, the ky client that turns every failure into an `ApiError`, and small formatting helpers. `pnpm dev` now starts the API and the editor together.

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/vitest.setup.ts`, `apps/web/steiger.config.js`, `apps/web/index.html`, `apps/web/public/favicon.svg`
- Create: `apps/web/src/app/entrypoint/{main.tsx, App.tsx, Providers.tsx, query-client.ts}`, `apps/web/src/app/styles/{tokens.css, global.css}`
- Create: `apps/web/src/pages/editor/{index.ts, ui/EditorPage.tsx, ui/EditorPage.module.css}` (placeholder until Task 12)
- Create: `apps/web/src/shared/api/{http.ts, index.ts}`, `apps/web/src/shared/lib/{cx.ts, format.ts, use-now.ts, download.ts, index.ts}`
- Modify: `package.json`, `eslint.config.js`, `pnpm-lock.yaml`
- Test: `apps/web/src/shared/api/http.test.ts`, `apps/web/src/shared/lib/format.test.ts`

**Interfaces:**
- Produces, from `@/shared/api`:
  - `class ApiError extends Error { readonly status: number /* 0 = no response */; readonly code: string; readonly issues: readonly Issue[] }`
  - `http` — the ky instance (`prefix: '/api'`, `retry: 0`, `timeout: 30_000`)
  - `request<T>(call: Promise<T>): Promise<T>` — rethrows failures as `ApiError`, lets an `AbortError` through
  - `toApiError(error: unknown): ApiError`
- Produces, from `@/shared/lib`:
  - `cx(...classes: ReadonlyArray<string | false | null | undefined>): string`
  - `formatDuration(ms: number): string` (`"13.4 s"`, `"2 m 5 s"`), `formatSeconds(ms: number): string` (`"3 s"`)
  - `pluralize(count: number, singular: string, plural?: string): string`
  - `useNow(active: boolean, intervalMs = 250): number` — epoch ms, ticking only while `active`
  - `downloadJson(fileName: string, data: unknown): void`

- [ ] **Step 1: Create the web package**

`apps/web/package.json`:
```json
{
  "name": "@trafaret/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json",
    "lint:fsd": "steiger src"
  },
  "dependencies": {
    "@fontsource-variable/inter": "^5.3.0",
    "@fontsource-variable/jetbrains-mono": "^5.3.0",
    "@fontsource/saira-stencil-one": "^5.3.0",
    "@tanstack/react-query": "^5.104.1",
    "@trafaret/core": "workspace:*",
    "@xyflow/react": "^12.12.0",
    "immer": "^11.1.21",
    "ky": "^2.1.0",
    "nanoid": "^6.0.2",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "zustand": "^5.0.15"
  },
  "devDependencies": {
    "@babel/core": "^7.29.7",
    "@feature-sliced/steiger-plugin": "^0.8.0",
    "@rolldown/plugin-babel": "^0.2.4",
    "@testing-library/dom": "^10.4.2",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.7",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.2",
    "babel-plugin-react-compiler": "^1.0.0",
    "jsdom": "^30.1.2",
    "steiger": "^0.7.0",
    "vite": "^8.3.4"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "vite.config.ts", "vitest.setup.ts"]
}
```

`apps/web/vite.config.ts` — the React Compiler runs as a Babel preset next to the React plugin; `/api` is proxied to the server:
```ts
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The API server the dev proxy forwards /api to; the e2e run points it at its own server.
const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // The same loopback address as the API server, so the URL is the same everywhere.
  server: { host: '127.0.0.1', proxy: { '/api': apiOrigin } },
  // One editor screen: React, React Flow and zod ship as a single ~200 kB (gzip) bundle, which is fine here.
  build: { chunkSizeWarningLimit: 700 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

`apps/web/vitest.setup.ts` (no Vitest globals, so Testing Library's cleanup is registered here):
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});
```

`apps/web/steiger.config.js` (JavaScript: the plugin's types don't resolve cleanly for the type-aware lint):
```js
import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  // One page: every widget is placed once by the editor page, and most features live in a single widget.
  { rules: { 'fsd/insignificant-slice': 'off' } },
]);
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Trafaret — a node editor for reusable AI-image recipes." />
    <meta name="theme-color" content="#121214" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <title>Trafaret</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/entrypoint/main.tsx"></script>
  </body>
</html>
```

`apps/web/public/favicon.svg` — a stencil "T":
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#ff5f1f" />
  <path d="M7 7h18v5H7zM13.5 14h5v11h-5z" fill="#121214" />
</svg>
```

- [ ] **Step 2: Wire the web app into the root tooling**

Replace the root `package.json` with (Task 13 adds the e2e script later):

```json
{
  "name": "trafaret",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.15.0",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm --filter @trafaret/web build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json && pnpm -r typecheck",
    "lint": "eslint . && pnpm --filter @trafaret/web lint:fsd && prettier --check .",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/node": "^24.19.1",
    "eslint": "^10.12.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.7",
    "globals": "^17.13.0",
    "prettier": "^3.9.9",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.71.1",
    "vitest": "^5.0.3"
  }
}
```

Replace `eslint.config.js` with:
```js
// @ts-check
import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
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
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
);
```

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: done without errors (an "Unsupported engine" warning on Node 22 is fine).

- [ ] **Step 4: Create the app shell**

`apps/web/src/app/entrypoint/main.tsx` — fonts, React Flow's base styles, then the tokens and global styles:
```tsx
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/saira-stencil-one/latin-400.css';
import '@xyflow/react/dist/style.css';
import '../styles/tokens.css';
import '../styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('The page has no #root element.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`apps/web/src/app/entrypoint/App.tsx`:
```tsx
import { EditorPage } from '@/pages/editor';
import { Providers } from './Providers';

export function App() {
  return (
    <Providers>
      <EditorPage />
    </Providers>
  );
}
```

`apps/web/src/app/entrypoint/query-client.ts`:
```ts
import { QueryClient } from '@tanstack/react-query';

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: 1 },
      // A repeated POST could start a second paid run: mutations never retry by themselves.
      mutations: { retry: false },
    },
  });
```

`apps/web/src/app/entrypoint/Providers.tsx` (Task 3 adds the error boundary and toasts):

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from './query-client';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <ReactFlowProvider>{children}</ReactFlowProvider>
    </QueryClientProvider>
  );
}
```

`apps/web/src/app/styles/tokens.css` — spec §8.7 as custom properties:
```css
:root {
  --bg-canvas: #121214;
  --bg-surface: #1b1c1f;
  --bg-raised: #24252a;
  --border: #2e3035;
  --border-strong: #464951;
  --text: #ececef;
  --text-muted: #9a9ca5;
  --accent: #ff5f1f;
  --accent-hover: #ff7a45;
  --on-accent: #121214;
  --port-text: #f5c84c;
  --port-image: #4cb8ff;
  --success: #3ad69a;
  --error: #ff5a5f;
  --warning: #f5c84c;
  --radius-sm: 8px;
  --radius-md: 12px;
  --font-ui: 'Inter Variable', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;
  --font-logo: 'Saira Stencil One', var(--font-ui);
}
```

`apps/web/src/app/styles/global.css`:
```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  background: var(--bg-canvas);
  color: var(--text);
  font: 14px/1.45 var(--font-ui);
  color-scheme: dark;
  -webkit-font-smoothing: antialiased;
}

button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}

img {
  display: block;
  max-width: 100%;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* React Flow, in Trafaret's colours. */
.react-flow {
  --xy-background-color: var(--bg-canvas);
  --xy-background-pattern-color: var(--border);
  --xy-edge-stroke: var(--border-strong);
  --xy-edge-stroke-selected: var(--accent);
  --xy-edge-stroke-width: 2;
  --xy-connectionline-stroke: var(--accent);
  --xy-connectionline-stroke-width: 2;
  --xy-controls-button-background-color: var(--bg-surface);
  --xy-controls-button-background-color-hover: var(--bg-raised);
  --xy-controls-button-color: var(--text);
  --xy-controls-button-border-color: var(--border);
  --xy-minimap-background-color: var(--bg-surface);
  --xy-minimap-node-background-color: var(--border-strong);
  --xy-minimap-mask-background-color: rgb(18 18 20 / 70%);
  --xy-attribution-background-color: transparent;
}
```

`apps/web/src/pages/editor/ui/EditorPage.tsx` (a placeholder; Task 12 replaces it):

```tsx
import styles from './EditorPage.module.css';

export function EditorPage() {
  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <h1 className={styles.logo}>Trafaret</h1>
      </header>
      <main className={styles.main} />
    </div>
  );
}
```

`apps/web/src/pages/editor/ui/EditorPage.module.css` (placeholder; Task 12 replaces it):

```css
.page {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
}

.logo {
  margin: 0;
  font: 400 22px/1 var(--font-logo);
  letter-spacing: 0.04em;
  color: var(--accent);
}

.main {
  min-height: 0;
}
```

`apps/web/src/pages/editor/index.ts`:
```ts
export { EditorPage } from './ui/EditorPage';
```

- [ ] **Step 5: Write the failing tests**

`apps/web/src/shared/lib/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatDuration, formatSeconds, pluralize } from './format';

describe('format', () => {
  it('shows durations under a minute with one decimal', () => {
    expect(formatDuration(0)).toBe('0.0 s');
    expect(formatDuration(400)).toBe('0.4 s');
    expect(formatDuration(13_449)).toBe('13.4 s');
  });

  it('shows longer durations in minutes and seconds', () => {
    expect(formatDuration(125_000)).toBe('2 m 5 s');
  });

  it('never shows a negative duration', () => {
    expect(formatDuration(-20)).toBe('0.0 s');
    expect(formatSeconds(-20)).toBe('0 s');
  });

  it('counts whole seconds for live counters', () => {
    expect(formatSeconds(3_999)).toBe('3 s');
  });

  it('pluralizes', () => {
    expect(pluralize(1, 'issue')).toBe('1 issue');
    expect(pluralize(3, 'issue')).toBe('3 issues');
    expect(pluralize(2, 'AI call')).toBe('2 AI calls');
  });
});
```

`apps/web/src/shared/api/http.test.ts` — real ky errors from a stubbed `fetch`:
```ts
import ky from 'ky';
import { describe, expect, it } from 'vitest';
import { catalogResponseSchema } from '@trafaret/core';
import { ApiError, request } from './http';

const server = (respond: () => Response | Promise<Response>, timeout = 1000) =>
  ky.create({ prefix: 'http://api.test/api', retry: 0, timeout, fetch: async () => respond() });

async function failureOf(call: Promise<unknown>): Promise<ApiError> {
  try {
    await request(call);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the call to fail');
}

describe('request', () => {
  it('returns the response of a successful call', async () => {
    const body = await request(
      server(() => Response.json({ models: [] }))
        .get('catalog')
        .json(),
    );
    expect(body).toEqual({ models: [] });
  });

  it('carries the code, message and issues of the error envelope', async () => {
    const issues = [{ code: 'MISSING_VALUE', message: 'Write a prompt.', nodeId: 'p1' }];
    const envelope = { error: { code: 'INVALID_GRAPH', message: 'Write a prompt.', issues } };
    const error = await failureOf(
      server(() => Response.json(envelope, { status: 400 }))
        .post('runs')
        .json(),
    );
    expect(error).toMatchObject({ status: 400, code: 'INVALID_GRAPH', message: 'Write a prompt.' });
    expect(error.issues).toEqual(issues);
  });

  it('explains a server error without an envelope', async () => {
    const page = () => new Response('<html>Service unavailable</html>', { status: 503 });
    const error = await failureOf(server(page).get('catalog').json());
    expect(error).toMatchObject({
      status: 503,
      code: 'HTTP_ERROR',
      message: 'The server is unavailable. Try again in a moment.',
    });
  });

  it('reports an unreachable server', async () => {
    const unreachable = () => Promise.reject(new TypeError('Failed to fetch'));
    const error = await failureOf(server(unreachable).get('catalog').json());
    expect(error).toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('reports a server that does not answer in time', async () => {
    const silent = () => new Promise<Response>(() => undefined);
    const error = await failureOf(server(silent, 20).get('catalog').json());
    expect(error).toMatchObject({ status: 0, code: 'TIMEOUT' });
  });

  it('reports a response that does not match its schema', async () => {
    const call = server(() => Response.json({ models: 'none' }))
      .get('catalog')
      .json(catalogResponseSchema);
    expect(await failureOf(call)).toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('lets a cancelled call through as it is', async () => {
    const controller = new AbortController();
    // Like fetch: never answers, and rejects with the signal's reason once the call is aborted.
    const hanging = (input: string | URL | Request) =>
      new Promise<Response>((_, reject) => {
        if (!(input instanceof Request)) return;
        const abort = () => reject(input.signal.reason as Error);
        if (input.signal.aborted) abort();
        else input.signal.addEventListener('abort', abort);
      });
    const client = ky.create({ prefix: 'http://api.test/api', retry: 0, fetch: hanging });
    const call = request(client.get('catalog', { signal: controller.signal }).json());
    controller.abort();
    await expect(call).rejects.toMatchObject({ name: 'AbortError' });
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project @trafaret/web shared`
Expected: FAIL — `./format` and `./http` don't exist yet.

- [ ] **Step 7: Implement the helpers and the client**

`apps/web/src/shared/lib/cx.ts`:
```ts
/** Joins class names, skipping falsy ones. */
export const cx = (...classes: ReadonlyArray<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');
```

`apps/web/src/shared/lib/format.ts`:
```ts
/** 400 → "0.4 s", 13 400 → "13.4 s", 125 000 → "2 m 5 s". */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 60_000) return `${(safe / 1000).toFixed(1)} s`;
  const totalSeconds = Math.round(safe / 1000);
  return `${Math.floor(totalSeconds / 60)} m ${totalSeconds % 60} s`;
}

/** Whole seconds, for a live counter: 3 400 → "3 s". */
export const formatSeconds = (ms: number): string => `${Math.floor(Math.max(0, ms) / 1000)} s`;

/** pluralize(1, 'issue') → "1 issue"; pluralize(2, 'issue') → "2 issues". */
export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`;
```

`apps/web/src/shared/lib/use-now.ts`:
```ts
import { useEffect, useState } from 'react';

/** The current time in epoch ms, refreshed every `intervalMs` while `active`. */
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}
```

`apps/web/src/shared/lib/download.ts`:
```ts
/** Saves `data` as a pretty-printed JSON file through the browser's download flow. */
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}
```

`apps/web/src/shared/lib/index.ts`:
```ts
export { cx } from './cx';
export { downloadJson } from './download';
export { formatDuration, formatSeconds, pluralize } from './format';
export { useNow } from './use-now';
```

`apps/web/src/shared/api/http.ts`:
```ts
import ky, { isHTTPError, isNetworkError, isTimeoutError, SchemaValidationError } from 'ky';
import { errorEnvelopeSchema, type Issue } from '@trafaret/core';

/** A failed API call, with a message the UI can show as it is. */
export class ApiError extends Error {
  /** 0 when no HTTP response arrived. */
  readonly status: number;
  readonly code: string;
  readonly issues: readonly Issue[];

  constructor(status: number, code: string, message: string, issues: readonly Issue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

/** Paths are relative to /api. No automatic retries: a repeated POST could start a second paid run. */
export const http = ky.create({ prefix: '/api', retry: 0, timeout: 30_000 });

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isHTTPError(error)) {
    const { status } = error.response;
    const envelope = errorEnvelopeSchema.safeParse(error.data);
    if (envelope.success) {
      const { code, message, issues = [] } = envelope.data.error;
      return new ApiError(status, code, message, issues);
    }
    return status >= 500
      ? new ApiError(status, 'HTTP_ERROR', 'The server is unavailable. Try again in a moment.')
      : new ApiError(status, 'HTTP_ERROR', `The server refused the request (${status}).`);
  }
  if (isTimeoutError(error)) {
    return new ApiError(0, 'TIMEOUT', 'The server took too long to answer. Try again.');
  }
  if (isNetworkError(error)) {
    return new ApiError(0, 'NETWORK', "Can't reach the server. Check your connection and try again.");
  }
  if (error instanceof SchemaValidationError) {
    return new ApiError(0, 'BAD_RESPONSE', 'The server sent an unexpected response.');
  }
  return new ApiError(0, 'UNKNOWN', 'Something went wrong. Try again.');
}

// Checked by name: the DOMException class can differ between the fetch implementation and the page.
const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

/** Awaits one API call and rethrows its failure as an ApiError. A cancelled call passes through untouched. */
export async function request<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (error) {
    throw isAbortError(error) ? error : toApiError(error);
  }
}
```

`apps/web/src/shared/api/index.ts`:
```ts
export { ApiError, http, request, toApiError } from './http';
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project @trafaret/web shared`
Expected: PASS (12 tests).

- [ ] **Step 9: Run the gate and build**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: Steiger prints "No problems found!"; all tests pass; `vite build` writes `apps/web/dist`.

- [ ] **Step 10: Smoke-test the dev setup**

Run `pnpm dev` and, in a second terminal, `curl -s http://127.0.0.1:5173/api/health`.
Expected: `{"ok":true}` — the request went through Vite's proxy to the server. http://127.0.0.1:5173 shows the orange stencil logotype on a dark page. Stop `pnpm dev`.

- [ ] **Step 11: Commit**

```bash
git add package.json pnpm-lock.yaml eslint.config.js apps/web
git commit -m "feat(web): scaffold the editor app with the shared API client"
```

---

### Task 3: Shared UI kit

The few generic pieces every layer above uses: buttons, form controls, badges, a spinner, a panel, a dropzone, toasts and an error boundary. All are thin wrappers over native elements with CSS Modules — no component library.

**Files:**
- Create: `apps/web/src/shared/ui/{button,select,textarea,field,badge,spinner,panel,dropzone,toast,error-boundary}/…` (component + CSS module each) and `apps/web/src/shared/ui/index.ts`
- Modify: `apps/web/src/app/entrypoint/Providers.tsx`
- Test: `apps/web/src/shared/ui/button/Button.test.tsx`, `dropzone/Dropzone.test.tsx`, `toast/Toaster.test.tsx`, `error-boundary/ErrorBoundary.test.tsx`

**Interfaces:**
- Consumes: `cx` from `@/shared/lib`.
- Produces, from `@/shared/ui`:
  - `Button(props: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md' })` — `type="button"` by default
  - `Select(props: ComponentProps<'select'>)`, `Textarea(props: ComponentProps<'textarea'>)`
  - `Field({ label, children })` — a caption above one control; the wrapping `<label>` names it
  - `Badge({ tone?: 'neutral' | 'accent' | 'success' | 'error' | 'warning'; title?; children })`
  - `Spinner({ label?: string; size?: 'sm' | 'md' })` — a status with a label, decoration without
  - `Panel({ title, actions?, className?, children })` — a `<section>` named by its title
  - `Dropzone({ label, accept, onFile: (file: File) => void, disabled?, children })`
  - `toast.info(title: string, details?: readonly string[])`, `toast.error(title, details?)`, `Toaster`
  - `ErrorBoundary({ children })`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/shared/ui/button/Button.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('is a plain button unless told otherwise, so it never submits a form by accident', () => {
    render(<Button>Run</Button>);
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAttribute('type', 'button');
  });

  it('ignores clicks while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Run
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

`apps/web/src/shared/ui/dropzone/Dropzone.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dropzone } from './Dropzone';

const photo = () => new File(['png'], 'photo.png', { type: 'image/png' });

function renderDropzone(disabled = false) {
  const onFile = vi.fn();
  render(
    <Dropzone label="Upload image" accept="image/png" onFile={onFile} disabled={disabled}>
      Drop an image
    </Dropzone>,
  );
  return onFile;
}

describe('Dropzone', () => {
  it('hands over a chosen file', async () => {
    const onFile = renderDropzone();
    const file = photo();
    await userEvent.upload(screen.getByLabelText('Upload image'), file);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('hands over a dropped file', () => {
    const onFile = renderDropzone();
    const file = photo();
    fireEvent.drop(screen.getByText('Drop an image'), { dataTransfer: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('ignores drops while disabled', () => {
    const onFile = renderDropzone(true);
    fireEvent.drop(screen.getByText('Drop an image'), { dataTransfer: { files: [photo()] } });
    expect(onFile).not.toHaveBeenCalled();
  });
});
```

`apps/web/src/shared/ui/toast/Toaster.test.tsx`:
```tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from './Toaster';
import { toast, useToastStore } from './toast-store';

afterEach(() => {
  vi.useRealTimers();
  useToastStore.setState({ toasts: [] });
});

describe('Toaster', () => {
  it('announces an error with its details', () => {
    render(<Toaster />);
    act(() => toast.error('Fix 2 issues to run.', ['Add a Generate Image node.']));
    expect(screen.getByRole('alert')).toHaveTextContent('Fix 2 issues to run.');
    expect(screen.getByRole('alert')).toHaveTextContent('Add a Generate Image node.');
  });

  it('can be dismissed', async () => {
    render(<Toaster />);
    act(() => toast.info('Workflow imported.'));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('goes away by itself', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => toast.info('Workflow imported.'));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps at most three on screen', () => {
    render(<Toaster />);
    act(() => ['one', 'two', 'three', 'four'].forEach((title) => toast.info(title)));
    expect(screen.getAllByRole('status').map((element) => element.textContent)).toEqual([
      'two×',
      'three×',
      'four×',
    ]);
  });
});
```

`apps/web/src/shared/ui/error-boundary/ErrorBoundary.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Broken(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('shows a way back instead of a blank page', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke.');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project @trafaret/web shared/ui`
Expected: FAIL — the components don't exist yet.

- [ ] **Step 3: Implement the controls**

`apps/web/src/shared/ui/button/Button.tsx`:
```tsx
import type { ComponentProps } from 'react';
import { cx } from '@/shared/lib';
import styles from './Button.module.css';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
};

export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cx(styles.button, styles[variant], styles[size], className)} {...props} />
  );
}
```

`apps/web/src/shared/ui/button/Button.module.css`:
```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease;
}

.button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.button kbd {
  font: 500 11px/1 var(--font-mono);
  opacity: 0.7;
}

.md {
  height: 34px;
  padding: 0 14px;
}

.sm {
  height: 28px;
  padding: 0 10px;
  font-size: 13px;
}

.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
  font-weight: 600;
}

.primary:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.secondary {
  background: var(--bg-raised);
  border-color: var(--border);
  color: var(--text);
}

.secondary:hover:not(:disabled) {
  border-color: var(--border-strong);
}

.ghost {
  background: transparent;
  color: var(--text);
}

.ghost:hover:not(:disabled) {
  background: var(--bg-raised);
}
```

`apps/web/src/shared/ui/select/Select.tsx`:
```tsx
import type { ComponentProps } from 'react';
import { cx } from '@/shared/lib';
import styles from './Select.module.css';

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cx(styles.select, className)} {...props} />;
}
```

`apps/web/src/shared/ui/select/Select.module.css`:
```css
.select {
  width: 100%;
  height: 30px;
  padding: 0 28px 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-canvas)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%239a9ca5' stroke-width='1.5'/%3E%3C/svg%3E")
    no-repeat right 10px center / 10px 6px;
  appearance: none;
  font-size: 13px;
  cursor: pointer;
}

.select:hover:not(:disabled) {
  border-color: var(--border-strong);
}

.select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.select option {
  background: var(--bg-surface);
}
```

`apps/web/src/shared/ui/textarea/Textarea.tsx`:
```tsx
import type { ComponentProps } from 'react';
import { cx } from '@/shared/lib';
import styles from './Textarea.module.css';

/** Grows with its content where the browser supports it (field-sizing), and can be resized everywhere. */
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cx(styles.textarea, className)} {...props} />;
}
```

`apps/web/src/shared/ui/textarea/Textarea.module.css`:
```css
.textarea {
  width: 100%;
  min-height: 64px;
  max-height: 220px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-canvas);
  font-size: 13px;
  line-height: 1.45;
  resize: vertical;
  field-sizing: content;
}

.textarea::placeholder {
  color: var(--text-muted);
}

.textarea:hover:not(:disabled) {
  border-color: var(--border-strong);
}

.textarea:disabled {
  opacity: 0.55;
}
```

`apps/web/src/shared/ui/field/Field.tsx`:
```tsx
import type { ReactNode } from 'react';
import styles from './Field.module.css';

/** A caption above one form control; the wrapping label gives the control its accessible name. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
}
```

`apps/web/src/shared/ui/field/Field.module.css`:
```css
.field {
  display: grid;
  gap: 4px;
}

.label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}
```

`apps/web/src/shared/ui/badge/Badge.tsx`:
```tsx
import type { ReactNode } from 'react';
import { cx } from '@/shared/lib';
import styles from './Badge.module.css';

type BadgeProps = {
  tone?: 'neutral' | 'accent' | 'success' | 'error' | 'warning';
  title?: string;
  children: ReactNode;
};

export function Badge({ tone = 'neutral', title, children }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone])} title={title}>
      {children}
    </span>
  );
}
```

`apps/web/src/shared/ui/badge/Badge.module.css`:
```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  font: 600 11px/1 var(--font-ui);
  white-space: nowrap;
}

.neutral {
  background: var(--bg-raised);
  color: var(--text-muted);
}

.accent {
  background: rgb(255 95 31 / 16%);
  color: var(--accent);
}

.success {
  background: rgb(58 214 154 / 14%);
  color: var(--success);
}

.error {
  background: rgb(255 90 95 / 14%);
  color: var(--error);
}

.warning {
  background: rgb(245 200 76 / 14%);
  color: var(--warning);
}
```

`apps/web/src/shared/ui/spinner/Spinner.tsx`:
```tsx
import { cx } from '@/shared/lib';
import styles from './Spinner.module.css';

type SpinnerProps = { label?: string; size?: 'sm' | 'md' };

/** With a label it announces itself as a status; without one it is decoration. */
export function Spinner({ label, size = 'md' }: SpinnerProps) {
  const className = cx(styles.spinner, styles[size]);
  return label ? (
    <span role="status" aria-label={label} className={className} />
  ) : (
    <span aria-hidden="true" className={className} />
  );
}
```

`apps/web/src/shared/ui/spinner/Spinner.module.css`:
```css
.spinner {
  display: inline-block;
  flex: none;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.md {
  width: 16px;
  height: 16px;
}

.sm {
  width: 12px;
  height: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

`apps/web/src/shared/ui/panel/Panel.tsx`:
```tsx
import type { ReactNode } from 'react';
import { cx } from '@/shared/lib';
import styles from './Panel.module.css';

type PanelProps = { title: string; actions?: ReactNode; className?: string; children: ReactNode };

export function Panel({ title, actions, className, children }: PanelProps) {
  return (
    <section className={cx(styles.panel, className)} aria-label={title}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {actions}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
```

`apps/web/src/shared/ui/panel/Panel.module.css`:
```css
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
}

.title {
  flex: 1;
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.body {
  padding: 16px;
  overflow-y: auto;
}
```

`apps/web/src/shared/ui/dropzone/Dropzone.tsx`:
```tsx
import { useState, type ReactNode } from 'react';
import { cx } from '@/shared/lib';
import styles from './Dropzone.module.css';

type DropzoneProps = {
  /** Accessible name of the file input, e.g. "Upload image". */
  label: string;
  accept: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  children: ReactNode;
};

/** Click (or press Enter on the focused input) to pick a file, or drop one onto the area. */
export function Dropzone({ label, accept, onFile, disabled = false, children }: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      className={cx(styles.dropzone, dragging && styles.dragging, disabled && styles.disabled)}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file && !disabled) onFile(file);
      }}
    >
      <input
        type="file"
        aria-label={label}
        accept={accept}
        disabled={disabled}
        className={styles.input}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = ''; // so choosing the same file again still fires a change
          if (file) onFile(file);
        }}
      />
      {children}
    </label>
  );
}
```

`apps/web/src/shared/ui/dropzone/Dropzone.module.css`:
```css
.dropzone {
  position: relative;
  display: grid;
  place-items: center;
  gap: 6px;
  min-height: 120px;
  padding: 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--bg-canvas);
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
  cursor: pointer;
  overflow: hidden;
}

.dropzone:hover,
.dragging {
  border-color: var(--port-image);
  color: var(--text);
}

.dropzone:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.disabled {
  cursor: progress;
}

.input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
```

- [ ] **Step 4: Implement toasts and the error boundary**

`apps/web/src/shared/ui/toast/toast-store.ts`:
```ts
import { create } from 'zustand';

export type ToastTone = 'info' | 'error';
export type Toast = { id: number; tone: ToastTone; title: string; details: readonly string[] };

type ToastState = {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
};

/** At most three toasts stay on screen; a fourth pushes the oldest out. */
const MAX_TOASTS = 3;
let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (toast) =>
    set((state) => ({ toasts: [...state.toasts.slice(1 - MAX_TOASTS), { ...toast, id: nextId++ }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

/** Shows a short message; works from anywhere, components or not. */
export const toast = {
  info: (title: string, details: readonly string[] = []): void =>
    useToastStore.getState().push({ tone: 'info', title, details }),
  error: (title: string, details: readonly string[] = []): void =>
    useToastStore.getState().push({ tone: 'error', title, details }),
};
```

`apps/web/src/shared/ui/toast/Toaster.tsx`:
```tsx
import { useEffect } from 'react';
import { cx } from '@/shared/lib';
import { useToastStore, type Toast } from './toast-store';
import styles from './Toaster.module.css';

const VISIBLE_MS = 6000;

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  return (
    <div className={styles.region}>
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastMessage({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [dismiss, toast.id]);
  return (
    <div role={toast.tone === 'error' ? 'alert' : 'status'} className={cx(styles.toast, styles[toast.tone])}>
      <div className={styles.text}>
        <p className={styles.title}>{toast.title}</p>
        {toast.details.length > 0 && (
          <ul className={styles.details}>
            {toast.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" className={styles.close} aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
        ×
      </button>
    </div>
  );
}
```

`apps/web/src/shared/ui/toast/Toaster.module.css`:
```css
.region {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 10;
  display: grid;
  gap: 8px;
  width: min(380px, calc(100vw - 32px));
}

.toast {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-left-width: 3px;
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  box-shadow: 0 8px 24px rgb(0 0 0 / 40%);
}

.info {
  border-left-color: var(--port-image);
}

.error {
  border-left-color: var(--error);
}

.text {
  flex: 1;
}

.title {
  margin: 0;
  font-weight: 600;
}

.details {
  margin: 6px 0 0;
  padding-left: 18px;
  color: var(--text-muted);
}

.close {
  align-self: flex-start;
  border: 0;
  background: none;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
```

`apps/web/src/shared/ui/error-boundary/ErrorBoundary.tsx` (a class: React still has no hook for error boundaries):
```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

type ErrorBoundaryState = { failed: boolean };

/** Replaces a crashed screen with a way back; the workflow itself is safe in local storage. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className={styles.fallback}>
        <h1 className={styles.title}>Something broke.</h1>
        <p>Your workflow is saved in this browser. Reload the page to pick it up again.</p>
        <button type="button" className={styles.reload} onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
```

`apps/web/src/shared/ui/error-boundary/ErrorBoundary.module.css`:
```css
.fallback {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  height: 100%;
  padding: 24px;
  text-align: center;
}

.title {
  margin: 0;
  font: 400 32px/1 var(--font-logo);
  color: var(--accent);
}

.reload {
  height: 34px;
  padding: 0 16px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 600;
  cursor: pointer;
}
```

`apps/web/src/shared/ui/index.ts`:
```ts
export { Badge } from './badge/Badge';
export { Button } from './button/Button';
export { Dropzone } from './dropzone/Dropzone';
export { ErrorBoundary } from './error-boundary/ErrorBoundary';
export { Field } from './field/Field';
export { Panel } from './panel/Panel';
export { Select } from './select/Select';
export { Spinner } from './spinner/Spinner';
export { Textarea } from './textarea/Textarea';
export { toast } from './toast/toast-store';
export { Toaster } from './toast/Toaster';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project @trafaret/web shared/ui`
Expected: PASS (10 tests).

- [ ] **Step 6: Host the toasts and the error boundary in the app**

Replace `apps/web/src/app/entrypoint/Providers.tsx` with:
```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import { useState, type ReactNode } from 'react';
import { ErrorBoundary, Toaster } from '@/shared/ui';
import { createQueryClient } from './query-client';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ReactFlowProvider>{children}</ReactFlowProvider>
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 7: Run the gate**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): add the shared UI kit"
```

---

### Task 4: Workflow entity — the graph store

The canvas state: React Flow nodes and edges in a zustand + immer store that React Flow is fully controlled by. Only the graph part is saved to `localStorage` — in exactly the shape the API takes — so the "store ↔ graph" mapping is the heart of this task. The store also keeps the issues from the last attempt to run, pruning a node's issues once it is edited, rewired or removed, and flags a first visit so the editor can place a starter workflow.

**Files:**
- Create: `apps/web/src/entities/workflow/model/{types.ts, store.ts, hooks.ts}`, `apps/web/src/entities/workflow/lib/{auto-layout.ts, graph-mapping.ts, create-node.ts}`, `apps/web/src/entities/workflow/index.ts`
- Test: `apps/web/src/entities/workflow/lib/{auto-layout,graph-mapping,create-node}.test.ts`, `apps/web/src/entities/workflow/model/store.test.ts`

**Interfaces:**
- Consumes: `Graph`, `GraphNode`, `GraphNodeOf`, `Issue`, `NodeType`, `InputHandle`, `graphSchema`, `isInputHandle`, `indexGraph`, `topologicalOrder`, `randomSeed` from `@trafaret/core`.
- Produces, from `@/entities/workflow`:
  - types `NodeDataOf<T extends NodeType>`, `FlowNodeOf<T> = Node<NodeDataOf<T>, T> & { type: T }`, `FlowNode` (union over node types), `FlowEdge = Edge`
  - `toGraph(nodes: readonly FlowNode[], edges: readonly FlowEdge[]): Graph`, `fromGraph(graph: Graph): { nodes: FlowNode[]; edges: FlowEdge[] }` (lays out nodes without a position)
  - `createNode(type: NodeType, position: XYPosition, modelId: string): FlowNode` — fresh nanoid and seed
  - `useWorkflowStore` — state `{ nodes, edges, issues: Issue[], needsStarter: boolean }`; actions `onNodesChange(changes)`, `onEdgesChange(changes)`, `connect(connection)`, `addNode(node)` (selects it), `updateNodeData<T>(id, type: T, patch: Partial<NodeDataOf<T>>)` (ignored when the type differs), `replaceGraph(graph)`, `clearSelection()`, `setIssues(issues)`
  - `getWorkflowGraph(): Graph` (a one-off read), `useWorkflowNode(id: string | null)`, `useSelectedNodeIds(): string[]`, `useNodeIssues(nodeId): Issue[]`, `useUpstreamNodeId(nodeId, handle: InputHandle): string | null`
- Saved as `localStorage['trafaret:graph:v1'] = { state: { graph }, version: 0 }`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/entities/workflow/lib/auto-layout.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { branchingGraph } from '@trafaret/core/testing';
import { layoutByDepth } from './auto-layout';

describe('layoutByDepth', () => {
  it('puts each node one column right of its inputs, stacking siblings', () => {
    const positions = layoutByDepth(branchingGraph());
    expect(positions.get('prompt')).toEqual({ x: 0, y: 0 });
    expect(positions.get('gen-a')).toEqual({ x: 340, y: 0 });
    expect(positions.get('gen-b')).toEqual({ x: 340, y: 260 });
    expect(positions.get('result-a')).toEqual({ x: 680, y: 0 });
    expect(positions.get('result-b')).toEqual({ x: 680, y: 260 });
  });
});
```

`apps/web/src/entities/workflow/lib/graph-mapping.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Graph } from '@trafaret/core';
import { branchingGraph } from '@trafaret/core/testing';
import { fromGraph, toGraph } from './graph-mapping';

const positioned = (): Graph => {
  const graph = branchingGraph();
  return { ...graph, nodes: graph.nodes.map((node, i) => ({ ...node, position: { x: i * 100, y: 50 } })) };
};

describe('graph mapping', () => {
  it('round-trips a graph unchanged', () => {
    const graph = positioned();
    const { nodes, edges } = fromGraph(graph);
    expect(toGraph(nodes, edges)).toEqual(graph);
  });

  it("leaves React Flow's own state out of the graph", () => {
    const { nodes, edges } = fromGraph(positioned());
    const [first, ...rest] = nodes;
    const busyNode = { ...first!, selected: true, dragging: true, measured: { width: 260, height: 180 } };
    const graph = toGraph([busyNode, ...rest], [{ ...edges[0]!, selected: true, animated: true }]);
    expect(graph.nodes[0]).toEqual({
      id: 'prompt',
      type: 'prompt',
      data: first!.data,
      position: { x: 0, y: 50 },
    });
    expect(graph.edges[0]).toEqual(positioned().edges[0]);
  });

  it('lays out a graph that has no positions', () => {
    const { nodes } = fromGraph(branchingGraph());
    expect(nodes.find((node) => node.id === 'gen-b')?.position).toEqual({ x: 340, y: 260 });
  });
});
```

`apps/web/src/entities/workflow/lib/create-node.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { graphNodeSchema, NODE_TYPES } from '@trafaret/core';
import { createNode } from './create-node';

describe('createNode', () => {
  it('creates every node type with data the API accepts', () => {
    for (const type of NODE_TYPES) {
      const { id, data, position } = createNode(type, { x: 10, y: 20 }, 'mock');
      expect(graphNodeSchema.safeParse({ id, type, data, position }).success).toBe(true);
    }
  });

  it('gives Generate and Edit nodes the model and a random seed', () => {
    const node = createNode('generateImage', { x: 0, y: 0 }, 'flux-2-klein');
    expect(node.data).toMatchObject({ modelId: 'flux-2-klein', presetId: null, aspectRatio: '1:1' });
  });

  it('never reuses an id', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createNode('prompt', { x: 0, y: 0 }, 'mock').id));
    expect(ids.size).toBe(50);
  });
});
```

`apps/web/src/entities/workflow/model/store.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Issue } from '@trafaret/core';
import { branchingGraph, edge } from '@trafaret/core/testing';
import { createNode } from '../lib/create-node';
import { getWorkflowGraph } from './hooks';
import { STORAGE_KEY, useWorkflowStore } from './store';

const store = () => useWorkflowStore.getState();
const issue = (fields: Partial<Issue>): Issue => ({ code: 'MISSING_VALUE', message: 'Fix me.', ...fields });

beforeEach(() => {
  useWorkflowStore.setState({ nodes: [], edges: [], issues: [], needsStarter: false });
});

describe('workflow store', () => {
  it('places a graph on the canvas and reads it back', () => {
    store().replaceGraph(branchingGraph());
    const graph = getWorkflowGraph();
    expect(graph.nodes.map((node) => node.id)).toEqual(['prompt', 'gen-a', 'gen-b', 'result-a', 'result-b']);
    expect(graph.edges).toEqual(branchingGraph().edges);
  });

  it('selects a newly added node and only that one', () => {
    store().replaceGraph(branchingGraph());
    store().onNodesChange([{ type: 'select', id: 'prompt', selected: true }]);
    const added = createNode('prompt', { x: 0, y: 0 }, 'mock');
    store().addNode(added);
    expect(
      store()
        .nodes.filter((node) => node.selected)
        .map((node) => node.id),
    ).toEqual([added.id]);
  });

  it('updates data only when the node has the expected type', () => {
    store().replaceGraph(branchingGraph());
    store().updateNodeData('prompt', 'prompt', { text: 'A red kite' });
    store().updateNodeData('gen-a', 'prompt', { text: 'ignored' });
    const graph = getWorkflowGraph();
    expect(graph.nodes.find((node) => node.id === 'prompt')?.data).toEqual({ text: 'A red kite' });
    expect(graph.nodes.find((node) => node.id === 'gen-a')?.data).not.toHaveProperty('text');
  });

  it("clears a node's issues once the node is edited or wired", () => {
    store().replaceGraph(branchingGraph());
    store().setIssues([issue({ nodeId: 'prompt' }), issue({ nodeId: 'result-a' }), issue({})]);
    store().updateNodeData('prompt', 'prompt', { text: 'Fixed' });
    expect(store().issues.map((item) => item.nodeId)).toEqual(['result-a', undefined]);
    store().connect({ source: 'gen-a', sourceHandle: 'out', target: 'result-a', targetHandle: 'image' });
    expect(store().issues.map((item) => item.nodeId)).toEqual([undefined]);
  });

  it('drops the issues of removed nodes and connections', () => {
    store().replaceGraph(branchingGraph());
    const wire = edge('prompt', 'gen-a', 'prompt');
    store().setIssues([issue({ nodeId: 'gen-b' }), issue({ code: 'CYCLE', edgeId: wire.id })]);
    store().onNodesChange([{ type: 'remove', id: 'gen-b' }]);
    store().onEdgesChange([{ type: 'remove', id: wire.id }]);
    expect(store().issues).toEqual([]);
  });

  it('clears the selection', () => {
    store().replaceGraph(branchingGraph());
    store().onNodesChange([{ type: 'select', id: 'gen-a', selected: true }]);
    store().clearSelection();
    expect(store().nodes.some((node) => node.selected)).toBe(false);
  });
});

describe('saving', () => {
  it('saves only the graph, in the shape the API takes', () => {
    store().replaceGraph(branchingGraph());
    store().onNodesChange([{ type: 'select', id: 'gen-a', selected: true }]);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { state: unknown };
    expect(saved.state).toEqual({ graph: getWorkflowGraph() });
  });

  it('restores a saved graph', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { graph: branchingGraph() }, version: 0 }));
    await useWorkflowStore.persist.rehydrate();
    expect(store().nodes).toHaveLength(5);
    expect(store().needsStarter).toBe(false);
  });

  it('asks for a starter workflow when nothing usable is saved', async () => {
    localStorage.removeItem(STORAGE_KEY); // every change saves, so the reset above saved an empty graph
    await useWorkflowStore.persist.rehydrate();
    expect(store().needsStarter).toBe(true);
    useWorkflowStore.setState({ needsStarter: false });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { graph: { nodes: 'broken' } }, version: 0 }));
    await useWorkflowStore.persist.rehydrate();
    expect(store().needsStarter).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project @trafaret/web entities/workflow`
Expected: FAIL — the modules don't exist yet.

- [ ] **Step 3: Implement the types, layout, mapping and factory**

`apps/web/src/entities/workflow/model/types.ts`:
```ts
import type { Edge, Node } from '@xyflow/react';
import type { GraphNodeOf, NodeType } from '@trafaret/core';

export type NodeDataOf<T extends NodeType> = GraphNodeOf<T>['data'];

/** A graph node as React Flow holds it: the same id, type and data, plus selection, size and drag state. */
export type FlowNodeOf<T extends NodeType> = Node<NodeDataOf<T>, T> & { type: T };
export type FlowNode = { [T in NodeType]: FlowNodeOf<T> }[NodeType];
export type FlowEdge = Edge;
```

`apps/web/src/entities/workflow/lib/auto-layout.ts`:
```ts
import type { XYPosition } from '@xyflow/react';
import { indexGraph, topologicalOrder, type Graph } from '@trafaret/core';

const COLUMN_WIDTH = 340;
const ROW_HEIGHT = 260;

/**
 * A position for every node: one column right of its deepest input, rows in node order. Used for graphs written
 * by hand (the API ignores positions), so they still open as a readable left-to-right flow.
 */
export function layoutByDepth(graph: Graph): Map<string, XYPosition> {
  const index = indexGraph(graph);
  const order = topologicalOrder(index) ?? graph.nodes.map((node) => node.id);
  const depth = new Map<string, number>();
  for (const id of order) {
    const inputs = index.incoming.get(id) ?? [];
    depth.set(id, Math.max(0, ...inputs.map((edge) => (depth.get(edge.source) ?? 0) + 1)));
  }
  const rowsUsed = new Map<number, number>();
  const positions = new Map<string, XYPosition>();
  for (const node of graph.nodes) {
    const column = depth.get(node.id) ?? 0;
    const row = rowsUsed.get(column) ?? 0;
    rowsUsed.set(column, row + 1);
    positions.set(node.id, { x: column * COLUMN_WIDTH, y: row * ROW_HEIGHT });
  }
  return positions;
}
```

`apps/web/src/entities/workflow/lib/graph-mapping.ts`:
```ts
import { isInputHandle, type Graph, type GraphEdge, type GraphNode } from '@trafaret/core';
import type { FlowEdge, FlowNode } from '../model/types';
import { layoutByDepth } from './auto-layout';

/** The canvas state as a graph: exactly what is saved, exported and posted to /api/runs. */
export function toGraph(nodes: readonly FlowNode[], edges: readonly FlowEdge[]): Graph {
  return { nodes: nodes.map(toGraphNode), edges: edges.flatMap(toGraphEdge) };
}

// React Flow adds selection, size and drag state; a graph node keeps id, type, data and position only.
const toGraphNode = ({ id, type, data, position }: FlowNode): GraphNode =>
  // `type` and `data` come from the same node, but TypeScript can't follow the pairing through destructuring.
  ({ id, type, data, position: { x: position.x, y: position.y } }) as GraphNode;

const toGraphEdge = (edge: FlowEdge): GraphEdge[] =>
  isInputHandle(edge.targetHandle)
    ? [
        {
          id: edge.id,
          source: edge.source,
          sourceHandle: 'out',
          target: edge.target,
          targetHandle: edge.targetHandle,
        },
      ]
    : [];

/** A graph as canvas state. Nodes without a position (hand-written graphs) are laid out by depth. */
export function fromGraph(graph: Graph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const layout = graph.nodes.some((node) => !node.position) ? layoutByDepth(graph) : undefined;
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: node.position ?? layout?.get(node.id) ?? { x: 0, y: 0 },
    })),
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
}
```

`apps/web/src/entities/workflow/lib/create-node.ts`:
```ts
import type { XYPosition } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { randomSeed, type NodeType } from '@trafaret/core';
import type { FlowNode } from '../model/types';

/** A new node with default data and a fresh id and seed. `modelId` is used by Generate and Edit nodes. */
export function createNode(type: NodeType, position: XYPosition, modelId: string): FlowNode {
  const id = nanoid();
  switch (type) {
    case 'prompt':
      return { id, type, position, data: { text: '' } };
    case 'imageInput':
      return { id, type, position, data: { assetId: null } };
    case 'generateImage':
      return {
        id,
        type,
        position,
        data: { modelId, presetId: null, aspectRatio: '1:1', seed: randomSeed() },
      };
    case 'editImage':
      return { id, type, position, data: { instruction: '', modelId, presetId: null, seed: randomSeed() } };
    case 'result':
      return { id, type, position, data: {} };
  }
}
```

- [ ] **Step 4: Implement the store and its hooks**

`apps/web/src/entities/workflow/model/store.ts` — React Flow's change handlers use plain `set`, data edits use immer recipes:
```ts
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { graphSchema, type Graph, type Issue, type NodeType } from '@trafaret/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { fromGraph, toGraph } from '../lib/graph-mapping';
import type { FlowEdge, FlowNode, NodeDataOf } from './types';

export type WorkflowState = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Issues from the last attempt to run. A node's issues clear once it is edited, rewired or removed. */
  issues: Issue[];
  /** True when nothing usable was saved, so the editor places a starter workflow. */
  needsStarter: boolean;
};

type WorkflowActions = {
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  connect: (connection: Connection) => void;
  addNode: (node: FlowNode) => void;
  updateNodeData: <T extends NodeType>(id: string, type: T, patch: Partial<NodeDataOf<T>>) => void;
  replaceGraph: (graph: Graph) => void;
  clearSelection: () => void;
  setIssues: (issues: readonly Issue[]) => void;
};

export const STORAGE_KEY = 'trafaret:graph:v1';

const removedIds = (changes: ReadonlyArray<{ type: string; id?: string }>): Set<string> =>
  new Set(changes.flatMap((change) => (change.type === 'remove' && change.id ? [change.id] : [])));

/** `issues` without the dropped ones — the same array when nothing is dropped, so subscribers stay quiet. */
const keepIssues = (issues: Issue[], drop: (issue: Issue) => boolean): Issue[] => {
  const kept = issues.filter((issue) => !drop(issue));
  return kept.length === issues.length ? issues : kept;
};

const savedGraph = (persisted: unknown): Graph | null => {
  const graph =
    typeof persisted === 'object' && persisted !== null && 'graph' in persisted ? persisted.graph : undefined;
  const parsed = graphSchema.safeParse(graph);
  return parsed.success ? parsed.data : null;
};

/** The workflow on the canvas. React Flow is fully controlled by it; the graph part is saved in localStorage. */
export const useWorkflowStore = create<WorkflowState & WorkflowActions>()(
  persist(
    immer((set, get) => ({
      nodes: [],
      edges: [],
      issues: [],
      needsStarter: false,

      onNodesChange: (changes) => {
        const removed = removedIds(changes);
        set({
          nodes: applyNodeChanges(changes, get().nodes),
          issues: keepIssues(
            get().issues,
            (issue) => issue.nodeId !== undefined && removed.has(issue.nodeId),
          ),
        });
      },
      onEdgesChange: (changes) => {
        const removed = removedIds(changes);
        set({
          edges: applyEdgeChanges(changes, get().edges),
          issues: keepIssues(
            get().issues,
            (issue) => issue.edgeId !== undefined && removed.has(issue.edgeId),
          ),
        });
      },
      connect: (connection) =>
        set({
          edges: addEdge(connection, get().edges),
          issues: keepIssues(get().issues, (issue) => issue.nodeId === connection.target),
        }),
      addNode: (node) =>
        set((state) => {
          for (const existing of state.nodes) if (existing.selected) existing.selected = false;
          state.nodes.push({ ...node, selected: true });
          state.needsStarter = false;
        }),
      updateNodeData: (id, type, patch) =>
        set((state) => {
          const node = state.nodes.find((candidate) => candidate.id === id);
          if (node?.type !== type) return;
          Object.assign(node.data, patch);
          state.issues = keepIssues(state.issues, (issue) => issue.nodeId === id);
        }),
      replaceGraph: (graph) => set({ ...fromGraph(graph), issues: [], needsStarter: false }),
      clearSelection: () =>
        set((state) => {
          for (const node of state.nodes) if (node.selected) node.selected = false;
          for (const edge of state.edges) if (edge.selected) edge.selected = false;
        }),
      setIssues: (issues) => set({ issues: [...issues] }),
    })),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only the graph is saved, in the shape the API takes: never selection, sizes or issues.
      partialize: (state) => ({ graph: toGraph(state.nodes, state.edges) }),
      merge: (persisted, current) => {
        const graph = savedGraph(persisted);
        return graph ? { ...current, ...fromGraph(graph) } : { ...current, needsStarter: true };
      },
    },
  ),
);
```

`apps/web/src/entities/workflow/model/hooks.ts`:
```ts
import type { Graph, InputHandle, Issue } from '@trafaret/core';
import { useShallow } from 'zustand/shallow';
import { toGraph } from '../lib/graph-mapping';
import { useWorkflowStore } from './store';
import type { FlowNode } from './types';

/** The current graph, read once (for a run, an export or a wiring check) without subscribing. */
export function getWorkflowGraph(): Graph {
  const { nodes, edges } = useWorkflowStore.getState();
  return toGraph(nodes, edges);
}

export const useWorkflowNode = (nodeId: string | null): FlowNode | undefined =>
  useWorkflowStore((state) => state.nodes.find((node) => node.id === nodeId));

export const useSelectedNodeIds = (): string[] =>
  useWorkflowStore(useShallow((state) => state.nodes.filter((node) => node.selected).map((node) => node.id)));

export const useNodeIssues = (nodeId: string): Issue[] =>
  useWorkflowStore(useShallow((state) => state.issues.filter((issue) => issue.nodeId === nodeId)));

/** The node wired into one of a node's inputs, or null. */
export const useUpstreamNodeId = (nodeId: string, handle: InputHandle): string | null =>
  useWorkflowStore(
    (state) =>
      state.edges.find((edge) => edge.target === nodeId && edge.targetHandle === handle)?.source ?? null,
  );
```

`apps/web/src/entities/workflow/index.ts`:
```ts
export { createNode } from './lib/create-node';
export { fromGraph, toGraph } from './lib/graph-mapping';
export {
  getWorkflowGraph,
  useNodeIssues,
  useSelectedNodeIds,
  useUpstreamNodeId,
  useWorkflowNode,
} from './model/hooks';
export { useWorkflowStore } from './model/store';
export type { FlowEdge, FlowNode, FlowNodeOf, NodeDataOf } from './model/types';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project @trafaret/web entities/workflow`
Expected: PASS (16 tests).

- [ ] **Step 6: Run the gate**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): add the workflow store that drives the canvas"
```

---

### Task 5: Catalog, preset and asset entities

Server state the editor reads but never changes: the model catalog, the presets and the pinned sample photos (TanStack Query, `staleTime: Infinity`), plus uploads. Presentational selects for models and presets live here; they take `value`/`onChange`, so the cards decide what a change means.

**Files:**
- Create: `apps/web/src/entities/catalog/{api/catalog-api.ts, model/catalog-query.ts, lib/models.ts, ui/ModelSelect.tsx, index.ts}`
- Create: `apps/web/src/entities/preset/{api/preset-api.ts, model/presets-query.ts, ui/PresetSelect.tsx, ui/PresetReferences.tsx, ui/PresetReferences.module.css, index.ts}`
- Create: `apps/web/src/entities/asset/{api/asset-api.ts, model/samples-query.ts, lib/upload-problem.ts, index.ts}`
- Test: `apps/web/src/entities/catalog/lib/models.test.ts`, `apps/web/src/entities/catalog/ui/ModelSelect.test.tsx`, `apps/web/src/entities/preset/ui/PresetSelect.test.tsx`, `apps/web/src/entities/asset/lib/upload-problem.test.ts`

**Interfaces:**
- Consumes: `http`, `request` from `@/shared/api`; `Select` from `@/shared/ui`; `catalogResponseSchema`, `presetsResponseSchema`, `samplesResponseSchema`, `assetSchema`, `UPLOAD_LIMITS` from `@trafaret/core`.
- Produces, from `@/entities/catalog`: `catalogQuery`, `useCatalog()`, `defaultModelId(models, purpose: 'generate' | 'edit'): string | null`, `supportedAspectRatio(model, current): AspectRatio`, `ModelSelect({ models, value, onChange: (modelId: string) => void, editOnly?, ...selectProps })`.
- Produces, from `@/entities/preset`: `presetsQuery`, `usePresets()`, `PresetSelect({ presets, value: string | null, onChange: (presetId: string | null) => void, ...selectProps })`, `PresetReferences({ preset: Preset | undefined })`.
- Produces, from `@/entities/asset`: `uploadAsset(file: File): Promise<Asset>`, `uploadProblem(file: File): string | null`, `samplesQuery`, `useSamples()`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/entities/catalog/lib/models.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { ImageModel } from '@trafaret/core';
import { defaultModelId, supportedAspectRatio } from './models';

const model = (id: string, fields: Partial<ImageModel> = {}): ImageModel => ({
  id,
  label: id,
  provider: 'mock',
  default: false,
  enabled: true,
  unavailableReason: null,
  supportsEdit: true,
  supportsNegativePrompt: true,
  supportsSeed: true,
  maxReferenceImages: 4,
  aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
  costPerImageUsd: 0,
  ...fields,
});

describe('defaultModelId', () => {
  it("prefers the server's default", () => {
    expect(defaultModelId([model('a'), model('b', { default: true })], 'generate')).toBe('b');
  });

  it('skips disabled models', () => {
    const models = [model('a', { enabled: false, default: true }), model('b')];
    expect(defaultModelId(models, 'generate')).toBe('b');
  });

  it('picks an edit-capable model for Edit nodes', () => {
    const models = [model('a', { default: true, supportsEdit: false }), model('b')];
    expect(defaultModelId(models, 'edit')).toBe('b');
  });

  it('returns null when nothing can do the job', () => {
    expect(defaultModelId([model('a', { enabled: false })], 'generate')).toBeNull();
  });
});

describe('supportedAspectRatio', () => {
  it('keeps a supported ratio and replaces an unsupported one', () => {
    const square = model('square', { aspectRatios: ['1:1'] });
    expect(supportedAspectRatio(model('any'), '16:9')).toBe('16:9');
    expect(supportedAspectRatio(square, '16:9')).toBe('1:1');
  });
});
```

`apps/web/src/entities/catalog/ui/ModelSelect.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ImageModel } from '@trafaret/core';
import { ModelSelect } from './ModelSelect';

const base: Omit<ImageModel, 'id' | 'label'> = {
  provider: 'mock',
  default: false,
  enabled: true,
  unavailableReason: null,
  supportsEdit: true,
  supportsNegativePrompt: true,
  supportsSeed: true,
  maxReferenceImages: 4,
  aspectRatios: ['1:1'],
  costPerImageUsd: 0,
};
const models: ImageModel[] = [
  {
    ...base,
    id: 'seedream-4.5',
    label: 'Seedream 4.5',
    provider: 'byteplus',
    enabled: false,
    unavailableReason: 'Set ARK_API_KEY on the server to enable this model.',
  },
  { ...base, id: 'mock', label: 'Mock' },
  { ...base, id: 'text-only', label: 'Text only', supportsEdit: false },
];

describe('ModelSelect', () => {
  it('lists unusable models as disabled, with the reason', () => {
    render(<ModelSelect aria-label="Model" models={models} value="mock" onChange={() => undefined} />);
    const option = screen.getByRole('option', { name: /Seedream 4\.5/ });
    expect(option).toBeDisabled();
    expect(option).toHaveTextContent('Set ARK_API_KEY on the server to enable this model.');
  });

  it('reports the chosen model id', async () => {
    const onChange = vi.fn();
    render(<ModelSelect aria-label="Model" models={models} value="mock" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Model'), 'Text only');
    expect(onChange).toHaveBeenCalledWith('text-only');
  });

  it('offers only edit-capable models to Edit nodes', () => {
    render(
      <ModelSelect aria-label="Model" models={models} value="mock" onChange={() => undefined} editOnly />,
    );
    expect(screen.queryByRole('option', { name: 'Text only' })).not.toBeInTheDocument();
  });
});
```

`apps/web/src/entities/preset/ui/PresetSelect.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Preset } from '@trafaret/core';
import { PresetReferences } from './PresetReferences';
import { PresetSelect } from './PresetSelect';

const premium: Preset = {
  id: 'premium-3d',
  name: 'Premium 3D',
  mainPrompt: 'premium minimal 3D render',
  negativePrompt: 'clutter',
  references: ['/api/assets/one', '/api/assets/two'],
};

describe('PresetSelect', () => {
  it('maps "No preset" to null and back', async () => {
    const onChange = vi.fn();
    render(<PresetSelect aria-label="Preset" presets={[premium]} value="premium-3d" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'No preset');
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('reports the chosen preset id', async () => {
    const onChange = vi.fn();
    render(<PresetSelect aria-label="Preset" presets={[premium]} value={null} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'Premium 3D');
    expect(onChange).toHaveBeenCalledWith('premium-3d');
  });
});

describe('PresetReferences', () => {
  it('shows a thumbnail per reference image', () => {
    render(<PresetReferences preset={premium} />);
    const list = screen.getByRole('list', { name: 'Premium 3D reference images' });
    expect(list.querySelectorAll('img')).toHaveLength(2);
  });
});
```

`apps/web/src/entities/asset/lib/upload-problem.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { uploadProblem } from './upload-problem';

describe('uploadProblem', () => {
  it('accepts PNG, JPEG and WebP images', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(uploadProblem(new File(['x'], 'photo', { type }))).toBeNull();
    }
  });

  it('refuses other formats with the same words as the server', () => {
    const gif = new File(['x'], 'cat.gif', { type: 'image/gif' });
    expect(uploadProblem(gif)).toBe('Only PNG, JPEG and WebP images are supported.');
  });

  it('refuses files over 10 MB', () => {
    const huge = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' });
    expect(uploadProblem(huge)).toBe('Images must be 10 MB or smaller.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project @trafaret/web entities/catalog entities/preset entities/asset`
Expected: FAIL — the modules don't exist yet.

- [ ] **Step 3: Implement the catalog entity**

`apps/web/src/entities/catalog/api/catalog-api.ts`:
```ts
import { catalogResponseSchema, type ImageModel } from '@trafaret/core';
import { http, request } from '@/shared/api';

export async function fetchCatalog(signal?: AbortSignal): Promise<ImageModel[]> {
  const { models } = await request(http.get('catalog', { signal }).json(catalogResponseSchema));
  return models;
}
```

`apps/web/src/entities/catalog/model/catalog-query.ts`:
```ts
import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchCatalog } from '../api/catalog-api';

/** The server's models never change while it runs. */
export const catalogQuery = queryOptions({
  queryKey: ['catalog'],
  queryFn: ({ signal }) => fetchCatalog(signal),
  staleTime: Infinity,
});

export const useCatalog = () => useQuery(catalogQuery);
```

`apps/web/src/entities/catalog/lib/models.ts`:
```ts
import type { AspectRatio, ImageModel } from '@trafaret/core';

/** The model a new node starts with: the server's default if it can do the job, else the first one that can. */
export function defaultModelId(models: readonly ImageModel[], purpose: 'generate' | 'edit'): string | null {
  const usable = models.filter((model) => model.enabled && (purpose === 'generate' || model.supportsEdit));
  return (usable.find((model) => model.default) ?? usable[0])?.id ?? null;
}

/** Keeps the aspect ratio when the model supports it, otherwise falls back to the model's first one. */
export const supportedAspectRatio = (model: ImageModel, current: AspectRatio): AspectRatio =>
  model.aspectRatios.includes(current) ? current : (model.aspectRatios[0] ?? current);
```

`apps/web/src/entities/catalog/ui/ModelSelect.tsx`:
```tsx
import type { ComponentProps } from 'react';
import type { ImageModel } from '@trafaret/core';
import { Select } from '@/shared/ui';

type ModelSelectProps = Omit<ComponentProps<'select'>, 'value' | 'onChange' | 'children'> & {
  models: readonly ImageModel[];
  value: string;
  onChange: (modelId: string) => void;
  /** Lists only the models that can edit images. */
  editOnly?: boolean;
};

/** Every model is listed; the ones the server can't use are disabled and say why. */
export function ModelSelect({ models, value, onChange, editOnly = false, ...props }: ModelSelectProps) {
  const options = editOnly ? models.filter((model) => model.supportsEdit) : models;
  const listed = options.some((model) => model.id === value);
  return (
    <Select {...props} value={value} onChange={(event) => onChange(event.target.value)}>
      {!listed && (
        <option value={value} disabled>
          {models.length === 0 ? value : `${value} (not available)`}
        </option>
      )}
      {options.map((model) => (
        <option key={model.id} value={model.id} disabled={!model.enabled}>
          {model.enabled ? model.label : `${model.label} — ${model.unavailableReason ?? 'unavailable'}`}
        </option>
      ))}
    </Select>
  );
}
```

`apps/web/src/entities/catalog/index.ts`:
```ts
export { catalogQuery, useCatalog } from './model/catalog-query';
export { defaultModelId, supportedAspectRatio } from './lib/models';
export { ModelSelect } from './ui/ModelSelect';
```

- [ ] **Step 4: Implement the preset entity**

`apps/web/src/entities/preset/api/preset-api.ts`:
```ts
import { presetsResponseSchema, type Preset } from '@trafaret/core';
import { http, request } from '@/shared/api';

export async function fetchPresets(signal?: AbortSignal): Promise<Preset[]> {
  const { presets } = await request(http.get('presets', { signal }).json(presetsResponseSchema));
  return presets;
}
```

`apps/web/src/entities/preset/model/presets-query.ts`:
```ts
import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchPresets } from '../api/preset-api';

/** Presets live on the server and never change while it runs. */
export const presetsQuery = queryOptions({
  queryKey: ['presets'],
  queryFn: ({ signal }) => fetchPresets(signal),
  staleTime: Infinity,
});

export const usePresets = () => useQuery(presetsQuery);
```

`apps/web/src/entities/preset/ui/PresetSelect.tsx`:
```tsx
import type { ComponentProps } from 'react';
import type { Preset } from '@trafaret/core';
import { Select } from '@/shared/ui';

type PresetSelectProps = Omit<ComponentProps<'select'>, 'value' | 'onChange' | 'children'> & {
  presets: readonly Preset[];
  value: string | null;
  onChange: (presetId: string | null) => void;
};

export function PresetSelect({ presets, value, onChange, ...props }: PresetSelectProps) {
  const listed = value === null || presets.some((preset) => preset.id === value);
  return (
    <Select {...props} value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">No preset</option>
      {!listed && (
        <option value={value} disabled>
          {presets.length === 0 ? value : `${value} (not available)`}
        </option>
      )}
      {presets.map((preset) => (
        <option key={preset.id} value={preset.id}>
          {preset.name}
        </option>
      ))}
    </Select>
  );
}
```

`apps/web/src/entities/preset/ui/PresetReferences.tsx`:
```tsx
import type { Preset } from '@trafaret/core';
import styles from './PresetReferences.module.css';

/** Thumbnails of the reference images a preset sends along with every request. */
export function PresetReferences({ preset }: { preset: Preset | undefined }) {
  if (!preset || preset.references.length === 0) return null;
  return (
    <ul className={styles.references} aria-label={`${preset.name} reference images`}>
      {preset.references.map((url) => (
        <li key={url}>
          <img src={url} alt="" width={36} height={36} loading="lazy" className={styles.thumbnail} />
        </li>
      ))}
    </ul>
  );
}
```

`apps/web/src/entities/preset/ui/PresetReferences.module.css`:
```css
.references {
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.thumbnail {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 6px;
  object-fit: cover;
}
```

`apps/web/src/entities/preset/index.ts`:
```ts
export { presetsQuery, usePresets } from './model/presets-query';
export { PresetReferences } from './ui/PresetReferences';
export { PresetSelect } from './ui/PresetSelect';
```

- [ ] **Step 5: Implement the asset entity**

`apps/web/src/entities/asset/api/asset-api.ts`:
```ts
import { assetSchema, samplesResponseSchema, type Asset, type Sample } from '@trafaret/core';
import { http, request } from '@/shared/api';

export function uploadAsset(file: File): Promise<Asset> {
  const body = new FormData();
  body.append('file', file);
  // A large photo on a slow connection takes a while: uploads get more time than other calls.
  return request(http.post('assets', { body, timeout: 120_000 }).json(assetSchema));
}

export async function fetchSamples(signal?: AbortSignal): Promise<Sample[]> {
  const { samples } = await request(http.get('samples', { signal }).json(samplesResponseSchema));
  return samples;
}
```

`apps/web/src/entities/asset/model/samples-query.ts`:
```ts
import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchSamples } from '../api/asset-api';

/** Sample photos are pinned on the server for as long as it runs. */
export const samplesQuery = queryOptions({
  queryKey: ['samples'],
  queryFn: ({ signal }) => fetchSamples(signal),
  staleTime: Infinity,
});

export const useSamples = () => useQuery(samplesQuery);
```

`apps/web/src/entities/asset/lib/upload-problem.ts`:
```ts
import { UPLOAD_LIMITS } from '@trafaret/core';

const MEGABYTE = 1024 * 1024;

/** Why the server would refuse this file — checked before uploading. Null when the file looks fine. */
export function uploadProblem(file: File): string | null {
  if (!UPLOAD_LIMITS.mimeTypes.some((type) => type === file.type)) {
    return 'Only PNG, JPEG and WebP images are supported.';
  }
  if (file.size > UPLOAD_LIMITS.maxBytes) {
    return `Images must be ${UPLOAD_LIMITS.maxBytes / MEGABYTE} MB or smaller.`;
  }
  return null;
}
```

`apps/web/src/entities/asset/index.ts`:
```ts
export { uploadAsset } from './api/asset-api';
export { uploadProblem } from './lib/upload-problem';
export { samplesQuery, useSamples } from './model/samples-query';
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project @trafaret/web entities/catalog entities/preset entities/asset`
Expected: PASS (14 tests).

- [ ] **Step 7: Run the gate**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): add the catalog, preset and asset entities"
```

---

### Task 6: Run entity — polling, timeline layout, status helpers

Everything the editor knows about runs: the API calls, the session (which run is active and the graph it was started with), the query that polls it — mounted once, with a version guard so an older snapshot never replaces a newer one — and the pure helpers the cards, timeline and inspector share: status labels, where a Retry goes, durations, "edited since the run", the timeline layout and the summary line.

**Files:**
- Create: `apps/web/src/entities/run/api/run-api.ts`, `apps/web/src/entities/run/model/{run-session.ts, run-query.ts}`, `apps/web/src/entities/run/lib/{keep-newer-run.ts, job-status.ts, timeline.ts, run-summary.ts}`, `apps/web/src/entities/run/ui/JobStatusBadge.tsx`, `apps/web/src/entities/run/index.ts`
- Test: `apps/web/src/entities/run/lib/{keep-newer-run,job-status,timeline,run-summary}.test.ts`, `apps/web/src/entities/run/ui/JobStatusBadge.test.tsx`

**Interfaces:**
- Consumes: `http`, `request` from `@/shared/api`; `formatDuration`, `formatSeconds`, `pluralize` from `@/shared/lib`; `Badge`, `Spinner` from `@/shared/ui`; `runSchema`, `runIdResponseSchema`, `isTerminalRunStatus` and the run types from `@trafaret/core`; `job`, `runSnapshot` from `@trafaret/core/testing` (tests).
- Produces, from `@/entities/run`:
  - `retryNode(runId: string, nodeId: string): Promise<void>` (POST without a body)
  - `useRunSession` — `{ activeRunId: string | null; submittedGraph: Graph | null; start(runId, graph): void; clear(): void }`
  - `runQueryKey(runId) → ['runs', runId]`, `startRunMutation` (mutation options with key `['runs', 'start']`, `mutationFn: createRun`)
  - `useRunPolling(): void` — the only polling observer (700 ms until the run ends or errors)
  - `useActiveRunQuery()`, `useActiveRun(): Run | undefined`, `useNodeJob(nodeId: string | null): Job | undefined` — readers, never fetch
  - `useIsRunBusy(): boolean` — a run is being started or is still going
  - `JOB_STATUS_LABEL`, `retryTarget(job): string | null`, `jobDurationMs(job, now): number | null`, `isNodeEdited(nodeId, data, submitted: Graph | null): boolean`
  - `layoutTimeline(run, nodeIds, now): TimelineLayout` with `TimelineBar = { nodeId, status, cached, start: number | null, end: number | null }` (fractions 0–1)
  - `formatRunSummary(run, now): string` — `"2 AI calls · 13.4 s · 1 reused · saved ~12.1 s"`
  - `JobStatusBadge({ status, elapsedMs? })`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/entities/run/lib/keep-newer-run.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { job, runSnapshot } from '@trafaret/core/testing';
import { keepNewerRun } from './keep-newer-run';

describe('keepNewerRun', () => {
  it('keeps the newer snapshot when an older one arrives late', () => {
    const newer = runSnapshot([job('a')], { version: 5 });
    const older = runSnapshot([job('a', { status: 'running', finishedAt: null })], { version: 3 });
    expect(keepNewerRun(newer, older)).toBe(newer);
  });

  it('takes a newer snapshot but keeps the jobs that did not change', () => {
    const running = job('b', { status: 'running', finishedAt: null });
    const before = runSnapshot([job('a'), running], { status: 'running', version: 2 });
    const after = runSnapshot([job('a'), job('b')], { version: 3 });
    const kept = keepNewerRun(before, after);
    expect(kept.version).toBe(3);
    expect(kept.jobs.a).toBe(before.jobs.a);
    expect(kept.jobs.b).toEqual(after.jobs.b);
  });

  it('switches to another run whatever its version', () => {
    const first = runSnapshot([], { id: 'run_1', version: 9 });
    const second = runSnapshot([], { id: 'run_2', version: 1 });
    expect(keepNewerRun(first, second)).toEqual(second);
  });
});
```

`apps/web/src/entities/run/lib/job-status.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { JobError } from '@trafaret/core';
import { branchingGraph, job } from '@trafaret/core/testing';
import { isNodeEdited, jobDurationMs, retryTarget } from './job-status';

const failure = (fields: Partial<JobError> = {}): JobError => ({
  code: 'PROVIDER_ERROR',
  message: 'The AI service is busy. Retry in a few seconds.',
  retryable: true,
  ...fields,
});

describe('retryTarget', () => {
  it('retries a failed node itself', () => {
    expect(retryTarget(job('gen-a', { status: 'error', error: failure() }))).toBe('gen-a');
  });

  it('sends a skipped node to the failure that caused it', () => {
    const skipped = job('result-a', {
      nodeType: 'result',
      status: 'error',
      startedAt: null,
      error: failure({
        code: 'UPSTREAM_FAILED',
        message: 'Skipped: Generate Image failed.',
        upstreamNodeId: 'gen-a',
      }),
    });
    expect(retryTarget(skipped)).toBe('gen-a');
  });

  it('offers nothing when a retry cannot help', () => {
    expect(retryTarget(job('gen-a', { status: 'error', error: failure({ retryable: false }) }))).toBeNull();
    expect(retryTarget(job('gen-a'))).toBeNull();
  });
});

describe('jobDurationMs', () => {
  it('measures a finished job, and a running one up to now', () => {
    expect(jobDurationMs(job('a', { startedAt: 1_000, finishedAt: 2_500 }), 9_000)).toBe(1_500);
    expect(jobDurationMs(job('a', { status: 'running', startedAt: 1_000, finishedAt: null }), 4_000)).toBe(
      3_000,
    );
  });

  it('has no duration for a reused result or a job that never started', () => {
    expect(jobDurationMs(job('a', { cached: true }), 9_000)).toBeNull();
    expect(
      jobDurationMs(job('a', { status: 'queued', startedAt: null, finishedAt: null }), 9_000),
    ).toBeNull();
  });
});

describe('isNodeEdited', () => {
  const submitted = branchingGraph();

  it('is false while the settings match the run', () => {
    expect(
      isNodeEdited('gen-a', { modelId: 'mock', presetId: null, aspectRatio: '1:1', seed: 1 }, submitted),
    ).toBe(false);
  });

  it('is true once a setting changed', () => {
    expect(
      isNodeEdited(
        'gen-a',
        { modelId: 'mock', presetId: 'lifestyle', aspectRatio: '1:1', seed: 1 },
        submitted,
      ),
    ).toBe(true);
  });

  it('is false without a run, and for nodes the run did not have', () => {
    expect(isNodeEdited('gen-a', { seed: 7 }, null)).toBe(false);
    expect(isNodeEdited('new-node', { text: 'hi' }, submitted)).toBe(false);
  });
});
```

`apps/web/src/entities/run/lib/timeline.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { job, runSnapshot } from '@trafaret/core/testing';
import { layoutTimeline } from './timeline';

/** Milliseconds after the run started (at t=1000). */
const at = (ms: number): number => 1_000 + ms;

describe('layoutTimeline', () => {
  it('places parallel branches side by side in time', () => {
    const run = runSnapshot(
      [
        job('a', { startedAt: at(0), finishedAt: at(5_000) }),
        job('b', { startedAt: at(1_000), finishedAt: at(8_000) }),
      ],
      { startedAt: at(0), finishedAt: at(8_000) },
    );
    const { spanMs, bars } = layoutTimeline(run, ['a', 'b'], at(9_000));
    expect(spanMs).toBe(8_000);
    expect(bars).toEqual([
      { nodeId: 'a', status: 'success', cached: false, start: 0, end: 0.625 },
      { nodeId: 'b', status: 'success', cached: false, start: 0.125, end: 1 },
    ]);
  });

  it('grows a running bar, and the timeline, until now', () => {
    const run = runSnapshot([job('a', { status: 'running', startedAt: at(1_000), finishedAt: null })], {
      status: 'running',
      startedAt: at(0),
      finishedAt: null,
    });
    expect(layoutTimeline(run, ['a'], at(2_000)).bars[0]).toMatchObject({ start: 0.5, end: 1 });
    expect(layoutTimeline(run, ['a'], at(4_000))).toMatchObject({
      spanMs: 4_000,
      bars: [{ start: 0.25, end: 1 }],
    });
  });

  it('draws a reused result as a zero-width mark at the start', () => {
    const run = runSnapshot(
      [
        job('a', { cached: true, startedAt: at(0), finishedAt: at(0) }),
        job('b', { startedAt: at(0), finishedAt: at(3_000) }),
      ],
      { startedAt: at(0), finishedAt: at(3_000) },
    );
    expect(layoutTimeline(run, ['a', 'b'], at(3_000)).bars[0]).toMatchObject({
      cached: true,
      start: 0,
      end: 0,
    });
  });

  it('marks a node that was skipped before it started at the moment it failed', () => {
    const run = runSnapshot(
      [
        job('a', { status: 'error', startedAt: at(0), finishedAt: at(2_000) }),
        job('b', { status: 'error', startedAt: null, finishedAt: at(2_000) }),
      ],
      { status: 'failed', startedAt: at(0), finishedAt: at(2_000) },
    );
    expect(layoutTimeline(run, ['a', 'b'], at(2_000)).bars[1]).toMatchObject({ start: 1, end: 1 });
  });

  it('gives a job that has not started no bar yet', () => {
    const run = runSnapshot([job('a', { status: 'queued', startedAt: null, finishedAt: null })], {
      status: 'running',
      startedAt: at(0),
      finishedAt: null,
    });
    expect(layoutTimeline(run, ['a'], at(500)).bars[0]).toMatchObject({ start: null, end: null });
  });

  it('keeps at least a second of timeline for a run that finished at once', () => {
    const run = runSnapshot([job('a', { cached: true, startedAt: at(0), finishedAt: at(0) })], {
      startedAt: at(0),
      finishedAt: at(0),
    });
    expect(layoutTimeline(run, ['a'], at(0)).spanMs).toBe(1_000);
  });

  it('skips nodes the run has no job for', () => {
    const run = runSnapshot([job('a')]);
    expect(layoutTimeline(run, ['a', 'added-later'], at(0)).bars.map((bar) => bar.nodeId)).toEqual(['a']);
  });
});
```

`apps/web/src/entities/run/lib/run-summary.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { runSnapshot } from '@trafaret/core/testing';
import { formatRunSummary } from './run-summary';

describe('formatRunSummary', () => {
  it('summarises a finished run', () => {
    const run = runSnapshot([], {
      startedAt: 1_000,
      finishedAt: 14_400,
      summary: { aiNodes: 3, generated: 2, reused: 1, failed: 0, savedMs: 12_100, fallbacks: 0 },
    });
    expect(formatRunSummary(run, 99_000)).toBe('2 AI calls · 13.4 s · 1 reused · saved ~12.1 s');
  });

  it('counts a running run up to now and mentions failures and budget fallbacks', () => {
    const run = runSnapshot([], {
      status: 'running',
      startedAt: 1_000,
      finishedAt: null,
      summary: { aiNodes: 2, generated: 0, reused: 0, failed: 1, savedMs: 0, fallbacks: 1 },
    });
    expect(formatRunSummary(run, 3_500)).toBe('1 AI call · 2.5 s · 1 failed · 1 on Mock (daily limit)');
  });
});
```

`apps/web/src/entities/run/ui/JobStatusBadge.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JobStatusBadge } from './JobStatusBadge';

describe('JobStatusBadge', () => {
  it('shows how long a running job has been going', () => {
    render(<JobStatusBadge status="running" elapsedMs={3_400} />);
    expect(screen.getByText('Running · 3 s')).toBeInTheDocument();
  });

  it('labels finished and failed jobs', () => {
    const { rerender } = render(<JobStatusBadge status="success" />);
    expect(screen.getByText('✓ Done')).toBeInTheDocument();
    rerender(<JobStatusBadge status="error" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project @trafaret/web entities/run`
Expected: FAIL — the modules don't exist yet.

- [ ] **Step 3: Implement the pure helpers**

`apps/web/src/entities/run/lib/keep-newer-run.ts`:
```ts
import { replaceEqualDeep } from '@tanstack/react-query';
import type { Run } from '@trafaret/core';

/**
 * Responses can overtake each other, so an older snapshot of a run never replaces a newer one. A newer snapshot
 * keeps the objects that did not change, so only the nodes whose job changed re-render.
 */
export function keepNewerRun(previous: Run | undefined, next: Run): Run {
  if (previous?.id === next.id && previous.version > next.version) return previous;
  return replaceEqualDeep(previous, next);
}
```

`apps/web/src/entities/run/lib/job-status.ts`:
```ts
import type { Graph, Job, JobStatus } from '@trafaret/core';

export const JOB_STATUS_LABEL: Readonly<Record<JobStatus, string>> = {
  idle: 'Not run',
  queued: 'Queued',
  running: 'Running',
  success: 'Done',
  error: 'Failed',
};

/**
 * Where a Retry goes: the failed node itself or, for a node skipped because an input failed, the node that
 * caused it. Null when retrying can't help (the failure is not retryable).
 */
export function retryTarget(job: Job): string | null {
  if (job.status !== 'error' || !job.error?.retryable) return null;
  return job.error.code === 'UPSTREAM_FAILED' ? (job.error.upstreamNodeId ?? null) : job.nodeId;
}

/** How long the job has run (so far, while running). Null before it starts and for a reused result. */
export function jobDurationMs(job: Job, now: number): number | null {
  if (job.cached || job.startedAt === null) return null;
  return (job.finishedAt ?? now) - job.startedAt;
}

/** True when a node's settings differ from the ones the active run was started with. */
export function isNodeEdited(
  nodeId: string,
  data: Readonly<Record<string, unknown>>,
  submitted: Graph | null,
): boolean {
  const before: Readonly<Record<string, unknown>> | undefined = submitted?.nodes.find(
    (node) => node.id === nodeId,
  )?.data;
  if (!before) return false;
  const keys = Object.keys(data);
  return keys.length !== Object.keys(before).length || keys.some((key) => !Object.is(data[key], before[key]));
}
```

`apps/web/src/entities/run/lib/timeline.ts`:
```ts
import type { Job, JobStatus, Run } from '@trafaret/core';

export type TimelineBar = {
  nodeId: string;
  status: JobStatus;
  cached: boolean;
  /** Where the bar starts and ends, as fractions (0–1) of the timeline. Null for a job that hasn't started. */
  start: number | null;
  end: number | null;
};

export type TimelineLayout = { spanMs: number; bars: TimelineBar[] };

/** The shortest timeline, so a run that finished almost at once still draws readable bars. */
const MIN_SPAN_MS = 1000;

/** Lays out one bar per node, in the given order, relative to the start of the run. Pure, so it is tested. */
export function layoutTimeline(run: Run, nodeIds: readonly string[], now: number): TimelineLayout {
  const origin = run.startedAt ?? run.createdAt;
  const jobs = nodeIds.flatMap((id) => run.jobs[id] ?? []);
  // A running job reaches up to now; a finished or failed one ends when it did.
  const endOf = (job: Job): number | null =>
    job.finishedAt ??
    (job.status === 'running' && job.startedAt !== null ? Math.max(now, job.startedAt) : null);
  const runEnd = run.finishedAt ?? (run.status === 'running' ? now : origin);
  const latest = Math.max(runEnd, ...jobs.map((job) => endOf(job) ?? origin));
  const spanMs = Math.max(latest - origin, MIN_SPAN_MS);
  const fraction = (time: number): number => Math.min(1, Math.max(0, (time - origin) / spanMs));
  return {
    spanMs,
    bars: jobs.map((job) => {
      const end = endOf(job);
      // A job skipped before it could start is a zero-width mark at the moment it failed.
      const start = job.startedAt ?? end;
      return {
        nodeId: job.nodeId,
        status: job.status,
        cached: job.cached,
        start: start === null ? null : fraction(start),
        end: end === null ? null : fraction(end),
      };
    }),
  };
}
```

`apps/web/src/entities/run/lib/run-summary.ts`:
```ts
import type { Run } from '@trafaret/core';
import { formatDuration, pluralize } from '@/shared/lib';

/** "2 AI calls · 13.4 s · 1 reused · saved ~12.1 s" */
export function formatRunSummary(run: Run, now: number): string {
  const { generated, fallbacks, reused, failed, savedMs } = run.summary;
  const parts = [pluralize(generated + fallbacks, 'AI call')];
  if (run.startedAt !== null) parts.push(formatDuration((run.finishedAt ?? now) - run.startedAt));
  if (reused > 0) parts.push(`${reused} reused`);
  if (failed > 0) parts.push(`${failed} failed`);
  if (savedMs > 0) parts.push(`saved ~${formatDuration(savedMs)}`);
  if (fallbacks > 0) parts.push(`${fallbacks} on Mock (daily limit)`);
  return parts.join(' · ');
}
```

- [ ] **Step 4: Implement the API, the session and the queries**

`apps/web/src/entities/run/api/run-api.ts`:
```ts
import { runIdResponseSchema, runSchema, type CreateRunBody, type Graph, type Run } from '@trafaret/core';
import { http, request } from '@/shared/api';

export async function createRun(graph: Graph): Promise<string> {
  const body: CreateRunBody = { graph };
  const { runId } = await request(http.post('runs', { json: body }).json(runIdResponseSchema));
  return runId;
}

export const fetchRun = (runId: string, signal?: AbortSignal): Promise<Run> =>
  request(http.get(`runs/${encodeURIComponent(runId)}`, { signal }).json(runSchema));

/** No request body: the node to retry is in the path. */
export async function retryNode(runId: string, nodeId: string): Promise<void> {
  const path = `runs/${encodeURIComponent(runId)}/nodes/${encodeURIComponent(nodeId)}/retry`;
  await request(http.post(path).json(runIdResponseSchema));
}
```

`apps/web/src/entities/run/model/run-session.ts`:
```ts
import { create } from 'zustand';
import type { Graph } from '@trafaret/core';

type RunSessionState = {
  activeRunId: string | null;
  /** The graph the active run was started with: it tells which nodes were edited since. */
  submittedGraph: Graph | null;
  start: (runId: string, graph: Graph) => void;
  clear: () => void;
};

/** The run the editor is showing. Not saved: after a reload, Run again — unchanged nodes come from the cache. */
export const useRunSession = create<RunSessionState>()((set) => ({
  activeRunId: null,
  submittedGraph: null,
  start: (activeRunId, submittedGraph) => set({ activeRunId, submittedGraph }),
  clear: () => set({ activeRunId: null, submittedGraph: null }),
}));
```

`apps/web/src/entities/run/model/run-query.ts` — one poller, many readers (each polling observer would run its own timer):
```ts
import { mutationOptions, queryOptions, useIsMutating, useQuery } from '@tanstack/react-query';
import { isTerminalRunStatus, type Job, type Run } from '@trafaret/core';
import { createRun, fetchRun } from '../api/run-api';
import { keepNewerRun } from '../lib/keep-newer-run';
import { useRunSession } from './run-session';

export const POLL_INTERVAL_MS = 700;

export const runQueryKey = (runId: string) => ['runs', runId] as const;

export const runQueryOptions = (runId: string) =>
  queryOptions({
    queryKey: runQueryKey(runId),
    queryFn: ({ signal }) => fetchRun(runId, signal),
    // This cache entry only ever holds runs.
    structuralSharing: (previous: unknown, next: unknown) =>
      keepNewerRun(previous as Run | undefined, next as Run),
  });

export const startRunMutation = mutationOptions({ mutationKey: ['runs', 'start'], mutationFn: createRun });

/** Polls the active run until it ends. Mount it once: every polling observer would add its own timer. */
export function useRunPolling(): void {
  const runId = useRunSession((state) => state.activeRunId);
  useQuery({
    ...runQueryOptions(runId ?? ''),
    enabled: runId !== null,
    refetchInterval: (query) => {
      const run = query.state.data;
      if (query.state.status === 'error' || (run && isTerminalRunStatus(run.status))) return false;
      return POLL_INTERVAL_MS;
    },
  });
}

/** The active run as last polled. Reading it never sends a request. */
export function useActiveRunQuery() {
  const runId = useRunSession((state) => state.activeRunId);
  return useQuery({ ...runQueryOptions(runId ?? ''), enabled: false });
}

export const useActiveRun = (): Run | undefined => useActiveRunQuery().data;

export function useNodeJob(nodeId: string | null): Job | undefined {
  const run = useActiveRun();
  return nodeId === null ? undefined : run?.jobs[nodeId];
}

/** True while a run is being started or is still going: Run and 🎲 wait for it to end. */
export function useIsRunBusy(): boolean {
  const starting = useIsMutating({ mutationKey: startRunMutation.mutationKey }) > 0;
  const runId = useRunSession((state) => state.activeRunId);
  const { data: run, isError } = useActiveRunQuery();
  return starting || (runId !== null && !isError && (!run || !isTerminalRunStatus(run.status)));
}
```

`apps/web/src/entities/run/ui/JobStatusBadge.tsx`:
```tsx
import type { ComponentProps } from 'react';
import type { JobStatus } from '@trafaret/core';
import { formatSeconds } from '@/shared/lib';
import { Badge, Spinner } from '@/shared/ui';
import { JOB_STATUS_LABEL } from '../lib/job-status';

const TONE: Readonly<Record<JobStatus, ComponentProps<typeof Badge>['tone']>> = {
  idle: 'neutral',
  queued: 'neutral',
  running: 'accent',
  success: 'success',
  error: 'error',
};

export function JobStatusBadge({
  status,
  elapsedMs = null,
}: {
  status: JobStatus;
  elapsedMs?: number | null;
}) {
  return (
    <Badge tone={TONE[status]}>
      {status === 'running' && <Spinner size="sm" />}
      {status === 'success' && '✓ '}
      {JOB_STATUS_LABEL[status]}
      {status === 'running' && elapsedMs !== null && ` · ${formatSeconds(elapsedMs)}`}
    </Badge>
  );
}
```

`apps/web/src/entities/run/index.ts`:
```ts
export { isNodeEdited, jobDurationMs, JOB_STATUS_LABEL, retryTarget } from './lib/job-status';
export { formatRunSummary } from './lib/run-summary';
export { layoutTimeline, type TimelineBar, type TimelineLayout } from './lib/timeline';
export { retryNode } from './api/run-api';
export {
  runQueryKey,
  startRunMutation,
  useActiveRun,
  useActiveRunQuery,
  useIsRunBusy,
  useNodeJob,
  useRunPolling,
} from './model/run-query';
export { useRunSession } from './model/run-session';
export { JobStatusBadge } from './ui/JobStatusBadge';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project @trafaret/web entities/run`
Expected: PASS (22 tests).

- [ ] **Step 6: Run the gate**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): add the run entity — polling, timeline layout, status helpers"
```

---

### Task 7: Node entity — the card frame and typed handles

The look every node card shares: a frame whose outline shows the job status (dashed while queued, a pulsing accent ring while running, red on error) with the category, title, an "edited" marker, a badge slot and the node's issues; and a port handle coloured by its type that lights up or dims while a wire is dragged. Layout only — the cards themselves are composed in Task 11.

**Files:**
- Create: `apps/web/src/entities/node/config/layout.ts`, `apps/web/src/entities/node/ui/{NodeShell.tsx, NodeShell.module.css, PortHandle.tsx, PortHandle.module.css}`, `apps/web/src/entities/node/index.ts`
- Test: `apps/web/src/entities/node/ui/NodeShell.test.tsx`

**Interfaces:**
- Consumes: `cx` from `@/shared/lib`; `Handle`, `Position` from `@xyflow/react`; `Issue`, `JobStatus`, `NodeCategory`, `PortType` from `@trafaret/core`.
- Produces, from `@/entities/node`:
  - `NODE_CARD_WIDTH = 264`, `HANDLE_TOP = { first: 52, second: 88 }`
  - `NodeShell({ title, category, status, selected, badge?, edited?, issues?, handles, children? })` — an `<article>` named by its title, with `data-status`
  - `PortHandle({ direction: 'input' | 'output', handle, portType, label, top?, compatible?: boolean | null })`

- [ ] **Step 1: Write the failing test**

`apps/web/src/entities/node/ui/NodeShell.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NodeShell } from './NodeShell';

describe('NodeShell', () => {
  it('frames a card with its category, title and status', () => {
    render(
      <NodeShell
        title="Generate Image"
        category="generation"
        status="running"
        selected={false}
        handles={null}
      >
        body
      </NodeShell>,
    );
    const card = screen.getByRole('article', { name: 'Generate Image' });
    expect(card).toHaveAttribute('data-status', 'running');
    expect(card).toHaveTextContent('Generation');
    expect(card).toHaveTextContent('body');
  });

  it('shows the edited marker and the issues found on the node', () => {
    const issues = [{ code: 'MISSING_VALUE' as const, message: 'Write a prompt.', nodeId: 'p1' }];
    render(
      <NodeShell
        title="Prompt"
        category="input"
        status="idle"
        selected
        edited
        issues={issues}
        handles={null}
      />,
    );
    expect(screen.getByText('● edited')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('Write a prompt.');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --project @trafaret/web entities/node`
Expected: FAIL — `./NodeShell` doesn't exist yet.

- [ ] **Step 3: Implement the frame and the handle**

`apps/web/src/entities/node/config/layout.ts`:
```ts
/** Every node card has the same width, so new nodes can be centred and wires line up. */
export const NODE_CARD_WIDTH = 264;
/** Handles sit at fixed heights, so wires stay put when a card grows (for example when its output arrives). */
export const HANDLE_TOP = { first: 52, second: 88 } as const;
```

`apps/web/src/entities/node/ui/NodeShell.tsx`:
```tsx
import type { ReactNode } from 'react';
import type { Issue, JobStatus, NodeCategory } from '@trafaret/core';
import { cx } from '@/shared/lib';
import { NODE_CARD_WIDTH } from '../config/layout';
import styles from './NodeShell.module.css';

const CATEGORY_LABEL: Readonly<Record<NodeCategory, string>> = {
  input: 'Input',
  generation: 'Generation',
  output: 'Output',
};

type NodeShellProps = {
  title: string;
  category: NodeCategory;
  /** Drives the outline: dashed while queued, an accent ring while running, red on error. */
  status: JobStatus;
  selected: boolean;
  /** Shown next to the title, e.g. the job's status badge. */
  badge?: ReactNode;
  edited?: boolean;
  issues?: readonly Issue[];
  /** The card's port handles; React Flow places them on its edges. */
  handles: ReactNode;
  children?: ReactNode;
};

/** The frame every node card shares. Layout only: the card's content comes from its widget. */
export function NodeShell({
  title,
  category,
  status,
  selected,
  badge,
  edited = false,
  issues = [],
  handles,
  children,
}: NodeShellProps) {
  return (
    <article
      aria-label={title}
      data-status={status}
      className={cx(styles.card, styles[status], selected && styles.selected)}
      style={{ width: NODE_CARD_WIDTH }}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.category}>{CATEGORY_LABEL[category]}</span>
          <h3 className={styles.title}>{title}</h3>
        </div>
        {edited && (
          <span className={styles.edited} title="Changed since the last run">
            ● edited
          </span>
        )}
        {badge}
      </header>
      {children && <div className={styles.body}>{children}</div>}
      {issues.length > 0 && (
        <ul className={styles.issues}>
          {issues.map((issue) => (
            <li key={`${issue.code}:${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      )}
      {handles}
    </article>
  );
}
```

`apps/web/src/entities/node/ui/NodeShell.module.css`:
```css
.card {
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  box-shadow: 0 2px 10px rgb(0 0 0 / 30%);
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease;
}

.selected {
  border-color: var(--text-muted);
}

.queued {
  border-style: dashed;
  border-color: var(--border-strong);
}

.running {
  border-color: var(--accent);
  animation: pulse 1.4s ease-in-out infinite;
}

.error {
  border-color: var(--error);
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 2px rgb(255 95 31 / 35%);
  }

  50% {
    box-shadow: 0 0 0 6px rgb(255 95 31 / 12%);
  }
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.heading {
  flex: 1;
  min-width: 0;
}

.category {
  display: block;
  font: 500 10px/1.2 var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.edited {
  font-size: 11px;
  color: var(--warning);
  white-space: nowrap;
}

.body {
  display: grid;
  gap: 10px;
  padding: 12px;
}

.issues {
  margin: 0;
  padding: 8px 12px 10px 28px;
  border-top: 1px solid var(--border);
  color: var(--error);
  font-size: 12px;
}
```

`apps/web/src/entities/node/ui/PortHandle.tsx`:
```tsx
import { Handle, Position } from '@xyflow/react';
import type { PortType } from '@trafaret/core';
import { cx } from '@/shared/lib';
import { HANDLE_TOP } from '../config/layout';
import styles from './PortHandle.module.css';

type PortHandleProps = {
  direction: 'input' | 'output';
  handle: string;
  portType: PortType;
  label: string;
  /** Distance from the top of the card in px. */
  top?: number;
  /** While a wire is being dragged: whether it may end here. Null when no wire is dragged. */
  compatible?: boolean | null;
};

/** A typed port: coloured by its type, labelled, and lit up or dimmed while a wire is dragged. */
export function PortHandle({
  direction,
  handle,
  portType,
  label,
  top = HANDLE_TOP.first,
  compatible = null,
}: PortHandleProps) {
  const input = direction === 'input';
  return (
    <Handle
      id={handle}
      type={input ? 'target' : 'source'}
      position={input ? Position.Left : Position.Right}
      className={cx(
        styles.handle,
        styles[portType],
        compatible === true && styles.compatible,
        compatible === false && styles.dimmed,
      )}
      style={{ top }}
      title={`${label} (${portType})`}
    >
      <span className={cx(styles.label, input ? styles.inputLabel : styles.outputLabel)}>{label}</span>
    </Handle>
  );
}
```

`apps/web/src/entities/node/ui/PortHandle.module.css` — the label sits outside the card, above the wire:
```css
.handle {
  width: 12px;
  height: 12px;
  border: 2px solid var(--bg-surface);
  background: var(--port);
  transition:
    box-shadow 120ms ease,
    opacity 120ms ease;
}

.text {
  --port: var(--port-text);
}

.image {
  --port: var(--port-image);
}

.compatible {
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--port) 35%, transparent);
}

.dimmed {
  opacity: 0.25;
}

.label {
  position: absolute;
  bottom: 12px;
  font: 600 10px/1 var(--font-mono);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--port);
  white-space: nowrap;
  pointer-events: none;
}

.inputLabel {
  right: 2px;
}

.outputLabel {
  left: 2px;
}
```

`apps/web/src/entities/node/index.ts`:
```ts
export { HANDLE_TOP, NODE_CARD_WIDTH } from './config/layout';
export { NodeShell } from './ui/NodeShell';
export { PortHandle } from './ui/PortHandle';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run --project @trafaret/web entities/node`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the gate**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): add the node card frame and typed handles"
```

---

### Task 8: Canvas editing — add nodes, wiring rules, delete

Three user actions on the canvas. **add-node**: a palette grouped Input / Generation / Output that drops a node in the middle of the visible canvas, clear of the cards already there. **connect-nodes**: the canvas accepts a wire only when `canConnect` (from core) allows it; while a wire is dragged, compatible handles light up, the others dim, and over a handle it can't connect to the wire turns red and says why. **delete-selection**: the toolbar twin of the Delete key.

**Files:**
- Create: `apps/web/src/features/add-node/{lib/free-position.ts, model/use-add-node.ts, ui/NodePalette.tsx, ui/NodePalette.module.css, index.ts}`
- Create: `apps/web/src/features/connect-nodes/{lib/check-wire.ts, model/use-connection-rules.ts, model/use-handle-compatibility.ts, ui/ConnectionLine.tsx, ui/ConnectionLine.module.css, index.ts}`
- Create: `apps/web/src/features/delete-selection/{ui/DeleteSelectionButton.tsx, index.ts}`
- Test: `apps/web/src/features/add-node/lib/free-position.test.ts`, `apps/web/src/features/connect-nodes/lib/check-wire.test.ts`

**Interfaces:**
- Consumes: `useWorkflowStore`, `createNode`, `getWorkflowGraph`, `FlowNode`, `FlowEdge` from `@/entities/workflow`; `useCatalog`, `defaultModelId` from `@/entities/catalog`; `NODE_CARD_WIDTH` from `@/entities/node`; `Button`, `toast` from `@/shared/ui`; `canConnect`, `indexGraph`, `NODE_DEFINITIONS`, `NODE_TYPES`, `isAiNodeType` from `@trafaret/core`.
- Produces:
  - `@/features/add-node`: `NodePalette`
  - `@/features/connect-nodes`: `useConnectionRules(): { isValidConnection: IsValidConnection<FlowEdge>; onConnect: (connection) => void }`, `useHandleCompatibility(nodeId, handleId, type: HandleType): boolean | null`, `ConnectionLine` (a `connectionLineComponent`)
  - `@/features/delete-selection`: `DeleteSelectionButton`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/features/add-node/lib/free-position.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { freePosition } from './free-position';

const size = { width: 264, height: 240 };

describe('freePosition', () => {
  it('uses the desired spot when nothing is in the way', () => {
    expect(freePosition({ x: 100, y: 100 }, size, [])).toEqual({ x: 100, y: 100 });
    expect(freePosition({ x: 100, y: 100 }, size, [{ x: 400, y: 100, width: 264, height: 300 }])).toEqual({
      x: 100,
      y: 100,
    });
  });

  it('steps down and to the right until the new node clears the cards in the way', () => {
    const card = { x: 80, y: 80, width: 264, height: 300 };
    expect(freePosition({ x: 100, y: 100 }, size, [card])).toEqual({ x: 388, y: 388 });
  });

  it('gives up on a canvas too crowded to find room', () => {
    const wall = { x: -10_000, y: -10_000, width: 20_000, height: 20_000 };
    expect(freePosition({ x: 100, y: 100 }, size, [wall])).toEqual({ x: 100, y: 100 });
  });
});
```

`apps/web/src/features/connect-nodes/lib/check-wire.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Graph } from '@trafaret/core';
import { branchingGraph, edge, editNode, imageInputNode, promptNode } from '@trafaret/core/testing';
import { checkWire, type WireEnd } from './check-wire';

const output = (nodeId: string): WireEnd => ({ nodeId, handleId: 'out', type: 'source' });
const input = (nodeId: string, handleId: string): WireEnd => ({ nodeId, handleId, type: 'target' });

describe('checkWire', () => {
  const graph = branchingGraph();

  it('accepts a text output into a free prompt input, whichever end the drag started from', () => {
    const free: Graph = {
      nodes: [...graph.nodes, promptNode('p2')],
      edges: graph.edges.filter((wire) => wire.target !== 'gen-b'),
    };
    expect(checkWire(free, output('p2'), input('gen-b', 'prompt'))).toEqual({ ok: true });
    expect(checkWire(free, input('gen-b', 'prompt'), output('p2'))).toEqual({ ok: true });
  });

  it('explains why an image cannot feed a prompt input', () => {
    expect(checkWire(graph, output('gen-a'), input('gen-b', 'prompt'))).toMatchObject({
      ok: false,
      reason: "Image output can't feed a text input.",
    });
  });

  it('refuses a second wire into a connected input', () => {
    const withSecondPrompt: Graph = { ...graph, nodes: [...graph.nodes, promptNode('p2')] };
    expect(checkWire(withSecondPrompt, output('p2'), input('gen-a', 'prompt'))).toMatchObject({
      ok: false,
      reason: 'The Prompt input is already connected.',
    });
  });

  it('refuses a loop', () => {
    const chain: Graph = {
      nodes: [imageInputNode('photo'), editNode('edit-a'), editNode('edit-b')],
      edges: [edge('edit-a', 'edit-b', 'image')],
    };
    expect(checkWire(chain, output('edit-b'), input('edit-a', 'image'))).toMatchObject({
      ok: false,
      reason: 'This connection would create a loop.',
    });
  });

  it('asks for an output on one end and an input on the other', () => {
    expect(checkWire(graph, output('gen-a'), output('gen-b'))).toMatchObject({
      ok: false,
      reason: 'Connect an output to an input.',
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project @trafaret/web features/add-node features/connect-nodes`
Expected: FAIL — the modules don't exist yet.

- [ ] **Step 3: Implement add-node**

`apps/web/src/features/add-node/lib/free-position.ts`:
```ts
import type { XYPosition } from '@xyflow/react';

export type Rect = XYPosition & { width: number; height: number };

const STEP = 48;
const MAX_STEPS = 40;
const GAP = 24;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width + GAP &&
  b.x < a.x + a.width + GAP &&
  a.y < b.y + b.height + GAP &&
  b.y < a.y + a.height + GAP;

/**
 * `desired`, or the first spot down and to the right of it where a node of `size` overlaps no other node.
 * On a canvas too crowded for that it gives up and returns `desired`.
 */
export function freePosition(
  desired: XYPosition,
  size: { width: number; height: number },
  taken: readonly Rect[],
): XYPosition {
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const spot = { x: desired.x + step * STEP, y: desired.y + step * STEP };
    if (!taken.some((rect) => overlaps({ ...spot, ...size }, rect))) return spot;
  }
  return desired;
}
```

`apps/web/src/features/add-node/model/use-add-node.ts` — the visible centre comes from React Flow's store (`width`, `height`, `transform`):
```ts
import { useStoreApi } from '@xyflow/react';
import { isAiNodeType, type NodeType } from '@trafaret/core';
import { defaultModelId, useCatalog } from '@/entities/catalog';
import { NODE_CARD_WIDTH } from '@/entities/node';
import { createNode, useWorkflowStore } from '@/entities/workflow';
import { toast } from '@/shared/ui';
import { freePosition } from '../lib/free-position';

const GRID = 16;
/** A typical card height, for cards React Flow hasn't measured yet and for the card being added. */
const CARD_HEIGHT = 240;
const snap = (value: number): number => Math.round(value / GRID) * GRID;

/** Adds a node in the middle of the visible canvas, clear of the cards already there. */
export function useAddNode(): { addNode: (type: NodeType) => void; modelsReady: boolean } {
  const flow = useStoreApi();
  const { data: models } = useCatalog();
  const add = useWorkflowStore((state) => state.addNode);

  const addNode = (type: NodeType): void => {
    const modelId = defaultModelId(models ?? [], type === 'editImage' ? 'edit' : 'generate');
    if (isAiNodeType(type) && modelId === null) {
      toast.error('No image model is available.', ['Check that the server is running.']);
      return;
    }
    // The centre of the visible canvas, in canvas coordinates.
    const {
      width,
      height,
      transform: [panX, panY, zoom],
    } = flow.getState();
    const centre = {
      x: snap((width / 2 - panX) / zoom - NODE_CARD_WIDTH / 2),
      y: snap((height / 2 - panY) / zoom - CARD_HEIGHT / 2),
    };
    const taken = useWorkflowStore.getState().nodes.map((node) => ({
      ...node.position,
      width: node.measured?.width ?? NODE_CARD_WIDTH,
      height: node.measured?.height ?? CARD_HEIGHT,
    }));
    const position = freePosition(centre, { width: NODE_CARD_WIDTH, height: CARD_HEIGHT }, taken);
    // Only Generate and Edit nodes use the model id; for them it was checked above.
    add(createNode(type, position, modelId ?? ''));
  };

  return { addNode, modelsReady: models !== undefined };
}
```

`apps/web/src/features/add-node/ui/NodePalette.tsx`:
```tsx
import { isAiNodeType, NODE_DEFINITIONS, NODE_TYPES, type NodeCategory } from '@trafaret/core';
import { Button } from '@/shared/ui';
import { useAddNode } from '../model/use-add-node';
import styles from './NodePalette.module.css';

const GROUPS: ReadonlyArray<{ category: NodeCategory; label: string }> = [
  { category: 'input', label: 'Input' },
  { category: 'generation', label: 'Generation' },
  { category: 'output', label: 'Output' },
];

export function NodePalette() {
  const { addNode, modelsReady } = useAddNode();
  return (
    <div role="group" aria-label="Add a node" className={styles.palette}>
      {GROUPS.map((group) => (
        <div key={group.category} role="group" aria-label={group.label} className={styles.group}>
          <span className={styles.caption} aria-hidden="true">
            {group.label}
          </span>
          {NODE_TYPES.filter((type) => NODE_DEFINITIONS[type].category === group.category).map((type) => (
            <Button
              key={type}
              size="sm"
              aria-label={`Add ${NODE_DEFINITIONS[type].label}`}
              disabled={isAiNodeType(type) && !modelsReady}
              onClick={() => addNode(type)}
            >
              <span aria-hidden="true">+</span>
              {NODE_DEFINITIONS[type].label}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
```

`apps/web/src/features/add-node/ui/NodePalette.module.css`:
```css
.palette {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
}

.group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.caption {
  font: 500 10px/1 var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}
```

`apps/web/src/features/add-node/index.ts`:
```ts
export { NodePalette } from './ui/NodePalette';
```

- [ ] **Step 4: Implement connect-nodes**

`apps/web/src/features/connect-nodes/lib/check-wire.ts`:
```ts
import { canConnect, indexGraph, type ConnectResult, type Graph } from '@trafaret/core';

/** One end of a wire, as React Flow reports it while the wire is dragged. */
export type WireEnd = { nodeId: string; handleId: string | null | undefined; type: 'source' | 'target' };

/** Checks a wire dragged from either end against the one wiring rule. */
export function checkWire(graph: Graph, from: WireEnd, to: WireEnd): ConnectResult {
  if (from.type === to.type) {
    return { ok: false, code: 'PORT_TYPE_MISMATCH', reason: 'Connect an output to an input.' };
  }
  const [source, target] = from.type === 'source' ? [from, to] : [to, from];
  return canConnect(indexGraph(graph), {
    source: source.nodeId,
    sourceHandle: source.handleId ?? null,
    target: target.nodeId,
    targetHandle: target.handleId ?? null,
  });
}
```

`apps/web/src/features/connect-nodes/model/use-connection-rules.ts`:
```ts
import type { IsValidConnection } from '@xyflow/react';
import { canConnect, indexGraph } from '@trafaret/core';
import { getWorkflowGraph, useWorkflowStore, type FlowEdge } from '@/entities/workflow';

/** The canvas's wiring callbacks: a wire is only accepted when the shared rule allows it. */
export function useConnectionRules() {
  const onConnect = useWorkflowStore((state) => state.connect);
  const isValidConnection: IsValidConnection<FlowEdge> = (wire) =>
    canConnect(indexGraph(getWorkflowGraph()), {
      source: wire.source,
      sourceHandle: wire.sourceHandle ?? null,
      target: wire.target,
      targetHandle: wire.targetHandle ?? null,
    }).ok;
  return { isValidConnection, onConnect };
}
```

`apps/web/src/features/connect-nodes/model/use-handle-compatibility.ts`:
```ts
import { useConnection, type HandleType } from '@xyflow/react';
import { getWorkflowGraph } from '@/entities/workflow';
import { checkWire } from '../lib/check-wire';

/**
 * While a wire is being dragged: whether it may end on this handle, so only compatible handles light up.
 * Null when no wire is dragged, and for the handle the wire starts from.
 */
export function useHandleCompatibility(nodeId: string, handleId: string, type: HandleType): boolean | null {
  // Three primitive selections, so the card re-renders when a drag starts or ends — not on every mouse move.
  const fromNodeId = useConnection((connection) => connection.fromHandle?.nodeId ?? null);
  const fromHandleId = useConnection((connection) => connection.fromHandle?.id ?? null);
  const fromType = useConnection((connection) => connection.fromHandle?.type ?? null);
  if (fromNodeId === null || fromType === null) return null;
  if (fromNodeId === nodeId && fromHandleId === handleId) return null;
  const from = { nodeId: fromNodeId, handleId: fromHandleId, type: fromType };
  return checkWire(getWorkflowGraph(), from, { nodeId, handleId, type }).ok;
}
```

`apps/web/src/features/connect-nodes/ui/ConnectionLine.tsx`:
```tsx
import { getBezierPath, type ConnectionLineComponentProps, type Handle } from '@xyflow/react';
import { getWorkflowGraph, type FlowNode } from '@/entities/workflow';
import { cx } from '@/shared/lib';
import { checkWire, type WireEnd } from '../lib/check-wire';
import styles from './ConnectionLine.module.css';

const wireEnd = (handle: Handle): WireEnd => ({
  nodeId: handle.nodeId,
  handleId: handle.id,
  type: handle.type,
});

/** The wire being dragged. Over a handle it can't connect to, it turns red and says why. */
export function ConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  fromHandle,
  toHandle,
}: ConnectionLineComponentProps<FlowNode>) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });
  const verdict = toHandle ? checkWire(getWorkflowGraph(), wireEnd(fromHandle), wireEnd(toHandle)) : null;
  const reason = verdict && !verdict.ok ? verdict.reason : null;
  return (
    <g className={cx(styles.wire, reason !== null && styles.rejected)}>
      <path d={path} className={styles.path} />
      {reason !== null && (
        <foreignObject x={toX + 14} y={toY - 18} width={240} height={56}>
          <p role="status" className={styles.reason}>
            {reason}
          </p>
        </foreignObject>
      )}
    </g>
  );
}
```

`apps/web/src/features/connect-nodes/ui/ConnectionLine.module.css`:
```css
.path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
}

.rejected .path {
  stroke: var(--error);
  stroke-dasharray: 6 4;
}

.reason {
  display: inline-block;
  margin: 0;
  padding: 6px 8px;
  border: 1px solid var(--error);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text);
  font-size: 12px;
  line-height: 1.3;
}
```

`apps/web/src/features/connect-nodes/index.ts`:
```ts
export { useConnectionRules } from './model/use-connection-rules';
export { useHandleCompatibility } from './model/use-handle-compatibility';
export { ConnectionLine } from './ui/ConnectionLine';
```

- [ ] **Step 5: Implement delete-selection**

`apps/web/src/features/delete-selection/ui/DeleteSelectionButton.tsx`:
```tsx
import { useReactFlow } from '@xyflow/react';
import { useWorkflowStore, type FlowEdge, type FlowNode } from '@/entities/workflow';
import { Button } from '@/shared/ui';

/** The toolbar twin of the Delete key, for touch screens and for discoverability. */
export function DeleteSelectionButton() {
  const { deleteElements } = useReactFlow<FlowNode, FlowEdge>();
  const count = useWorkflowStore(
    (state) =>
      state.nodes.filter((node) => node.selected).length + state.edges.filter((edge) => edge.selected).length,
  );
  const deleteSelection = (): void => {
    const { nodes, edges } = useWorkflowStore.getState();
    // Through React Flow, so the wires of deleted nodes go too.
    void deleteElements({
      nodes: nodes.filter((node) => node.selected),
      edges: edges.filter((edge) => edge.selected),
    });
  };
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={count === 0}
      title="Delete the selection (Delete or Backspace)"
      onClick={deleteSelection}
    >
      Delete{count > 0 && ` (${count})`}
    </Button>
  );
}
```

`apps/web/src/features/delete-selection/index.ts`:
```ts
export { DeleteSelectionButton } from './ui/DeleteSelectionButton';
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project @trafaret/web features/add-node features/connect-nodes`
Expected: PASS (8 tests).

- [ ] **Step 7: Run the gate**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): add node placement, wiring rules and deletion"
```

---

### Task 9: Running — run the workflow, retry a node, regenerate with a new seed

**run-workflow** checks the graph with core's `validateGraph` first (issues go onto their nodes and into a toast — "Fix 2 issues to run."), then starts a run; the server may still find issues (unknown preset, expired upload) and they are shown the same way. ⌘/Ctrl + Enter runs from anywhere. **retry-node** re-runs a failed node in the same run and refetches the run at once. **regenerate-node** rolls a new seed; the card that hosts the 🎲 button then starts a run (Task 11 composes the two — features don't import each other).

**Files:**
- Create: `apps/web/src/features/run-workflow/{lib/describe-issues.ts, model/use-run-workflow.ts, model/use-run-shortcut.ts, ui/RunButton.tsx, index.ts}`
- Create: `apps/web/src/features/retry-node/{model/use-retry-node.ts, ui/RetryButton.tsx, index.ts}`
- Create: `apps/web/src/features/regenerate-node/{model/use-regenerate-node.ts, ui/RegenerateButton.tsx, index.ts}`
- Test: `apps/web/src/features/run-workflow/lib/describe-issues.test.ts`

**Interfaces:**
- Consumes: `startRunMutation`, `useIsRunBusy`, `useRunSession`, `retryNode`, `runQueryKey` from `@/entities/run`; `getWorkflowGraph`, `useWorkflowStore` from `@/entities/workflow`; `toApiError` from `@/shared/api`; `Button`, `Spinner`, `toast` from `@/shared/ui`; `validateGraph`, `randomSeed` from `@trafaret/core`.
- Produces:
  - `@/features/run-workflow`: `useRunWorkflow(): { run: () => void; busy: boolean }`, `RunButton` (accessible name "Run", or "Running…" while busy)
  - `@/features/retry-node`: `RetryButton({ runId, nodeId })`
  - `@/features/regenerate-node`: `RegenerateButton({ nodeId, type: AiNodeType, disabled?, onRegenerated: () => void })` (accessible name "Regenerate with a new seed")

- [ ] **Step 1: Write the failing test**

`apps/web/src/features/run-workflow/lib/describe-issues.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { describeIssues } from './describe-issues';

describe('describeIssues', () => {
  it('lets a single issue speak for itself', () => {
    const issues = [{ code: 'MISSING_VALUE' as const, message: 'Write a prompt.', nodeId: 'p1' }];
    expect(describeIssues(issues)).toEqual({ title: 'Write a prompt.', details: [] });
  });

  it('counts several issues and lists the ones no node can show', () => {
    const issues = [
      { code: 'MISSING_INPUT' as const, message: 'The Image input needs a connection.', nodeId: 'r1' },
      {
        code: 'NOTHING_TO_RUN' as const,
        message: 'Add a Generate Image or Edit Image node to run the workflow.',
      },
    ];
    expect(describeIssues(issues)).toEqual({
      title: 'Fix 2 issues to run.',
      details: ['Add a Generate Image or Edit Image node to run the workflow.'],
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --project @trafaret/web features/run-workflow`
Expected: FAIL — `./describe-issues` doesn't exist yet.

- [ ] **Step 3: Implement run-workflow**

`apps/web/src/features/run-workflow/lib/describe-issues.ts`:
```ts
import type { Issue } from '@trafaret/core';
import { pluralize } from '@/shared/lib';

/**
 * The toast for a run that can't start. One issue speaks for itself; several get a count, and the ones that
 * belong to no node (such as "add a Generate node") are listed, since no card can show them.
 */
export function describeIssues(issues: readonly Issue[]): { title: string; details: string[] } {
  const [only] = issues;
  if (issues.length === 1 && only) return { title: only.message, details: [] };
  return {
    title: `Fix ${pluralize(issues.length, 'issue')} to run.`,
    details: issues.filter((issue) => issue.nodeId === undefined).map((issue) => issue.message),
  };
}
```

`apps/web/src/features/run-workflow/model/use-run-workflow.ts`:
```ts
import { useMutation } from '@tanstack/react-query';
import { validateGraph, type Issue } from '@trafaret/core';
import { startRunMutation, useIsRunBusy, useRunSession } from '@/entities/run';
import { getWorkflowGraph, useWorkflowStore } from '@/entities/workflow';
import { toApiError } from '@/shared/api';
import { toast } from '@/shared/ui';
import { describeIssues } from '../lib/describe-issues';

/** Checks the workflow with the same rules as the server, then starts a run of it. */
export function useRunWorkflow(): { run: () => void; busy: boolean } {
  const busy = useIsRunBusy();
  const startSession = useRunSession((state) => state.start);
  const setIssues = useWorkflowStore((state) => state.setIssues);
  const { mutate } = useMutation(startRunMutation);

  // Issues go onto their nodes and into a toast.
  const report = (issues: readonly Issue[]): void => {
    setIssues(issues);
    const { title, details } = describeIssues(issues);
    toast.error(title, details);
  };

  const run = (): void => {
    if (busy) return;
    const graph = getWorkflowGraph();
    const issues = validateGraph(graph);
    if (issues.length > 0) {
      report(issues);
      return;
    }
    mutate(graph, {
      onSuccess: (runId) => {
        setIssues([]);
        startSession(runId, graph);
      },
      onError: (error) => {
        // The server re-checks the graph (models, presets, uploads) and may still find issues.
        const apiError = toApiError(error);
        if (apiError.issues.length > 0) report(apiError.issues);
        else toast.error(apiError.message);
      },
    });
  };

  return { run, busy };
}
```

`apps/web/src/features/run-workflow/model/use-run-shortcut.ts` (`useEffectEvent`, stable since React 19.2, keeps the listener from re-subscribing on every render):
```ts
import { useEffect, useEffectEvent } from 'react';

/** ⌘/Ctrl + Enter runs the workflow from anywhere on the page, even while typing a prompt. */
export function useRunShortcut(run: () => void): void {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    run();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
```

`apps/web/src/features/run-workflow/ui/RunButton.tsx`:
```tsx
import { Button, Spinner } from '@/shared/ui';
import { useRunShortcut } from '../model/use-run-shortcut';
import { useRunWorkflow } from '../model/use-run-workflow';

const SHORTCUT = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘↵' : 'Ctrl ↵';

export function RunButton() {
  const { run, busy } = useRunWorkflow();
  useRunShortcut(run);
  return (
    <Button variant="primary" disabled={busy} onClick={run} title={`Run the workflow (${SHORTCUT})`}>
      {busy ? <Spinner size="sm" /> : <span aria-hidden="true">▶</span>}
      {busy ? 'Running…' : 'Run'}
      <kbd aria-hidden="true">{SHORTCUT}</kbd>
    </Button>
  );
}
```

`apps/web/src/features/run-workflow/index.ts`:
```ts
export { useRunWorkflow } from './model/use-run-workflow';
export { RunButton } from './ui/RunButton';
```

- [ ] **Step 4: Implement retry-node and regenerate-node**

`apps/web/src/features/retry-node/model/use-retry-node.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { retryNode, runQueryKey } from '@/entities/run';
import { toApiError } from '@/shared/api';
import { toast } from '@/shared/ui';

type RetryTarget = { runId: string; nodeId: string };

export function useRetryNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, nodeId }: RetryTarget) => retryNode(runId, nodeId),
    // Fetch the run at once: it is running again, so polling carries on from there.
    onSuccess: (_, { runId }) => queryClient.invalidateQueries({ queryKey: runQueryKey(runId) }),
    onError: (error) => toast.error(toApiError(error).message),
  });
}
```

`apps/web/src/features/retry-node/ui/RetryButton.tsx`:
```tsx
import { Button } from '@/shared/ui';
import { useRetryNode } from '../model/use-retry-node';

/** Re-runs a failed node (and the nodes it skipped) in the same run. Never automatic: a retry may cost money. */
export function RetryButton({ runId, nodeId }: { runId: string; nodeId: string }) {
  const { mutate, isPending } = useRetryNode();
  return (
    <Button size="sm" disabled={isPending} onClick={() => mutate({ runId, nodeId })}>
      {isPending ? 'Retrying…' : 'Retry'}
    </Button>
  );
}
```

`apps/web/src/features/retry-node/index.ts`:
```ts
export { RetryButton } from './ui/RetryButton';
```

`apps/web/src/features/regenerate-node/model/use-regenerate-node.ts`:
```ts
import { randomSeed, type AiNodeType } from '@trafaret/core';
import { useWorkflowStore } from '@/entities/workflow';

/** Rolls a new seed for a Generate or Edit node: a new cache key, so its next run renders a new image. */
export function useRegenerateNode(): (nodeId: string, type: AiNodeType) => void {
  const update = useWorkflowStore((state) => state.updateNodeData);
  return (nodeId, type) => update(nodeId, type, { seed: randomSeed() });
}
```

`apps/web/src/features/regenerate-node/ui/RegenerateButton.tsx`:
```tsx
import type { AiNodeType } from '@trafaret/core';
import { Button } from '@/shared/ui';
import { useRegenerateNode } from '../model/use-regenerate-node';

type RegenerateButtonProps = {
  nodeId: string;
  type: AiNodeType;
  disabled?: boolean;
  /** Called after the new seed is set; the card starts a run from here. */
  onRegenerated: () => void;
};

export function RegenerateButton({ nodeId, type, disabled = false, onRegenerated }: RegenerateButtonProps) {
  const regenerate = useRegenerateNode();
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label="Regenerate with a new seed"
      title="New seed, then run"
      disabled={disabled}
      onClick={() => {
        regenerate(nodeId, type);
        onRegenerated();
      }}
    >
      <span aria-hidden="true">🎲</span>
    </Button>
  );
}
```

`apps/web/src/features/regenerate-node/index.ts`:
```ts
export { RegenerateButton } from './ui/RegenerateButton';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run --project @trafaret/web features/run-workflow`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the gate**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): run workflows, retry failed nodes, regenerate with a new seed"
```

---

### Task 10: Workflow in and out — upload a photo, templates, export and import

**upload-image**: the Image Input body — drop or choose a photo (checked against the server's limits before it is sent), a preview, a spinner while uploading, the error if any, and "Use the sample photo". **load-template**: the four spec templates (§8.6) as graph builders with fresh ids and seeds on every load, a toolbar menu, large buttons for the empty canvas, and the first-visit starter ("One prompt, two styles"). **export-import**: an export is exactly the body of `POST /api/runs`; import also accepts a bare graph and refuses anything else.

**Files:**
- Create: `apps/web/src/features/upload-image/{model/use-upload-image.ts, ui/ImageUpload.tsx, ui/ImageUpload.module.css, index.ts}`
- Create: `apps/web/src/features/load-template/{model/templates.ts, model/use-load-template.ts, model/use-starter-workflow.ts, ui/TemplateMenu.tsx, ui/TemplateMenu.module.css, ui/TemplateButtons.tsx, ui/TemplateButtons.module.css, index.ts}`
- Create: `apps/web/src/features/export-import/{lib/workflow-file.ts, ui/ExportImportButtons.tsx, index.ts}`
- Test: `apps/web/src/features/load-template/model/templates.test.ts`, `apps/web/src/features/export-import/lib/workflow-file.test.ts`

**Interfaces:**
- Consumes: `uploadAsset`, `uploadProblem`, `useSamples` from `@/entities/asset`; `useCatalog`, `defaultModelId` from `@/entities/catalog`; `useRunSession` from `@/entities/run`; `useWorkflowStore`, `getWorkflowGraph` from `@/entities/workflow`; `toApiError` from `@/shared/api`; `downloadJson` from `@/shared/lib`; `Button`, `Dropzone`, `Select`, `Spinner`, `toast` from `@/shared/ui`; `graphSchema`, `assetUrl`, `UPLOAD_LIMITS`, `randomSeed` from `@trafaret/core`.
- Produces:
  - `@/features/upload-image`: `ImageUpload({ nodeId, assetId: string | null })`
  - `@/features/load-template`: `useStarterWorkflow(): void`, `TemplateMenu` (a select named "Load a template", option values `text-to-image` · `edit-photo` · `two-styles` · `product-two-styles`), `TemplateButtons`
  - `@/features/export-import`: `ExportImportButtons`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/features/load-template/model/templates.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { validateGraph, type Graph } from '@trafaret/core';
import { instantiateTemplate, TEMPLATE_IDS, type TemplateContext } from './templates';

const context: TemplateContext = {
  modelId: 'flux-2-klein',
  editModelId: 'mock',
  sampleAssetId: 'a'.repeat(64),
};
const seeds = (graph: Graph) => graph.nodes.flatMap((node) => ('seed' in node.data ? [node.data.seed] : []));

describe('templates', () => {
  it('build workflows that pass validation as they are', () => {
    for (const id of TEMPLATE_IDS) expect(validateGraph(instantiateTemplate(id, context))).toEqual([]);
  });

  it('give every node a fresh id and seed on each load', () => {
    const first = instantiateTemplate('two-styles', context);
    const second = instantiateTemplate('two-styles', context);
    const firstIds = new Set(first.nodes.map((node) => node.id));
    expect(second.nodes.some((node) => firstIds.has(node.id))).toBe(false);
    expect(seeds(second)).not.toEqual(seeds(first));
  });

  it('use the given models and sample photo', () => {
    const graph = instantiateTemplate('product-two-styles', context);
    for (const node of graph.nodes) {
      if (node.type === 'editImage') expect(node.data.modelId).toBe('mock');
      if (node.type === 'imageInput') expect(node.data.assetId).toBe(context.sampleAssetId);
    }
    const generate = instantiateTemplate('text-to-image', context).nodes.find(
      (node) => node.type === 'generateImage',
    );
    expect(generate?.data).toMatchObject({ modelId: 'flux-2-klein' });
  });

  it('leave the photo empty when the server has no sample', () => {
    const graph = instantiateTemplate('edit-photo', { ...context, sampleAssetId: null });
    expect(validateGraph(graph)).toEqual([
      expect.objectContaining({ code: 'MISSING_VALUE', message: 'Upload an image.' }),
    ]);
  });

  it('cover the branching scenario: one prompt into two Generate nodes with different presets', () => {
    const graph = instantiateTemplate('two-styles', context);
    const presets = graph.nodes.flatMap((node) =>
      node.type === 'generateImage' ? [node.data.presetId] : [],
    );
    expect(presets).toEqual(['premium-3d', 'lifestyle']);
    expect(graph.edges.filter((edge) => edge.targetHandle === 'prompt')).toHaveLength(2);
  });
});
```

`apps/web/src/features/export-import/lib/workflow-file.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { branchingGraph, promptNode } from '@trafaret/core/testing';
import { parseWorkflowFile, toWorkflowFile } from './workflow-file';

describe('workflow files', () => {
  it('reads back what it exports', () => {
    const graph = branchingGraph();
    expect(parseWorkflowFile(JSON.stringify(toWorkflowFile(graph)))).toEqual(graph);
  });

  it('also reads a bare graph', () => {
    expect(parseWorkflowFile(JSON.stringify(branchingGraph()))).toEqual(branchingGraph());
  });

  it('refuses text that is not a workflow', () => {
    expect(parseWorkflowFile('not json')).toBeNull();
    expect(parseWorkflowFile(JSON.stringify({ graph: { nodes: 'none' } }))).toBeNull();
  });

  it('refuses repeated node ids', () => {
    const graph = branchingGraph();
    const repeated = { ...graph, nodes: [...graph.nodes, promptNode('prompt')] };
    expect(parseWorkflowFile(JSON.stringify(repeated))).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project @trafaret/web features/load-template features/export-import`
Expected: FAIL — the modules don't exist yet.

- [ ] **Step 3: Implement upload-image**

`apps/web/src/features/upload-image/model/use-upload-image.ts`:
```ts
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { uploadAsset, uploadProblem } from '@/entities/asset';
import { useWorkflowStore } from '@/entities/workflow';
import { toApiError } from '@/shared/api';

/** Uploads a photo for an Image Input node, checking the server's limits first. */
export function useUploadImage(nodeId: string) {
  const update = useWorkflowStore((state) => state.updateNodeData);
  const [problem, setProblem] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: uploadAsset,
    onSuccess: (asset) => update(nodeId, 'imageInput', { assetId: asset.assetId }),
  });

  const upload = (file: File): void => {
    const reason = uploadProblem(file);
    setProblem(reason);
    if (reason === null) mutation.mutate(file);
  };
  const pickAsset = (assetId: string): void => update(nodeId, 'imageInput', { assetId });

  return {
    upload,
    pickAsset,
    uploading: mutation.isPending,
    error: problem ?? (mutation.error ? toApiError(mutation.error).message : null),
  };
}
```

`apps/web/src/features/upload-image/ui/ImageUpload.tsx`:
```tsx
import { assetUrl, UPLOAD_LIMITS } from '@trafaret/core';
import { useSamples } from '@/entities/asset';
import { Button, Dropzone, Spinner } from '@/shared/ui';
import { useUploadImage } from '../model/use-upload-image';
import styles from './ImageUpload.module.css';

export function ImageUpload({ nodeId, assetId }: { nodeId: string; assetId: string | null }) {
  const { upload, pickAsset, uploading, error } = useUploadImage(nodeId);
  const sample = useSamples().data?.[0];
  return (
    <div className={styles.upload}>
      <Dropzone
        label={assetId ? 'Replace image' : 'Upload image'}
        accept={UPLOAD_LIMITS.mimeTypes.join(',')}
        onFile={upload}
        disabled={uploading}
      >
        {assetId ? (
          <img src={assetUrl(assetId)} alt="Uploaded image" className={styles.preview} />
        ) : (
          <span>Drop an image here or click to choose one</span>
        )}
        {uploading && (
          <span className={styles.overlay}>
            <Spinner label="Uploading" />
          </span>
        )}
      </Dropzone>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {!assetId && sample && (
        <Button size="sm" variant="ghost" onClick={() => pickAsset(sample.assetId)}>
          Use the sample photo
        </Button>
      )}
    </div>
  );
}
```

`apps/web/src/features/upload-image/ui/ImageUpload.module.css`:
```css
.upload {
  display: grid;
  gap: 8px;
}

.preview {
  width: 100%;
  max-height: 180px;
  object-fit: contain;
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(18 18 20 / 70%);
  color: var(--accent);
}

.error {
  margin: 0;
  color: var(--error);
  font-size: 12px;
}
```

`apps/web/src/features/upload-image/index.ts`:
```ts
export { ImageUpload } from './ui/ImageUpload';
```

- [ ] **Step 4: Implement load-template**

`apps/web/src/features/load-template/model/templates.ts` — the typed `graph()` helper makes TypeScript check each node literal against its own node type:
```ts
import { nanoid } from 'nanoid';
import { randomSeed, type Graph, type GraphEdge, type GraphNode, type InputHandle } from '@trafaret/core';

export const TEMPLATE_IDS = ['text-to-image', 'edit-photo', 'two-styles', 'product-two-styles'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const isTemplateId = (value: unknown): value is TemplateId => TEMPLATE_IDS.some((id) => id === value);

/** What a template takes from the server: models for its AI nodes and the pinned sample photo. */
export type TemplateContext = { modelId: string; editModelId: string; sampleAssetId: string | null };

type Template = { name: string; description: string; build: (context: TemplateContext) => Graph };

// Typed parameters, so each node literal is checked against its own node type.
const graph = (nodes: GraphNode[], edges: GraphEdge[]): Graph => ({ nodes, edges });

const wire = (source: string, target: string, targetHandle: InputHandle): GraphEdge => ({
  id: nanoid(),
  source,
  sourceHandle: 'out',
  target,
  targetHandle,
});

/** Every build gives fresh node ids and seeds, so a template can be loaded again and again. */
export const TEMPLATES: Readonly<Record<TemplateId, Template>> = {
  'text-to-image': {
    name: 'Text → Image',
    description: 'A prompt, one Generate Image node and its result.',
    build: ({ modelId }) => {
      const [prompt, generate, result] = [nanoid(), nanoid(), nanoid()];
      return graph(
        [
          {
            id: prompt,
            type: 'prompt',
            position: { x: 0, y: 40 },
            data: { text: 'A white sneaker on a stone pedestal, soft morning light' },
          },
          {
            id: generate,
            type: 'generateImage',
            position: { x: 340, y: 0 },
            data: { modelId, presetId: null, aspectRatio: '1:1', seed: randomSeed() },
          },
          { id: result, type: 'result', position: { x: 680, y: 0 }, data: {} },
        ],
        [wire(prompt, generate, 'prompt'), wire(generate, result, 'image')],
      );
    },
  },
  'edit-photo': {
    name: 'Edit a photo',
    description: 'The sample photo, one Edit Image node and its result.',
    build: ({ editModelId, sampleAssetId }) => {
      const [photo, edit, result] = [nanoid(), nanoid(), nanoid()];
      return graph(
        [
          { id: photo, type: 'imageInput', position: { x: 0, y: 0 }, data: { assetId: sampleAssetId } },
          {
            id: edit,
            type: 'editImage',
            position: { x: 340, y: 0 },
            data: {
              instruction: 'Put the product on a sunlit marble kitchen counter',
              modelId: editModelId,
              presetId: null,
              seed: randomSeed(),
            },
          },
          { id: result, type: 'result', position: { x: 680, y: 0 }, data: {} },
        ],
        [wire(photo, edit, 'image'), wire(edit, result, 'image')],
      );
    },
  },
  'two-styles': {
    name: 'One prompt, two styles',
    description: 'One prompt rendered twice in parallel, with the Premium 3D and Lifestyle presets.',
    build: ({ modelId }) => {
      const [prompt, generateA, generateB, resultA, resultB] = [
        nanoid(),
        nanoid(),
        nanoid(),
        nanoid(),
        nanoid(),
      ];
      return graph(
        [
          {
            id: prompt,
            type: 'prompt',
            position: { x: 0, y: 220 },
            data: { text: 'A ceramic coffee mug with steam rising, on a wooden table' },
          },
          {
            id: generateA,
            type: 'generateImage',
            position: { x: 340, y: 0 },
            data: { modelId, presetId: 'premium-3d', aspectRatio: '1:1', seed: randomSeed() },
          },
          {
            id: generateB,
            type: 'generateImage',
            position: { x: 340, y: 480 },
            data: { modelId, presetId: 'lifestyle', aspectRatio: '1:1', seed: randomSeed() },
          },
          { id: resultA, type: 'result', position: { x: 680, y: 0 }, data: {} },
          { id: resultB, type: 'result', position: { x: 680, y: 480 }, data: {} },
        ],
        [
          wire(prompt, generateA, 'prompt'),
          wire(prompt, generateB, 'prompt'),
          wire(generateA, resultA, 'image'),
          wire(generateB, resultB, 'image'),
        ],
      );
    },
  },
  'product-two-styles': {
    name: 'Product shot → two styles',
    description: 'Clean up the sample photo once, then restyle it twice: Premium 3D and Paper Craft.',
    build: ({ editModelId, sampleAssetId }) => {
      const [photo, clean, editA, editB, resultA, resultB] = [
        nanoid(),
        nanoid(),
        nanoid(),
        nanoid(),
        nanoid(),
        nanoid(),
      ];
      const restyle = (presetId: string) => ({
        instruction: 'Keep the product exactly as it is and restyle the scene around it',
        modelId: editModelId,
        presetId,
        seed: randomSeed(),
      });
      return graph(
        [
          { id: photo, type: 'imageInput', position: { x: 0, y: 220 }, data: { assetId: sampleAssetId } },
          {
            id: clean,
            type: 'editImage',
            position: { x: 340, y: 220 },
            data: {
              instruction: 'Place the product on a seamless white studio background',
              modelId: editModelId,
              presetId: null,
              seed: randomSeed(),
            },
          },
          { id: editA, type: 'editImage', position: { x: 680, y: 0 }, data: restyle('premium-3d') },
          { id: editB, type: 'editImage', position: { x: 680, y: 480 }, data: restyle('paper-craft') },
          { id: resultA, type: 'result', position: { x: 1020, y: 0 }, data: {} },
          { id: resultB, type: 'result', position: { x: 1020, y: 480 }, data: {} },
        ],
        [
          wire(photo, clean, 'image'),
          wire(clean, editA, 'image'),
          wire(clean, editB, 'image'),
          wire(editA, resultA, 'image'),
          wire(editB, resultB, 'image'),
        ],
      );
    },
  },
};

export const instantiateTemplate = (id: TemplateId, context: TemplateContext): Graph =>
  TEMPLATES[id].build(context);
```

`apps/web/src/features/load-template/model/use-load-template.ts` (React Flow 12 queues `fitView` until the new nodes are measured):
```ts
import { useReactFlow } from '@xyflow/react';
import { useSamples } from '@/entities/asset';
import { defaultModelId, useCatalog } from '@/entities/catalog';
import { useRunSession } from '@/entities/run';
import { useWorkflowStore } from '@/entities/workflow';
import { toast } from '@/shared/ui';
import { instantiateTemplate, type TemplateId } from './templates';

/** Replaces the canvas with a template, built with the server's models and sample photo. */
export function useLoadTemplate(): { load: (id: TemplateId) => void; ready: boolean } {
  const { data: models } = useCatalog();
  const samples = useSamples();
  const replaceGraph = useWorkflowStore((state) => state.replaceGraph);
  const clearRun = useRunSession((state) => state.clear);
  const { fitView } = useReactFlow();

  const load = (id: TemplateId): void => {
    const modelId = defaultModelId(models ?? [], 'generate');
    const editModelId = defaultModelId(models ?? [], 'edit');
    if (modelId === null || editModelId === null) {
      toast.error('No image model is available.', ['Check that the server is running.']);
      return;
    }
    replaceGraph(
      instantiateTemplate(id, { modelId, editModelId, sampleAssetId: samples.data?.[0]?.assetId ?? null }),
    );
    clearRun();
    // React Flow waits until the new nodes are measured.
    void fitView({ padding: 0.15, maxZoom: 1 });
  };

  return { load, ready: models !== undefined && !samples.isPending };
}
```

`apps/web/src/features/load-template/model/use-starter-workflow.ts`:
```ts
import { useEffect, useEffectEvent } from 'react';
import { useWorkflowStore } from '@/entities/workflow';
import type { TemplateId } from './templates';
import { useLoadTemplate } from './use-load-template';

const STARTER: TemplateId = 'two-styles';

/** On a first visit (nothing saved yet) the canvas opens with the branching workflow, ready to run. */
export function useStarterWorkflow(): void {
  const needsStarter = useWorkflowStore((state) => state.needsStarter);
  const { load, ready } = useLoadTemplate();
  const placeStarter = useEffectEvent(() => {
    // Read the live value: in development React runs effects twice, and the first run already placed it.
    if (useWorkflowStore.getState().needsStarter) load(STARTER);
  });
  useEffect(() => {
    if (needsStarter && ready) placeStarter();
  }, [needsStarter, ready]);
}
```

`apps/web/src/features/load-template/ui/TemplateMenu.tsx`:
```tsx
import { useWorkflowStore } from '@/entities/workflow';
import { Select } from '@/shared/ui';
import { isTemplateId, TEMPLATE_IDS, TEMPLATES } from '../model/templates';
import { useLoadTemplate } from '../model/use-load-template';
import styles from './TemplateMenu.module.css';

export function TemplateMenu() {
  const { load, ready } = useLoadTemplate();
  return (
    <Select
      aria-label="Load a template"
      className={styles.menu}
      value=""
      disabled={!ready}
      onChange={(event) => {
        const id = event.target.value;
        if (!isTemplateId(id)) return;
        const hasWork = useWorkflowStore.getState().nodes.length > 0;
        if (hasWork && !window.confirm('Replace the current workflow with this template?')) return;
        load(id);
      }}
    >
      <option value="" disabled>
        Templates…
      </option>
      {TEMPLATE_IDS.map((id) => (
        <option key={id} value={id}>
          {TEMPLATES[id].name}
        </option>
      ))}
    </Select>
  );
}
```

`apps/web/src/features/load-template/ui/TemplateMenu.module.css`:
```css
.menu {
  width: 180px;
}
```

`apps/web/src/features/load-template/ui/TemplateButtons.tsx`:
```tsx
import { TEMPLATE_IDS, TEMPLATES } from '../model/templates';
import { useLoadTemplate } from '../model/use-load-template';
import styles from './TemplateButtons.module.css';

/** The templates as large buttons, for the empty canvas. */
export function TemplateButtons() {
  const { load, ready } = useLoadTemplate();
  return (
    <ul className={styles.templates}>
      {TEMPLATE_IDS.map((id) => (
        <li key={id}>
          <button type="button" className={styles.template} disabled={!ready} onClick={() => load(id)}>
            <span className={styles.name}>{TEMPLATES[id].name}</span>
            <span className={styles.description}>{TEMPLATES[id].description}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

`apps/web/src/features/load-template/ui/TemplateButtons.module.css`:
```css
.templates {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.template {
  display: grid;
  gap: 4px;
  width: 100%;
  height: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  text-align: left;
  cursor: pointer;
}

.template:hover:not(:disabled) {
  border-color: var(--accent);
}

.template:disabled {
  opacity: 0.5;
  cursor: progress;
}

.name {
  font-weight: 600;
}

.description {
  color: var(--text-muted);
  font-size: 12px;
}
```

`apps/web/src/features/load-template/index.ts`:
```ts
export { useStarterWorkflow } from './model/use-starter-workflow';
export { TemplateButtons } from './ui/TemplateButtons';
export { TemplateMenu } from './ui/TemplateMenu';
```

- [ ] **Step 5: Implement export-import**

`apps/web/src/features/export-import/lib/workflow-file.ts`:
```ts
import { graphSchema, type CreateRunBody, type Graph } from '@trafaret/core';

export const WORKFLOW_FILE_NAME = 'trafaret-workflow.json';

/** An export is exactly the body of POST /api/runs, so `curl -d @trafaret-workflow.json …` runs it as it is. */
export const toWorkflowFile = (graph: Graph): CreateRunBody => ({ graph });

const unique = (ids: readonly string[]): boolean => new Set(ids).size === ids.length;

/** Reads an exported workflow, or a bare graph. Null for anything else, including repeated ids. */
export function parseWorkflowFile(text: string): Graph | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const candidate = typeof json === 'object' && json !== null && 'graph' in json ? json.graph : json;
  const parsed = graphSchema.safeParse(candidate);
  if (!parsed.success) return null;
  const { nodes, edges } = parsed.data;
  // The canvas keys nodes and wires by id; repeated ids would confuse it.
  return unique(nodes.map((node) => node.id)) && unique(edges.map((edge) => edge.id)) ? parsed.data : null;
}
```

`apps/web/src/features/export-import/ui/ExportImportButtons.tsx`:
```tsx
import { useReactFlow } from '@xyflow/react';
import { useRef } from 'react';
import { useRunSession } from '@/entities/run';
import { getWorkflowGraph, useWorkflowStore } from '@/entities/workflow';
import { downloadJson } from '@/shared/lib';
import { Button, toast } from '@/shared/ui';
import { parseWorkflowFile, toWorkflowFile, WORKFLOW_FILE_NAME } from '../lib/workflow-file';

export function ExportImportButtons() {
  const replaceGraph = useWorkflowStore((state) => state.replaceGraph);
  const clearRun = useRunSession((state) => state.clear);
  const { fitView } = useReactFlow();
  const fileInput = useRef<HTMLInputElement>(null);

  const importFile = async (file: File): Promise<void> => {
    const graph = parseWorkflowFile(await file.text());
    if (!graph) {
      toast.error("This file isn't a Trafaret workflow.", ['Export a workflow to see the expected format.']);
      return;
    }
    replaceGraph(graph);
    clearRun();
    void fitView({ padding: 0.15, maxZoom: 1 });
    toast.info(`Imported ${file.name}.`);
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
        Import
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Workflow file to import"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void importFile(file);
        }}
      />
      <Button
        size="sm"
        variant="ghost"
        title="Download the workflow as JSON — the same body POST /api/runs takes"
        onClick={() => downloadJson(WORKFLOW_FILE_NAME, toWorkflowFile(getWorkflowGraph()))}
      >
        Export
      </Button>
    </>
  );
}
```

`apps/web/src/features/export-import/index.ts`:
```ts
export { ExportImportButtons } from './ui/ExportImportButtons';
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project @trafaret/web features/load-template features/export-import`
Expected: PASS (9 tests).

- [ ] **Step 7: Run the gate**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): upload photos, load templates, export and import workflows"
```

---

### Task 11: Workflow canvas widget and the five node cards

The canvas: React Flow controlled by the workflow store, with the wiring rules and the custom connection line from Task 8, wires coloured by port type and animated while the node they feed runs, Delete/Backspace and Esc, box selection with Shift, a dot grid, snap-to-grid, a minimap and zoom controls, and the template buttons on an empty canvas. The cards compose entities and features and hold layout only: Prompt (auto-growing text, character count), Image Input (upload), Generate Image (model with disabled reasons, preset with reference thumbnails, aspect ratio, seed + 🎲, output thumbnail), Edit Image (instruction — disabled with "Using connected prompt" when a prompt is wired — edit-capable models, preset, seed + 🎲) and Result (large preview, download, ⚡ reused / Mock badges). Any failed card shows its message and, when it can help, Retry; a skipped node retries its root cause.

**Files:**
- Create: `apps/web/src/widgets/workflow-canvas/model/use-node-view.ts`
- Create: `apps/web/src/widgets/workflow-canvas/ui/{WorkflowCanvas.tsx, WorkflowCanvas.module.css, EmptyCanvas.tsx}`
- Create: `apps/web/src/widgets/workflow-canvas/ui/nodes/{parts.tsx, PromptNode.tsx, ImageInputNode.tsx, GenerateImageNode.tsx, EditImageNode.tsx, ResultNode.tsx, nodes.module.css}`
- Create: `apps/web/src/widgets/workflow-canvas/index.ts`
- Test: `apps/web/src/widgets/workflow-canvas/ui/WorkflowCanvas.test.tsx`

**Interfaces:**
- Consumes: Tasks 4–10 — `useWorkflowStore`, `useNodeIssues`, `useUpstreamNodeId`, `FlowNodeOf` (workflow); `useActiveRun`, `useNodeJob`, `useRunSession`, `isNodeEdited`, `retryTarget`, `JobStatusBadge` (run); `NodeShell`, `PortHandle`, `HANDLE_TOP` (node); `ModelSelect`, `supportedAspectRatio`, `useCatalog` (catalog); `PresetSelect`, `PresetReferences`, `usePresets` (preset); `ConnectionLine`, `useConnectionRules`, `useHandleCompatibility` (connect-nodes); `ImageUpload`; `RetryButton`; `RegenerateButton`; `useRunWorkflow`; `TemplateButtons`.
- Produces, from `@/widgets/workflow-canvas`: `WorkflowCanvas`. Cards carry React Flow's class `react-flow__node-<type>`; result images have the alt text "Result"; failures are `role="alert"`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/widgets/workflow-canvas/ui/WorkflowCanvas.test.tsx` — jsdom has no layout, so the test installs React Flow's documented shims (`ResizeObserver` with a `contentRect`, `DOMMatrixReadOnly`, element sizes) and seeds the query cache, so nothing is fetched:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ImageModel, Preset } from '@trafaret/core';
import { edge, editNode, generateNode, imageInputNode, promptNode, resultNode } from '@trafaret/core/testing';
import { samplesQuery } from '@/entities/asset';
import { catalogQuery } from '@/entities/catalog';
import { presetsQuery } from '@/entities/preset';
import { useWorkflowStore } from '@/entities/workflow';
import { WorkflowCanvas } from './WorkflowCanvas';

/** jsdom has no layout: React Flow's documented test shims, so nodes count as measured and render. */
function mockReactFlow(): void {
  class ResizeObserver {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element): void {
      this.callback([{ target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry], this);
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  class DOMMatrixReadOnly {
    m22: number;
    constructor(transform?: string) {
      const scale = /scale\(([\d.]+)\)/.exec(transform ?? '')?.[1];
      this.m22 = scale === undefined ? 1 : Number(scale);
    }
  }
  Object.assign(globalThis, { ResizeObserver, DOMMatrixReadOnly });
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: {
      get(this: HTMLElement) {
        return parseFloat(this.style.height) || 1;
      },
    },
    offsetWidth: {
      get(this: HTMLElement) {
        return parseFloat(this.style.width) || 1;
      },
    },
  });
}

const mock: ImageModel = {
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
  aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
  costPerImageUsd: 0,
};
const premium: Preset = {
  id: 'premium-3d',
  name: 'Premium 3D',
  mainPrompt: '',
  negativePrompt: '',
  references: [],
};

function renderCanvas() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(catalogQuery.queryKey, [mock]);
  queryClient.setQueryData(presetsQuery.queryKey, [premium]);
  queryClient.setQueryData(samplesQuery.queryKey, []);
  return render(
    <QueryClientProvider client={queryClient}>
      <ReactFlowProvider>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowCanvas />
        </div>
      </ReactFlowProvider>
    </QueryClientProvider>,
  );
}

beforeAll(mockReactFlow);
beforeEach(() => useWorkflowStore.setState({ nodes: [], edges: [], issues: [], needsStarter: false }));

describe('WorkflowCanvas', () => {
  it('renders a card for every node type, showing its settings', async () => {
    useWorkflowStore.getState().replaceGraph({
      nodes: [
        promptNode('prompt', 'A paper boat'),
        generateNode('generate', { presetId: 'premium-3d' }),
        imageInputNode('photo', null),
        editNode('edit'),
        resultNode('result'),
      ],
      edges: [
        edge('prompt', 'generate', 'prompt'),
        edge('photo', 'edit', 'image'),
        edge('generate', 'result', 'image'),
      ],
    });
    renderCanvas();
    const generate = await screen.findByRole('article', { name: 'Generate Image' });
    expect(within(generate).getByRole('combobox', { name: /^Preset/ })).toHaveValue('premium-3d');
    expect(screen.getByRole('textbox', { name: 'Prompt' })).toHaveValue('A paper boat');
    expect(screen.getByRole('article', { name: 'Image Input' })).toHaveTextContent('Drop an image here');
    expect(screen.getByRole('article', { name: 'Edit Image' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Result' })).toHaveTextContent(
      'Run the workflow to see the image here.',
    );
  });

  it('offers the templates on an empty canvas', () => {
    renderCanvas();
    expect(screen.getByRole('heading', { name: 'Start from a template or add a node' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /One prompt, two styles/ })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --project @trafaret/web widgets/workflow-canvas`
Expected: FAIL — `./WorkflowCanvas` doesn't exist yet.

- [ ] **Step 3: Implement the per-node view and the shared card parts**

`apps/web/src/widgets/workflow-canvas/model/use-node-view.ts`:
```ts
import type { Issue, Job, JobStatus } from '@trafaret/core';
import { isNodeEdited, useNodeJob, useRunSession } from '@/entities/run';
import { useNodeIssues } from '@/entities/workflow';
import { useNow } from '@/shared/lib';

export type NodeView = {
  runId: string | null;
  job: Job | undefined;
  status: JobStatus;
  edited: boolean;
  issues: Issue[];
  /** How long the job has been running; null unless it is running. */
  elapsedMs: number | null;
};

/** What a card shows besides its settings: its job in the active run, its issues, and whether it was edited. */
export function useNodeView(nodeId: string, data: Readonly<Record<string, unknown>>): NodeView {
  const runId = useRunSession((state) => state.activeRunId);
  const submitted = useRunSession((state) => state.submittedGraph);
  const job = useNodeJob(nodeId);
  const issues = useNodeIssues(nodeId);
  const runningSince = job?.status === 'running' ? job.startedAt : null;
  const now = useNow(runningSince !== null, 500);
  return {
    runId,
    job,
    status: job?.status ?? 'idle',
    edited: isNodeEdited(nodeId, data, submitted),
    issues,
    elapsedMs: runningSince === null ? null : Math.max(0, now - runningSince),
  };
}
```

`apps/web/src/widgets/workflow-canvas/ui/nodes/parts.tsx` — here 🎲 is composed with a run (`RegenerateButton` + `useRunWorkflow`):
```tsx
import type { AiNodeType, Job } from '@trafaret/core';
import { retryTarget } from '@/entities/run';
import { RegenerateButton } from '@/features/regenerate-node';
import { RetryButton } from '@/features/retry-node';
import { useRunWorkflow } from '@/features/run-workflow';
import { Badge } from '@/shared/ui';
import styles from './nodes.module.css';

/** Where an image came from: reused from the cache, made by Mock, or by Mock because the daily limit was hit. */
export function JobBadges({ job }: { job: Job | undefined }) {
  if (!job) return null;
  const fallbackFrom = job.model?.fallbackFrom;
  return (
    <>
      {job.cached && (
        <Badge tone="accent" title="Nothing it depends on changed, so the earlier image was reused.">
          ⚡ reused
        </Badge>
      )}
      {fallbackFrom ? (
        <Badge
          tone="warning"
          title={`The daily limit for ${fallbackFrom} was reached, so Mock made this image.`}
        >
          Mock · daily limit
        </Badge>
      ) : (
        job.model?.provider === 'mock' && <Badge>Mock</Badge>
      )}
    </>
  );
}

/** A thumbnail of the image a Generate or Edit node made in the active run; the Result node shows it large. */
export function OutputPreview({ job }: { job: Job | undefined }) {
  if (job?.output?.kind !== 'image') return null;
  return (
    <figure className={styles.output}>
      <img src={job.output.url} alt="Generated image" width={72} height={72} className={styles.thumbnail} />
      <figcaption className={styles.badges}>
        <JobBadges job={job} />
      </figcaption>
    </figure>
  );
}

/** A failed job's message, with Retry when it can help — for a skipped node, Retry goes to the cause. */
export function JobError({ job, runId }: { job: Job | undefined; runId: string | null }) {
  if (job?.status !== 'error' || !job.error) return null;
  const target = retryTarget(job);
  return (
    <div role="alert" className={styles.error}>
      <p className={styles.errorMessage}>{job.error.message}</p>
      {target !== null && runId !== null && <RetryButton runId={runId} nodeId={target} />}
    </div>
  );
}

/** The seed, and 🎲: a new seed followed by a run, so only this node and what depends on it re-render. */
export function SeedField({ nodeId, type, seed }: { nodeId: string; type: AiNodeType; seed: number }) {
  const { run, busy } = useRunWorkflow();
  return (
    <div className={styles.seed}>
      <span className={styles.seedLabel}>Seed</span>
      <div className={styles.seedControl}>
        <span className={styles.seedValue}>{seed}</span>
        <RegenerateButton nodeId={nodeId} type={type} disabled={busy} onRegenerated={run} />
      </div>
    </div>
  );
}
```

`apps/web/src/widgets/workflow-canvas/ui/nodes/nodes.module.css`:
```css
.fields {
  display: grid;
  gap: 10px;
}

.counter {
  justify-self: end;
  font: 500 11px/1 var(--font-mono);
  color: var(--text-muted);
}

.over {
  color: var(--error);
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.seed {
  display: grid;
  gap: 4px;
}

.seedLabel {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.seedControl {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 30px;
}

.seedValue {
  flex: 1;
  overflow: hidden;
  font: 500 12px/1 var(--font-mono);
  text-overflow: ellipsis;
}

.output {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.thumbnail {
  flex: none;
  width: 72px;
  height: 72px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.result {
  display: grid;
  gap: 8px;
  margin: 0;
}

.resultImage {
  width: 100%;
  height: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-canvas);
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.resultFooter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.download {
  color: var(--port-image);
  font-size: 13px;
  font-weight: 500;
}

.placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 24px 8px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 13px;
  justify-content: center;
  text-align: center;
}

.error {
  display: grid;
  gap: 8px;
  justify-items: start;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: rgb(255 90 95 / 10%);
}

.errorMessage {
  margin: 0;
  color: var(--error);
  font-size: 12px;
}
```

- [ ] **Step 4: Implement the five cards**

`apps/web/src/widgets/workflow-canvas/ui/nodes/PromptNode.tsx`:
```tsx
import type { NodeProps } from '@xyflow/react';
import { LIMITS } from '@trafaret/core';
import { NodeShell, PortHandle } from '@/entities/node';
import { useWorkflowStore, type FlowNodeOf } from '@/entities/workflow';
import { useHandleCompatibility } from '@/features/connect-nodes';
import { cx } from '@/shared/lib';
import { Textarea } from '@/shared/ui';
import { useNodeView } from '../../model/use-node-view';
import styles from './nodes.module.css';

const count = (value: number): string => value.toLocaleString('en-US');

export function PromptNode({ id, data, selected }: NodeProps<FlowNodeOf<'prompt'>>) {
  const view = useNodeView(id, data);
  const update = useWorkflowStore((state) => state.updateNodeData);
  const out = useHandleCompatibility(id, 'out', 'source');
  return (
    <NodeShell
      title="Prompt"
      category="input"
      status={view.status}
      selected={selected}
      edited={view.edited}
      issues={view.issues}
      handles={<PortHandle direction="output" handle="out" portType="text" label="Text" compatible={out} />}
    >
      <Textarea
        aria-label="Prompt"
        className="nodrag nowheel"
        placeholder="Describe the image you want…"
        value={data.text}
        onChange={(event) => update(id, 'prompt', { text: event.target.value })}
      />
      <span className={cx(styles.counter, data.text.length > LIMITS.textLength && styles.over)}>
        {count(data.text.length)} / {count(LIMITS.textLength)}
      </span>
    </NodeShell>
  );
}
```

`apps/web/src/widgets/workflow-canvas/ui/nodes/ImageInputNode.tsx`:
```tsx
import type { NodeProps } from '@xyflow/react';
import { NodeShell, PortHandle } from '@/entities/node';
import type { FlowNodeOf } from '@/entities/workflow';
import { useHandleCompatibility } from '@/features/connect-nodes';
import { ImageUpload } from '@/features/upload-image';
import { useNodeView } from '../../model/use-node-view';
import { JobError } from './parts';

export function ImageInputNode({ id, data, selected }: NodeProps<FlowNodeOf<'imageInput'>>) {
  const view = useNodeView(id, data);
  const out = useHandleCompatibility(id, 'out', 'source');
  return (
    <NodeShell
      title="Image Input"
      category="input"
      status={view.status}
      selected={selected}
      edited={view.edited}
      issues={view.issues}
      handles={<PortHandle direction="output" handle="out" portType="image" label="Image" compatible={out} />}
    >
      <div className="nodrag">
        <ImageUpload nodeId={id} assetId={data.assetId} />
      </div>
      <JobError job={view.job} runId={view.runId} />
    </NodeShell>
  );
}
```

`apps/web/src/widgets/workflow-canvas/ui/nodes/GenerateImageNode.tsx`:
```tsx
import type { NodeProps } from '@xyflow/react';
import { ASPECT_RATIOS, isAspectRatio } from '@trafaret/core';
import { ModelSelect, supportedAspectRatio, useCatalog } from '@/entities/catalog';
import { NodeShell, PortHandle } from '@/entities/node';
import { PresetReferences, PresetSelect, usePresets } from '@/entities/preset';
import { JobStatusBadge } from '@/entities/run';
import { useWorkflowStore, type FlowNodeOf } from '@/entities/workflow';
import { useHandleCompatibility } from '@/features/connect-nodes';
import { cx } from '@/shared/lib';
import { Field, Select } from '@/shared/ui';
import { useNodeView } from '../../model/use-node-view';
import { JobError, OutputPreview, SeedField } from './parts';
import styles from './nodes.module.css';

export function GenerateImageNode({ id, data, selected }: NodeProps<FlowNodeOf<'generateImage'>>) {
  const view = useNodeView(id, data);
  const update = useWorkflowStore((state) => state.updateNodeData);
  const models = useCatalog().data ?? [];
  const presets = usePresets().data ?? [];
  const promptIn = useHandleCompatibility(id, 'prompt', 'target');
  const out = useHandleCompatibility(id, 'out', 'source');
  const model = models.find((candidate) => candidate.id === data.modelId);

  const changeModel = (modelId: string): void => {
    const next = models.find((candidate) => candidate.id === modelId);
    update(id, 'generateImage', {
      modelId,
      ...(next && { aspectRatio: supportedAspectRatio(next, data.aspectRatio) }),
    });
  };

  return (
    <NodeShell
      title="Generate Image"
      category="generation"
      status={view.status}
      selected={selected}
      edited={view.edited}
      issues={view.issues}
      badge={view.job && <JobStatusBadge status={view.status} elapsedMs={view.elapsedMs} />}
      handles={
        <>
          <PortHandle
            direction="input"
            handle="prompt"
            portType="text"
            label="Prompt"
            compatible={promptIn}
          />
          <PortHandle direction="output" handle="out" portType="image" label="Image" compatible={out} />
        </>
      }
    >
      <div className={cx(styles.fields, 'nodrag')}>
        <Field label="Model">
          <ModelSelect models={models} value={data.modelId} onChange={changeModel} />
        </Field>
        <Field label="Preset">
          <PresetSelect
            presets={presets}
            value={data.presetId}
            onChange={(presetId) => update(id, 'generateImage', { presetId })}
          />
        </Field>
        <PresetReferences preset={presets.find((preset) => preset.id === data.presetId)} />
        <div className={styles.row}>
          <Field label="Aspect ratio">
            <Select
              value={data.aspectRatio}
              onChange={(event) => {
                const ratio = event.target.value;
                if (isAspectRatio(ratio)) update(id, 'generateImage', { aspectRatio: ratio });
              }}
            >
              {(model?.aspectRatios ?? ASPECT_RATIOS).map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
                </option>
              ))}
            </Select>
          </Field>
          <SeedField nodeId={id} type="generateImage" seed={data.seed} />
        </div>
      </div>
      <OutputPreview job={view.job} />
      <JobError job={view.job} runId={view.runId} />
    </NodeShell>
  );
}
```

`apps/web/src/widgets/workflow-canvas/ui/nodes/EditImageNode.tsx`:
```tsx
import type { NodeProps } from '@xyflow/react';
import { ModelSelect, useCatalog } from '@/entities/catalog';
import { HANDLE_TOP, NodeShell, PortHandle } from '@/entities/node';
import { PresetReferences, PresetSelect, usePresets } from '@/entities/preset';
import { JobStatusBadge } from '@/entities/run';
import { useUpstreamNodeId, useWorkflowStore, type FlowNodeOf } from '@/entities/workflow';
import { useHandleCompatibility } from '@/features/connect-nodes';
import { cx } from '@/shared/lib';
import { Field, Textarea } from '@/shared/ui';
import { useNodeView } from '../../model/use-node-view';
import { JobError, OutputPreview, SeedField } from './parts';
import styles from './nodes.module.css';

export function EditImageNode({ id, data, selected }: NodeProps<FlowNodeOf<'editImage'>>) {
  const view = useNodeView(id, data);
  const update = useWorkflowStore((state) => state.updateNodeData);
  const models = useCatalog().data ?? [];
  const presets = usePresets().data ?? [];
  const imageIn = useHandleCompatibility(id, 'image', 'target');
  const promptIn = useHandleCompatibility(id, 'prompt', 'target');
  const out = useHandleCompatibility(id, 'out', 'source');
  // A wired prompt replaces the instruction.
  const promptWired = useUpstreamNodeId(id, 'prompt') !== null;

  return (
    <NodeShell
      title="Edit Image"
      category="generation"
      status={view.status}
      selected={selected}
      edited={view.edited}
      issues={view.issues}
      badge={view.job && <JobStatusBadge status={view.status} elapsedMs={view.elapsedMs} />}
      handles={
        <>
          <PortHandle direction="input" handle="image" portType="image" label="Image" compatible={imageIn} />
          <PortHandle
            direction="input"
            handle="prompt"
            portType="text"
            label="Prompt"
            top={HANDLE_TOP.second}
            compatible={promptIn}
          />
          <PortHandle direction="output" handle="out" portType="image" label="Image" compatible={out} />
        </>
      }
    >
      <div className={cx(styles.fields, 'nodrag')}>
        <Field label="Instruction">
          <Textarea
            className="nowheel"
            disabled={promptWired}
            placeholder={promptWired ? 'Using connected prompt' : 'Describe the change…'}
            value={promptWired ? '' : data.instruction}
            onChange={(event) => update(id, 'editImage', { instruction: event.target.value })}
          />
        </Field>
        <Field label="Model">
          <ModelSelect
            models={models}
            value={data.modelId}
            editOnly
            onChange={(modelId) => update(id, 'editImage', { modelId })}
          />
        </Field>
        <Field label="Preset">
          <PresetSelect
            presets={presets}
            value={data.presetId}
            onChange={(presetId) => update(id, 'editImage', { presetId })}
          />
        </Field>
        <PresetReferences preset={presets.find((preset) => preset.id === data.presetId)} />
        <SeedField nodeId={id} type="editImage" seed={data.seed} />
      </div>
      <OutputPreview job={view.job} />
      <JobError job={view.job} runId={view.runId} />
    </NodeShell>
  );
}
```

`apps/web/src/widgets/workflow-canvas/ui/nodes/ResultNode.tsx`:
```tsx
import type { NodeProps } from '@xyflow/react';
import type { JobStatus } from '@trafaret/core';
import { NodeShell, PortHandle } from '@/entities/node';
import { useNodeJob } from '@/entities/run';
import { useUpstreamNodeId, type FlowNodeOf } from '@/entities/workflow';
import { useHandleCompatibility } from '@/features/connect-nodes';
import { Spinner } from '@/shared/ui';
import { useNodeView } from '../../model/use-node-view';
import { JobBadges, JobError } from './parts';
import styles from './nodes.module.css';

function Placeholder({ status }: { status: JobStatus }) {
  if (status === 'error') return null;
  if (status === 'queued' || status === 'running') {
    return (
      <p className={styles.placeholder}>
        <Spinner size="sm" /> Waiting for the image…
      </p>
    );
  }
  return <p className={styles.placeholder}>Run the workflow to see the image here.</p>;
}

export function ResultNode({ id, data, selected }: NodeProps<FlowNodeOf<'result'>>) {
  const view = useNodeView(id, data);
  const imageIn = useHandleCompatibility(id, 'image', 'target');
  // The badges describe the node that made the image.
  const sourceId = useUpstreamNodeId(id, 'image');
  const sourceJob = useNodeJob(sourceId);
  const output = view.job?.output?.kind === 'image' ? view.job.output : null;
  return (
    <NodeShell
      title="Result"
      category="output"
      status={view.status}
      selected={selected}
      issues={view.issues}
      handles={
        <PortHandle direction="input" handle="image" portType="image" label="Image" compatible={imageIn} />
      }
    >
      {output ? (
        <figure className={styles.result}>
          <img
            src={output.url}
            alt="Result"
            width={output.width}
            height={output.height}
            className={styles.resultImage}
          />
          <figcaption className={styles.resultFooter}>
            <span className={styles.badges}>
              <JobBadges job={sourceJob} />
            </span>
            <a className={styles.download} href={output.url} download={`trafaret-${id}.webp`}>
              Download
            </a>
          </figcaption>
        </figure>
      ) : (
        <Placeholder status={view.status} />
      )}
      <JobError job={view.job} runId={view.runId} />
    </NodeShell>
  );
}
```

- [ ] **Step 5: Implement the canvas**

`apps/web/src/widgets/workflow-canvas/ui/EmptyCanvas.tsx`:
```tsx
import { TemplateButtons } from '@/features/load-template';
import styles from './WorkflowCanvas.module.css';

export function EmptyCanvas() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyPanel}>
        <h2 className={styles.emptyTitle}>Start from a template or add a node</h2>
        <TemplateButtons />
      </div>
    </div>
  );
}
```

`apps/web/src/widgets/workflow-canvas/ui/WorkflowCanvas.tsx`:
```tsx
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, type NodeTypes } from '@xyflow/react';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useActiveRun } from '@/entities/run';
import { useWorkflowStore, type FlowEdge, type FlowNode } from '@/entities/workflow';
import { ConnectionLine, useConnectionRules } from '@/features/connect-nodes';
import { EmptyCanvas } from './EmptyCanvas';
import { EditImageNode } from './nodes/EditImageNode';
import { GenerateImageNode } from './nodes/GenerateImageNode';
import { ImageInputNode } from './nodes/ImageInputNode';
import { PromptNode } from './nodes/PromptNode';
import { ResultNode } from './nodes/ResultNode';
import styles from './WorkflowCanvas.module.css';

// Outside the component: React Flow expects the same object on every render.
const nodeTypes = {
  prompt: PromptNode,
  imageInput: ImageInputNode,
  generateImage: GenerateImageNode,
  editImage: EditImageNode,
  result: ResultNode,
} satisfies NodeTypes;

export function WorkflowCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, clearSelection } = useWorkflowStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
      clearSelection: state.clearSelection,
    })),
  );
  const { isValidConnection, onConnect } = useConnectionRules();
  const run = useActiveRun();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelection]);

  // Wires take the colour of the type they carry, and move while the node they feed is running.
  const shownEdges = edges.map((edge) => ({
    ...edge,
    className: edge.targetHandle === 'prompt' ? styles.textWire : styles.imageWire,
    animated: run?.jobs[edge.target]?.status === 'running',
  }));

  return (
    <div className={styles.canvas}>
      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes}
        edges={shownEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        connectionLineComponent={ConnectionLine}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        snapToGrid
        snapGrid={[16, 16]}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1.5} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable ariaLabel="Workflow overview" />
      </ReactFlow>
      {nodes.length === 0 && <EmptyCanvas />}
    </div>
  );
}
```

`apps/web/src/widgets/workflow-canvas/ui/WorkflowCanvas.module.css`:
```css
.canvas {
  position: relative;
  height: 100%;
  min-height: 0;
}

.textWire :global(.react-flow__edge-path) {
  stroke: var(--port-text);
}

.imageWire :global(.react-flow__edge-path) {
  stroke: var(--port-image);
}

.textWire:global(.selected) :global(.react-flow__edge-path),
.imageWire:global(.selected) :global(.react-flow__edge-path) {
  stroke: var(--accent);
}

.empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  pointer-events: none;
}

.emptyPanel {
  display: grid;
  gap: 16px;
  width: min(720px, 100%);
  pointer-events: auto;
}

.emptyTitle {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}
```

`apps/web/src/widgets/workflow-canvas/index.ts`:
```ts
export { WorkflowCanvas } from './ui/WorkflowCanvas';
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm exec vitest run --project @trafaret/web widgets/workflow-canvas`
Expected: PASS (2 tests).

- [ ] **Step 7: Run the gate**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): add the workflow canvas and its node cards"
```

---

### Task 12: The editor page — toolbar, inspector, run timeline

The remaining widgets and the page that places them. **editor-toolbar**: the stencil logotype, the template menu, the palette, Import / Export / Delete and Run. **node-inspector**: for the selected node — status, attempt, duration, model and the budget-fallback note, error details with Retry, and "Request sent to AI" (the merged prompt, how the negative prompt was sent, reference thumbnails with their roles, aspect ratio, seed, warnings); with nothing selected, the keyboard shortcuts. **run-timeline**: one row per Generate/Edit node in execution order with a bar from start to finish relative to the run's start (running bars grow live, reused nodes show ⚡ at zero width, failed bars are red with Retry) under the summary line. The page polls the active run once for every widget and places the starter workflow on a first visit.

**Files:**
- Create: `apps/web/src/widgets/editor-toolbar/{ui/EditorToolbar.tsx, ui/EditorToolbar.module.css, index.ts}`
- Create: `apps/web/src/widgets/node-inspector/{ui/NodeInspector.tsx, ui/JobDetails.tsx, ui/RequestPreview.tsx, ui/NodeInspector.module.css, index.ts}`
- Create: `apps/web/src/widgets/run-timeline/{lib/timeline-rows.ts, ui/RunTimeline.tsx, ui/RunTimeline.module.css, index.ts}`
- Modify (replace): `apps/web/src/pages/editor/ui/EditorPage.tsx`, `apps/web/src/pages/editor/ui/EditorPage.module.css`
- Test: `apps/web/src/widgets/node-inspector/ui/RequestPreview.test.tsx`, `apps/web/src/widgets/run-timeline/lib/timeline-rows.test.ts`

**Interfaces:**
- Consumes: the features of Tasks 8–10 (`NodePalette`, `DeleteSelectionButton`, `ExportImportButtons`, `TemplateMenu`, `useStarterWorkflow`, `RunButton`, `RetryButton`), the run entity (`useRunPolling`, `useActiveRunQuery`, `useNodeJob`, `useRunSession`, `layoutTimeline`, `formatRunSummary`, `jobDurationMs`, `retryTarget`, `JOB_STATUS_LABEL`, `JobStatusBadge`, `TimelineBar`), `useSelectedNodeIds` / `useWorkflowNode`, `useCatalog`, `usePresets`, `Panel` / `Badge`, `useNow`, `cx`, `formatDuration`.
- Produces: `EditorToolbar`, `NodeInspector`, `RunTimeline` (a region named "Run timeline"; each bar carries `data-bar`) and the final `EditorPage`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/widgets/node-inspector/ui/RequestPreview.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RequestPreview as Request } from '@trafaret/core';
import { RequestPreview } from './RequestPreview';

const request: Request = {
  modelId: 'flux-2-klein',
  prompt: 'A ceramic mug. premium minimal 3D render. Avoid: clutter.',
  negativePrompt: 'clutter',
  negativeMode: 'folded',
  references: [
    { assetId: 'a'.repeat(64), url: '/api/assets/source', role: 'source' },
    { assetId: 'b'.repeat(64), url: '/api/assets/preset', role: 'preset' },
  ],
  aspectRatio: '1:1',
  seed: null,
  warnings: ['FLUX.2 klein 4B takes 4 reference images; 1 was left out.'],
};

describe('RequestPreview', () => {
  it('shows the final prompt and how the negative prompt was sent', () => {
    render(<RequestPreview request={request} />);
    const section = screen.getByRole('region', { name: 'Request sent to AI' });
    expect(section).toHaveTextContent('A ceramic mug. premium minimal 3D render. Avoid: clutter.');
    expect(section).toHaveTextContent('added to the prompt as “Avoid: …”');
  });

  it('lists the reference images with their roles, and the warnings', () => {
    render(<RequestPreview request={request} />);
    const references = screen.getByRole('list', { name: 'Reference images' });
    expect(references).toHaveTextContent('Source');
    expect(references).toHaveTextContent('Preset');
    expect(screen.getByText('FLUX.2 klein 4B takes 4 reference images; 1 was left out.')).toBeInTheDocument();
  });

  it('says when the model takes no seed', () => {
    render(<RequestPreview request={request} />);
    expect(screen.getByText('not supported by this model')).toBeInTheDocument();
  });
});
```

`apps/web/src/widgets/run-timeline/lib/timeline-rows.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Preset } from '@trafaret/core';
import { branchingGraph, withNode, generateNode } from '@trafaret/core/testing';
import { timelineRows } from './timeline-rows';

const lifestyle: Preset = {
  id: 'lifestyle',
  name: 'Lifestyle',
  mainPrompt: '',
  negativePrompt: '',
  references: [],
};

describe('timelineRows', () => {
  it('lists only the AI nodes, in execution order, named after their preset or model', () => {
    const graph = withNode(branchingGraph(), generateNode('gen-b', { presetId: 'lifestyle', seed: 2 }));
    expect(timelineRows(graph, [lifestyle], [])).toEqual([
      { nodeId: 'gen-a', label: 'Generate Image · mock' },
      { nodeId: 'gen-b', label: 'Generate Image · Lifestyle' },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project @trafaret/web widgets/node-inspector widgets/run-timeline`
Expected: FAIL — the modules don't exist yet.

- [ ] **Step 3: Implement the toolbar**

`apps/web/src/widgets/editor-toolbar/ui/EditorToolbar.tsx`:
```tsx
import { NodePalette } from '@/features/add-node';
import { DeleteSelectionButton } from '@/features/delete-selection';
import { ExportImportButtons } from '@/features/export-import';
import { TemplateMenu } from '@/features/load-template';
import { RunButton } from '@/features/run-workflow';
import styles from './EditorToolbar.module.css';

export function EditorToolbar() {
  return (
    <header className={styles.toolbar}>
      <h1 className={styles.logo}>Trafaret</h1>
      <TemplateMenu />
      <NodePalette />
      <div className={styles.actions}>
        <ExportImportButtons />
        <DeleteSelectionButton />
        <RunButton />
      </div>
    </header>
  );
}
```

`apps/web/src/widgets/editor-toolbar/ui/EditorToolbar.module.css`:
```css
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 20px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
}

.logo {
  margin: 0;
  font: 400 24px/1 var(--font-logo);
  letter-spacing: 0.04em;
  color: var(--accent);
}

.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
```

`apps/web/src/widgets/editor-toolbar/index.ts`:
```ts
export { EditorToolbar } from './ui/EditorToolbar';
```

- [ ] **Step 4: Implement the inspector**

`apps/web/src/widgets/node-inspector/ui/RequestPreview.tsx`:
```tsx
import type { RequestPreview as Request } from '@trafaret/core';
import styles from './NodeInspector.module.css';

const NEGATIVE_NOTE: Readonly<Record<Request['negativeMode'], string>> = {
  native: "Sent in the model's negative-prompt field.",
  folded: 'This model has no negative-prompt field, so it was added to the prompt as “Avoid: …”.',
  none: 'No negative prompt.',
};

/** Exactly what the server sent to the model: the merged prompt, the reference images and the settings. */
export function RequestPreview({ request }: { request: Request }) {
  return (
    <section aria-label="Request sent to AI" className={styles.section}>
      <h4 className={styles.sectionTitle}>Request sent to AI</h4>
      <p className={styles.prompt}>{request.prompt}</p>
      {request.negativePrompt && (
        <p className={styles.negative}>
          <span className={styles.term}>Negative</span> {request.negativePrompt}
        </p>
      )}
      <p className={styles.note}>{NEGATIVE_NOTE[request.negativeMode]}</p>
      {request.references.length > 0 && (
        <ul className={styles.references} aria-label="Reference images">
          {request.references.map((reference, index) => (
            <li key={index} className={styles.reference}>
              <img src={reference.url} alt="" width={56} height={56} className={styles.referenceImage} />
              <span>{reference.role === 'source' ? 'Source' : 'Preset'}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className={styles.facts}>
        <dt>Model</dt>
        <dd>{request.modelId}</dd>
        <dt>Aspect ratio</dt>
        <dd>{request.aspectRatio ?? '—'}</dd>
        <dt>Seed</dt>
        <dd>{request.seed ?? 'not supported by this model'}</dd>
      </dl>
      {request.warnings.length > 0 && (
        <ul className={styles.warnings}>
          {request.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

`apps/web/src/widgets/node-inspector/ui/JobDetails.tsx`:
```tsx
import type { ImageModel, Job } from '@trafaret/core';
import { jobDurationMs, JobStatusBadge, retryTarget } from '@/entities/run';
import { RetryButton } from '@/features/retry-node';
import { formatDuration } from '@/shared/lib';
import styles from './NodeInspector.module.css';

type JobDetailsProps = { job: Job; runId: string | null; models: readonly ImageModel[]; now: number };

export function JobDetails({ job, runId, models, now }: JobDetailsProps) {
  const duration = jobDurationMs(job, now);
  const modelName = (id: string): string => models.find((model) => model.id === id)?.label ?? id;
  const target = retryTarget(job);
  return (
    <>
      <dl className={styles.facts}>
        <dt>Status</dt>
        <dd>
          <JobStatusBadge status={job.status} />
        </dd>
        <dt>Attempt</dt>
        <dd>{job.attempt}</dd>
        <dt>Duration</dt>
        <dd>
          {job.cached ? 'Reused from an earlier run' : duration === null ? '—' : formatDuration(duration)}
        </dd>
        {job.model && (
          <>
            <dt>Model</dt>
            <dd>{modelName(job.model.id)}</dd>
          </>
        )}
      </dl>
      {job.model?.fallbackFrom && (
        <p className={styles.note}>
          The daily limit for {modelName(job.model.fallbackFrom)} was reached, so Mock made this image.
        </p>
      )}
      {job.error && (
        <section aria-label="Error" className={styles.section}>
          <h4 className={styles.sectionTitle}>Error</h4>
          <p className={styles.errorText}>{job.error.message}</p>
          <p className={styles.note}>
            {job.error.code} · {job.error.retryable ? 'a retry may help' : 'a retry will not help'}
          </p>
          {target !== null && runId !== null && <RetryButton runId={runId} nodeId={target} />}
        </section>
      )}
    </>
  );
}
```

`apps/web/src/widgets/node-inspector/ui/NodeInspector.tsx`:
```tsx
import { nodeLabel } from '@trafaret/core';
import { useCatalog } from '@/entities/catalog';
import { useNodeJob, useRunSession } from '@/entities/run';
import { useSelectedNodeIds, useWorkflowNode } from '@/entities/workflow';
import { useNow } from '@/shared/lib';
import { Panel } from '@/shared/ui';
import { JobDetails } from './JobDetails';
import styles from './NodeInspector.module.css';
import { RequestPreview } from './RequestPreview';

const SHORTCUTS: ReadonlyArray<[keys: string, action: string]> = [
  ['⌘/Ctrl ↵', 'Run the workflow'],
  ['Delete', 'Remove the selection'],
  ['Esc', 'Clear the selection'],
  ['Shift + drag', 'Select several nodes'],
];

export function NodeInspector() {
  const selected = useSelectedNodeIds();
  const [only] = selected;
  return (
    <Panel title="Inspector">
      {selected.length === 1 && only ? (
        <NodeDetails nodeId={only} />
      ) : (
        <div className={styles.idle}>
          <p className={styles.hint}>
            {selected.length > 1
              ? `${selected.length} nodes selected.`
              : 'Select a node to see its status and exactly what it sent to the AI.'}
          </p>
          <dl className={styles.shortcuts}>
            {SHORTCUTS.map(([keys, action]) => (
              <div key={keys} className={styles.shortcut}>
                <dt>
                  <kbd>{keys}</kbd>
                </dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Panel>
  );
}

function NodeDetails({ nodeId }: { nodeId: string }) {
  const node = useWorkflowNode(nodeId);
  const job = useNodeJob(nodeId);
  const runId = useRunSession((state) => state.activeRunId);
  const models = useCatalog().data ?? [];
  const now = useNow(job?.status === 'running', 500);
  if (!node) return null;
  return (
    <div className={styles.details}>
      <h3 className={styles.nodeTitle}>{nodeLabel(node.type)}</h3>
      {job ? (
        <JobDetails job={job} runId={runId} models={models} now={now} />
      ) : (
        <p className={styles.hint}>Not run yet.</p>
      )}
      {job?.request && <RequestPreview request={job.request} />}
    </div>
  );
}
```

`apps/web/src/widgets/node-inspector/ui/NodeInspector.module.css`:
```css
.idle,
.details {
  display: grid;
  gap: 16px;
}

.hint {
  margin: 0;
  color: var(--text-muted);
}

.shortcuts {
  display: grid;
  gap: 8px;
  margin: 0;
}

.shortcut {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shortcut dt {
  min-width: 96px;
}

.shortcut dd {
  margin: 0;
  color: var(--text-muted);
}

.shortcut kbd {
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-raised);
  font: 500 11px/1.4 var(--font-mono);
}

.nodeTitle {
  margin: 0;
  font-size: 16px;
}

.facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  margin: 0;
}

.facts dt {
  color: var(--text-muted);
}

.facts dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12px;
}

.section {
  display: grid;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.sectionTitle {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.prompt {
  margin: 0;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-canvas);
  font: 12px/1.5 var(--font-mono);
  white-space: pre-wrap;
  word-break: break-word;
}

.negative {
  margin: 0;
  font-size: 13px;
}

.term {
  color: var(--text-muted);
}

.note {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.references {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.reference {
  display: grid;
  gap: 4px;
  justify-items: center;
  font-size: 11px;
  color: var(--text-muted);
}

.referenceImage {
  width: 56px;
  height: 56px;
  border: 1px solid var(--border);
  border-radius: 6px;
  object-fit: cover;
}

.warnings {
  margin: 0;
  padding-left: 18px;
  color: var(--warning);
  font-size: 12px;
}

.errorText {
  margin: 0;
  color: var(--error);
}
```

`apps/web/src/widgets/node-inspector/index.ts`:
```ts
export { NodeInspector } from './ui/NodeInspector';
```

- [ ] **Step 5: Implement the timeline**

`apps/web/src/widgets/run-timeline/lib/timeline-rows.ts`:
```ts
import {
  indexGraph,
  nodeLabel,
  topologicalOrder,
  type Graph,
  type GraphNode,
  type ImageModel,
  type Preset,
} from '@trafaret/core';

export type TimelineRowInfo = { nodeId: string; label: string };

/** One row per Generate or Edit node of the run, in execution order, named after its preset (or model). */
export function timelineRows(
  graph: Graph,
  presets: readonly Preset[],
  models: readonly ImageModel[],
): TimelineRowInfo[] {
  const order = topologicalOrder(indexGraph(graph)) ?? graph.nodes.map((node) => node.id);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  return order.flatMap((id) => {
    const node = byId.get(id);
    return node ? row(node, presets, models) : [];
  });
}

function row(node: GraphNode, presets: readonly Preset[], models: readonly ImageModel[]): TimelineRowInfo[] {
  if (node.type !== 'generateImage' && node.type !== 'editImage') return [];
  const style =
    presets.find((preset) => preset.id === node.data.presetId)?.name ??
    models.find((model) => model.id === node.data.modelId)?.label ??
    node.data.modelId;
  return [{ nodeId: node.id, label: `${nodeLabel(node.type)} · ${style}` }];
}
```

`apps/web/src/widgets/run-timeline/ui/RunTimeline.tsx`:
```tsx
import { useState } from 'react';
import { isTerminalRunStatus, type Job, type RunStatus } from '@trafaret/core';
import { useCatalog } from '@/entities/catalog';
import { usePresets } from '@/entities/preset';
import {
  formatRunSummary,
  jobDurationMs,
  JOB_STATUS_LABEL,
  layoutTimeline,
  retryTarget,
  useActiveRunQuery,
  useRunSession,
  type TimelineBar,
} from '@/entities/run';
import { RetryButton } from '@/features/retry-node';
import { cx, formatDuration, useNow } from '@/shared/lib';
import { Badge } from '@/shared/ui';
import { timelineRows } from '../lib/timeline-rows';
import styles from './RunTimeline.module.css';

const RUN_STATUS: Readonly<
  Record<RunStatus, { label: string; tone: 'neutral' | 'accent' | 'success' | 'error' }>
> = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'accent' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'error' },
};

const percent = (fraction: number): string => `${(fraction * 100).toFixed(2)}%`;

/** When each AI call of the active run started and ended: parallel branches overlap, reused nodes take no time. */
export function RunTimeline() {
  const { data: run, error } = useActiveRunQuery();
  const submitted = useRunSession((state) => state.submittedGraph);
  const runId = useRunSession((state) => state.activeRunId);
  const presets = usePresets().data ?? [];
  const models = useCatalog().data ?? [];
  const [open, setOpen] = useState(true);
  const now = useNow(run !== undefined && !isTerminalRunStatus(run.status), 200);

  if (error) {
    return (
      <section aria-label="Run timeline" className={styles.timeline}>
        <p className={styles.empty}>Couldn't load the last run: {error.message}</p>
      </section>
    );
  }
  if (!run || !submitted) {
    return (
      <section aria-label="Run timeline" className={styles.timeline}>
        <p className={styles.empty}>Run the workflow to see when each AI call starts and ends.</p>
      </section>
    );
  }

  const rows = timelineRows(submitted, presets, models);
  const { bars } = layoutTimeline(
    run,
    rows.map((row) => row.nodeId),
    now,
  );
  const labels = new Map(rows.map((row) => [row.nodeId, row.label]));
  return (
    <section aria-label="Run timeline" className={styles.timeline}>
      <header className={styles.header}>
        <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
          Timeline <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
        <span className={styles.summary}>{formatRunSummary(run, now)}</span>
        <Badge tone={RUN_STATUS[run.status].tone}>{RUN_STATUS[run.status].label}</Badge>
      </header>
      {open && (
        <ol className={styles.rows}>
          {bars.map((bar) => {
            const job = run.jobs[bar.nodeId];
            return job ? (
              <TimelineRow
                key={bar.nodeId}
                label={labels.get(bar.nodeId) ?? bar.nodeId}
                bar={bar}
                job={job}
                runId={runId}
                now={now}
              />
            ) : null;
          })}
        </ol>
      )}
    </section>
  );
}

type TimelineRowProps = { label: string; bar: TimelineBar; job: Job; runId: string | null; now: number };

function TimelineRow({ label, bar, job, runId, now }: TimelineRowProps) {
  const duration = jobDurationMs(job, now);
  const target = retryTarget(job);
  return (
    <li className={styles.row}>
      <span className={styles.label} title={label}>
        {label}
      </span>
      <span className={styles.track}>
        {bar.start !== null && bar.end !== null && (
          <span
            data-bar
            className={cx(styles.bar, styles[bar.status], bar.cached && styles.cached)}
            style={{ left: percent(bar.start), width: percent(bar.end - bar.start) }}
          />
        )}
      </span>
      <span className={styles.value}>
        {bar.cached
          ? '⚡ reused'
          : duration === null
            ? JOB_STATUS_LABEL[bar.status]
            : formatDuration(duration)}
      </span>
      <span className={styles.action}>
        {target !== null && runId !== null && <RetryButton runId={runId} nodeId={target} />}
      </span>
    </li>
  );
}
```

`apps/web/src/widgets/run-timeline/ui/RunTimeline.module.css`:
```css
.timeline {
  border-top: 1px solid var(--border);
  background: var(--bg-surface);
  font-family: var(--font-mono);
  font-size: 12px;
}

.empty {
  margin: 0;
  padding: 12px 16px;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: 13px;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
}

.toggle {
  border: 0;
  background: none;
  font: 600 12px/1 var(--font-ui);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  cursor: pointer;
}

.summary {
  flex: 1;
}

.rows {
  display: grid;
  gap: 6px;
  max-height: 28vh;
  margin: 0;
  padding: 0 16px 12px;
  overflow-y: auto;
  list-style: none;
}

.row {
  display: grid;
  grid-template-columns: minmax(120px, 220px) 1fr 84px 72px;
  align-items: center;
  gap: 12px;
  min-height: 28px;
}

.label {
  overflow: hidden;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track {
  position: relative;
  height: 10px;
  border-radius: 5px;
  background: var(--bg-canvas);
}

.bar {
  position: absolute;
  top: 0;
  bottom: 0;
  min-width: 3px;
  border-radius: 5px;
  background: var(--border-strong);
}

.running {
  background: var(--accent);
}

.success {
  background: var(--success);
}

.error {
  background: var(--error);
}

.cached {
  background: var(--accent);
}

.value {
  text-align: right;
}

.action {
  justify-self: end;
}

@media (max-width: 700px) {
  .row {
    grid-template-columns: minmax(80px, 1fr) 2fr 64px;
  }

  .action {
    grid-column: 1 / -1;
  }
}
```

`apps/web/src/widgets/run-timeline/index.ts`:
```ts
export { RunTimeline } from './ui/RunTimeline';
```

- [ ] **Step 6: Assemble the page**

Replace `apps/web/src/pages/editor/ui/EditorPage.tsx` with:
```tsx
import { useRunPolling } from '@/entities/run';
import { useStarterWorkflow } from '@/features/load-template';
import { EditorToolbar } from '@/widgets/editor-toolbar';
import { NodeInspector } from '@/widgets/node-inspector';
import { RunTimeline } from '@/widgets/run-timeline';
import { WorkflowCanvas } from '@/widgets/workflow-canvas';
import styles from './EditorPage.module.css';

export function EditorPage() {
  // The page polls the active run once for every widget, and places the starter workflow on a first visit.
  useRunPolling();
  useStarterWorkflow();
  return (
    <div className={styles.page}>
      <EditorToolbar />
      <main className={styles.main}>
        <WorkflowCanvas />
        <aside className={styles.inspector}>
          <NodeInspector />
        </aside>
      </main>
      <RunTimeline />
    </div>
  );
}
```

Replace `apps/web/src/pages/editor/ui/EditorPage.module.css` with:
```css
.page {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100%;
}

.main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  min-height: 0;
}

.inspector {
  min-height: 0;
  overflow-y: auto;
  border-left: 1px solid var(--border);
  background: var(--bg-surface);
}

/* Narrow screens keep the canvas viewable and runnable; the inspector steps aside. */
@media (max-width: 900px) {
  .main {
    grid-template-columns: minmax(0, 1fr);
  }

  .inspector {
    display: none;
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project @trafaret/web widgets`
Expected: PASS (6 tests: 2 canvas, 3 request preview, 1 timeline rows).

- [ ] **Step 8: Run the gate and build**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all green; the bundle is about 640 kB (≈ 200 kB gzip), under the 700 kB warning limit.

- [ ] **Step 9: Try it**

Run `pnpm dev` and open http://127.0.0.1:5173 in a fresh browser profile (or clear the site's storage). Expected, with the server in mock mode (no `.env` keys):
1. The canvas opens with "One prompt, two styles": Prompt → two Generate cards (Premium 3D, Lifestyle) → two Results.
2. Run → both Generate cards show a running ring and elapsed seconds, their incoming wires move, and the timeline's two bars overlap; then both Results show an image with a "Mock" badge.
3. Change the second card's preset → it shows "● edited"; Run → the first card shows "⚡ reused" and the summary says "1 reused · saved ~…".
4. Templates… → "Text → Image" (confirm), set its model to "Mock · fails first attempt", Run → the card shows the failure and Retry, the Result says "Skipped: Generate Image failed."; Retry → the image arrives, the inspector shows attempt 2.

Stop `pnpm dev`. (Task 13 automates 2–4.)

- [ ] **Step 10: Commit**

```bash
git add apps/web
git commit -m "feat(web): assemble the editor — toolbar, inspector, run timeline"
```

---

### Task 13: End-to-end tests

The three scenarios of spec §9 in a real browser, against a real server in mock mode: ① the starter workflow runs both branches at once (the timeline bars overlap); ② a "fails first attempt" node fails, Retry succeeds; ③ changing one preset re-renders only that branch (the other shows ⚡ reused). Playwright starts its own API and editor on their own ports with every provider key blanked, so a test never calls a real, paid model and never reuses a dev server.

**Files:**
- Create: `playwright.config.ts`, `e2e/editor.ts`, `e2e/branching.spec.ts`, `e2e/retry.spec.ts`, `e2e/incremental.spec.ts`
- Modify: `package.json` (`e2e` script, `@playwright/test`), `tsconfig.json` (`e2e` included), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: the UI contract from Tasks 9–12 — cards by class `react-flow__node-<type>` in node order; the button named "Run"; the select named "Load a template" with option `text-to-image`; card controls captioned "Model" and "Preset"; `role="alert"` failures; Result images with alt "Result"; the region "Run timeline" with `[data-bar]` bars; the texts "● edited", "⚡ reused", "1 reused", "2 AI calls", "Completed".
- Produces: `pnpm e2e`.

- [ ] **Step 1: Add Playwright**

Replace the root `package.json` with:
```json
{
  "name": "trafaret",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.15.0",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm --filter @trafaret/web build",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "typecheck": "tsc -p tsconfig.json && pnpm -r typecheck",
    "lint": "eslint . && pnpm --filter @trafaret/web lint:fsd && prettier --check .",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.64.0",
    "@types/node": "^24.19.1",
    "eslint": "^10.12.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.7",
    "globals": "^17.13.0",
    "prettier": "^3.9.9",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.71.1",
    "vitest": "^5.0.3"
  }
}
```

In the root `tsconfig.json`, change `"include": ["*.ts", "*.js"]` to `"include": ["*.ts", "*.js", "e2e"]`.

Run: `pnpm install && pnpm exec playwright install chromium`
Expected: Chromium (headless shell) is downloaded into Playwright's cache.

- [ ] **Step 2: Configure Playwright**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

// Ports of their own, so a running `pnpm dev` (which may have real API keys) is never reused.
const API_PORT = 8090;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: 'e2e',
  // One server for every test; a single worker keeps their jobs from queueing behind each other.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  expect: { timeout: 10_000 },
  use: { baseURL: `http://127.0.0.1:${WEB_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @trafaret/server start',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: {
        NODE_ENV: 'development',
        HOST: '127.0.0.1',
        PORT: String(API_PORT),
        LOG_LEVEL: 'warn',
        MOCK_LATENCY_MS: '800-1200',
        // Mock mode whatever the shell exports: a test never calls a real, paid model.
        CLOUDFLARE_ACCOUNT_ID: '',
        CLOUDFLARE_API_TOKEN: '',
        ARK_API_KEY: '',
      },
      reuseExistingServer: false,
    },
    {
      command: `pnpm --filter @trafaret/web exec vite --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      env: { API_ORIGIN: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
```

`e2e/editor.ts`:
```ts
import { expect, type Locator, type Page } from '@playwright/test';

/** Opens the editor as a first-time visitor: the starter workflow, "One prompt, two styles", is on the canvas. */
export async function openEditor(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.react-flow__node')).toHaveCount(5);
}

/** Cards of one node type, in the order of the workflow's nodes. */
export const cards = (page: Page, type: string): Locator => page.locator(`.react-flow__node-${type}`);

export const runButton = (page: Page): Locator => page.getByRole('button', { name: 'Run', exact: true });

export const timeline = (page: Page): Locator => page.getByRole('region', { name: 'Run timeline' });
```

- [ ] **Step 3: Write the scenarios**

`e2e/branching.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { cards, openEditor, runButton, timeline } from './editor.ts';

test('runs both branches of the starter workflow at the same time', async ({ page }) => {
  await openEditor(page);
  await runButton(page).click();

  const results = cards(page, 'result');
  await expect(results.nth(0).getByRole('img', { name: 'Result' })).toBeVisible();
  await expect(results.nth(1).getByRole('img', { name: 'Result' })).toBeVisible();
  await expect(timeline(page)).toContainText('2 AI calls');

  const bars = timeline(page).locator('[data-bar]');
  await expect(bars).toHaveCount(2);
  const [a, b] = await Promise.all([bars.nth(0).boundingBox(), bars.nth(1).boundingBox()]);
  if (!a || !b) throw new Error('The timeline bars are not visible.');
  // Both Generate nodes depend only on the prompt, so their bars overlap in time.
  expect(a.x < b.x + b.width && b.x < a.x + a.width).toBe(true);
});
```

`e2e/retry.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { cards, openEditor, runButton } from './editor.ts';

test('retries a failed node and finishes the run', async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept()); // "Replace the current workflow?"
  await openEditor(page);
  await page.getByRole('combobox', { name: 'Load a template' }).selectOption('text-to-image');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);

  const generate = cards(page, 'generateImage');
  await generate.getByLabel('Model').selectOption('mock-fails-first');
  await runButton(page).click();
  await expect(generate.getByRole('alert')).toContainText('always fails its first attempt');
  await expect(cards(page, 'result').getByRole('alert')).toContainText('Skipped: Generate Image failed.');

  await generate.getByRole('button', { name: 'Retry' }).click();
  await expect(cards(page, 'result').getByRole('img', { name: 'Result' })).toBeVisible();
});
```

`e2e/incremental.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { cards, openEditor, runButton, timeline } from './editor.ts';

test('re-renders only the branch whose preset changed', async ({ page }) => {
  await openEditor(page);
  await runButton(page).click();
  await expect(timeline(page)).toContainText('Completed');

  const generateA = cards(page, 'generateImage').nth(0);
  const generateB = cards(page, 'generateImage').nth(1);
  await generateB.getByLabel('Preset').selectOption('paper-craft');
  await expect(generateB.getByText('● edited')).toBeVisible();

  await runButton(page).click();
  await expect(timeline(page)).toContainText('1 reused');
  await expect(generateA.getByText('⚡ reused')).toBeVisible();
  await expect(generateB.getByText('⚡ reused')).toHaveCount(0);
  await expect(cards(page, 'result').nth(1).getByRole('img', { name: 'Result' })).toBeVisible();
});
```

- [ ] **Step 4: Run them**

Run: `pnpm e2e`
Expected: `3 passed` in about 15 s. Run it twice more: it must pass every time (no retries are configured outside CI).

- [ ] **Step 5: Run the gate**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green (the root typecheck now covers `e2e/` and `playwright.config.ts`).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json playwright.config.ts e2e
git commit -m "test(e2e): cover branching, retry and incremental runs in the browser"
```

---

### Task 14: Write the editor's decisions into the spec and the README

The spec stays the source of truth: record the eight deltas listed under Global Constraints. The README gains the editor and the test commands (Phase 3 rewrites it fully).

**Files:**
- Modify: `docs/specs/2026-10-08-trafaret-design.md` (§8.1, §8.2, §8.3, §8.4, §8.5, §8.7, §9, §10)
- Modify: `README.md`

- [ ] **Step 1: Update spec §8 (Frontend)**

In §8.1 replace the layer tree with:

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

and add this bullet under it:

```
- The image-model entity is `catalog`, after `GET /api/catalog`: an entity called `model` would read
  `entities/model/model/` and clash with FSD's `model` segment.
```

In §8.2, add to the end of the **Server state** bullet: "Exactly one component (the editor page) polls; every other reader uses the cached run and never fetches." Add a bullet after **Active run**:

```
- An export is exactly the body of `POST /api/runs` (`{ "graph": … }`), so it can be posted with curl; import also
  accepts a bare graph.
```

In §8.3, change "Handles are coloured by port type;" to "Handles and wires are coloured by port type;".

In §8.4, in the **Image Input** row replace "dropzone / click to upload, preview, replace; upload progress and error" with "dropzone / click to upload, preview, replace, “Use the sample photo”; a spinner while uploading (`fetch` reports upload progress only over HTTP/2 with request streams) and the upload error". In the **Generate Image** row replace "model select (disabled options show their reason)" with "model select (disabled options show their reason in the option text)".

In §8.5, change "one row per node in topological order" to "one row per Generate/Edit node in topological order (Prompt, Image Input and Result finish in ~0 ms and would only add empty rows)".

In §8.7, change "Stencil typeface for the logotype" to "Stencil typeface (Saira Stencil One, self-hosted with Fontsource) for the logotype", and add a bullet: "Hints use the native `title` attribute; there is no tooltip component."

- [ ] **Step 2: Update spec §9 and §10**

In the §9 table, replace the **Web unit** scope with "store ↔ graph mapping and saving; timeline layout maths; status helpers; wiring checks; templates (fresh ids and seeds, all valid); workflow files; the UI kit and key components with Testing Library, including the canvas rendered in jsdom", and append to the **E2E** scope: "— on its own ports (API 8090, editor 5174) with every provider key blanked".

In §10, replace the root-scripts bullet with:

```
- Root scripts: `dev` (server + Vite via `pnpm -r --parallel dev`; the editor on `127.0.0.1:5173` proxies `/api` to the
  server; mock models always available, real ones when `.env` has keys), `build`, `test`, `e2e`, `lint` (ESLint +
  Steiger + Prettier check), `typecheck`.
```

- [ ] **Step 3: Update the README**

Replace `README.md` with:

````md
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
````

- [ ] **Step 4: Check and commit**

Run: `pnpm format && pnpm lint`
Expected: all green (`docs/` is not formatted by Prettier; the README is).

```bash
git add docs/specs/2026-10-08-trafaret-design.md README.md
git commit -m "docs: record the editor's design decisions in the spec and README"
```

---

## Self-review

- **Spec coverage.** §8.1 layers and Steiger → Tasks 2–12 (`pnpm lint` runs Steiger). §8.2 store, persistence, polling with the version guard, active run, edited marker, validation before submit → Tasks 4, 6, 9, 11. §8.3 palette at the viewport centre, move, box/shift selection, Delete, ⌘/Ctrl+Enter, Esc, typed handles, compatible-handle highlight, rejection reason, fan-out, minimap, zoom, fit, snap, empty state → Tasks 8, 9, 10, 11. §8.4 cards and statuses → Tasks 7, 11. §8.5 timeline and inspector → Tasks 6, 12. §8.6 templates and first visit → Task 10. §8.7 visual identity and accessibility → Tasks 2, 3, 7, 11, 12. §9 web unit and e2e → every task, Task 13. §10 scripts → Tasks 2, 13. R1, R2–R5, R10, R14 (UI side), R15 → covered through the tasks above.
- **Out of scope here** (Phase 3): serving the built SPA from Fastify, the Dockerfile, CI, the Render deploy, real preset images and sample photo, the full README.

## Execution notes

The tasks were executed one by one, each followed by a review. Review fixes changed the code in these places, so
the plan's code blocks differ from what was committed:

- Task 4: `connect` gives every new edge its own nanoid id — React Flow's default id joins both node ids and can
  pass the 64-character edge-id limit for imported graphs (e51e487). `needsStarter` starts `true` and is cleared
  when a save loads, so corrupt or unreadable storage also gets the starter (8b5a083).
- Task 7: selection is an outline, since the status colours own the border; cards carry `data-selected`; the
  keyboard focus ring that React Flow removes from nodes is restored in `global.css` (641d019).
- Task 8: `useHandleCompatibility` computes its verdict inside a workflow-store selector — the React Compiler had
  cached it across drags — and `isSameHandle` stops the wire judging its own start handle (780dc2f).
- Task 10: `useStarterWorkflow`'s comment covers unreadable saves too (96ae4cb).
- Task 11: Retry and Download sit in `nodrag` areas, so a click with a little pointer movement isn't taken for a
  node drag (1e9991c).
- Task 13: the branching scenario requires real overlap — more than half the shorter bar — and pins
  `MAX_CONCURRENT_JOBS` (0d19fe8).
