import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { Run } from '@trafaret/core';
import { branchingGraph, edge, generateNode, promptNode, withNode } from '@trafaret/core/testing';
import { createHttpServer } from '../http/server.ts';
import { createHarness } from '../test/engine-harness.ts';
import { RENDER_TEST_TIMEOUT_MS, RENDER_WAIT_MS } from '../test/wait.ts';
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
  await vi.waitFor(
    async () => {
      run = (await app.inject({ method: 'GET', url: `/api/runs/${runId}` })).json<Run>();
      expect(run.status).toBe(status);
    },
    { timeout: RENDER_WAIT_MS },
  );
  return run!;
}

// Runs render real Mock images; the suite timeout leaves room for their waits on a loaded machine.
describe('runs API', { timeout: RENDER_TEST_TIMEOUT_MS }, () => {
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

  it('rejects node ids that could collide with object internals', async () => {
    const graph = {
      nodes: [promptNode('prompt'), generateNode('__proto__')],
      edges: [edge('prompt', '__proto__', 'prompt')],
    };
    const response = await createRun(await setup(), graph);
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
    expect(
      (await app.inject({ method: 'POST', url: '/api/runs/run_missing/nodes/x/retry' })).statusCode,
    ).toBe(404);
  });

  it('rate limits run creation per client', async () => {
    const app = await setup(1);
    expect((await createRun(app, branchingGraph())).statusCode).toBe(202);
    const limited = await createRun(app, branchingGraph());
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });

  it('counts run creation and retries against the same limit, but not polling', async () => {
    const app = await setup(2);
    expect((await createRun(app, branchingGraph())).statusCode).toBe(202);
    const retry = await app.inject({ method: 'POST', url: '/api/runs/run_missing/nodes/x/retry' });
    expect(retry.statusCode).toBe(404);

    const limited = await createRun(app, branchingGraph());
    expect(limited.statusCode).toBe(429);
    const polled = await app.inject({ method: 'GET', url: '/api/runs/run_missing' });
    expect(polled.statusCode).toBe(404);
  });
});
