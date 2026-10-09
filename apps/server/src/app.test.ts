import { readFile } from 'node:fs/promises';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogResponse, Run } from '@trafaret/core';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createServices } from './services.ts';
import { RENDER_TEST_TIMEOUT_MS, RENDER_WAIT_MS } from './test/wait.ts';

// The run renders real Mock images at full size; the suite timeout leaves room for that on a loaded machine.
describe('app', { timeout: RENDER_TEST_TIMEOUT_MS }, () => {
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

    const body: unknown = JSON.parse(
      await readFile(new URL('../../../examples/branching.json', import.meta.url), 'utf8'),
    );
    const created = await app.inject({ method: 'POST', url: '/api/runs', payload: body as object });
    expect(created.statusCode).toBe(202);
    const { runId } = created.json<{ runId: string }>();

    let run: Run | undefined;
    await vi.waitFor(
      async () => {
        run = (await app.inject({ method: 'GET', url: `/api/runs/${runId}` })).json<Run>();
        expect(run.status).toBe('completed');
      },
      { timeout: RENDER_WAIT_MS },
    );
    const output = run?.jobs['result-a']?.output;
    expect(output?.kind).toBe('image');
    const image = await app.inject({
      method: 'GET',
      url: output?.kind === 'image' ? output.url : '/missing',
    });
    expect(image.statusCode).toBe(200);
    expect(image.headers['content-type']).toBe('image/webp');

    const docs = (await app.inject({ method: 'GET', url: '/api/docs/json' })).json<{
      paths: Record<string, unknown>;
    }>();
    expect(Object.keys(docs.paths)).toEqual(
      expect.arrayContaining([
        '/api/runs',
        '/api/runs/{runId}',
        '/api/runs/{runId}/nodes/{nodeId}/retry',
        '/api/assets',
      ]),
    );
  });

  it('in production, counts requests per visitor address from the edge, whatever X-Forwarded-For says', async () => {
    const config = loadConfig({ NODE_ENV: 'production', MOCK_LATENCY_MS: '0-5' });
    const logger = pino({ level: 'silent' });
    const app = await buildApp(config, await createServices(config, logger), logger, {
      rateLimits: { runsPer10Minutes: 2, uploadsPer10Minutes: 2 },
    });
    // An empty body fails validation, but the limiter has counted the request by then.
    const startRun = (headers: Record<string, string>) =>
      app.inject({ method: 'POST', url: '/api/runs', payload: {}, headers });

    const visitor = { 'cf-connecting-ip': '203.0.113.7' };
    expect((await startRun({ ...visitor, 'x-forwarded-for': '198.51.100.1' })).statusCode).toBe(400);
    expect((await startRun({ ...visitor, 'x-forwarded-for': '198.51.100.2' })).statusCode).toBe(400);
    expect((await startRun({ ...visitor, 'x-forwarded-for': '198.51.100.3' })).statusCode).toBe(429);
    expect((await startRun({ 'cf-connecting-ip': '203.0.113.8' })).statusCode).toBe(400);
  });
});
