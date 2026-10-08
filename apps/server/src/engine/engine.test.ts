import { describe, expect, it, vi } from 'vitest';
import type { Graph } from '@trafaret/core';
import { branchingGraph, edge, editNode, generateNode, promptNode } from '@trafaret/core/testing';
import { busy, createHarness } from '../test/engine-harness.ts';

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
    expect(done.jobs['result-a']?.output).toMatchObject({
      kind: 'image',
      url: expect.stringMatching(/^\/api\/assets\//),
    });
    expect(done.jobs['gen-a']).toMatchObject({
      request: { prompt: 'A white sneaker on a stone pedestal', modelId: 'mock' },
      model: { id: 'mock', provider: 'mock' },
    });
    expect(done.summary).toMatchObject({ aiNodes: 2, generated: 2, reused: 0, failed: 0 });
    expect(done.finishedAt).not.toBeNull();
  });

  it('starts a node as soon as its own inputs are ready, not level by level', async () => {
    const graph: Graph = {
      nodes: [
        promptNode('prompt'),
        generateNode('gen-a', { seed: 1 }),
        editNode('edit-a', { seed: 3 }),
        generateNode('gen-b', { seed: 2 }),
      ],
      edges: [
        edge('prompt', 'gen-a', 'prompt'),
        edge('gen-a', 'edit-a', 'image'),
        edge('prompt', 'gen-b', 'prompt'),
      ],
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
    expect(run.jobs['gen-a']).toMatchObject({
      status: 'error',
      error: { code: 'PROVIDER_ERROR', retryable: true },
    });
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
