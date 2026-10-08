import { describe, expect, it, vi } from 'vitest';
import type { Graph } from '@trafaret/core';
import {
  branchingGraph,
  edge,
  editNode,
  generateNode,
  promptNode,
  resultNode,
  withNode,
} from '@trafaret/core/testing';
import { busy, createHarness } from '../test/engine-harness.ts';

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
    expect(engine.getRun(runId)?.jobs['gen-a']?.error).toMatchObject({
      code: 'PROVIDER_ERROR',
      retryable: true,
    });

    engine.retryNode(runId, 'gen-a');
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('completed'));
    expect(engine.getRun(runId)?.jobs['gen-a']?.attempt).toBe(2);
  });

  it('starts a retried job from a clean slate', async () => {
    const { engine, provider } = await createHarness();
    const runId = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.call(1).reject(busy());
    provider.call(2).resolve();
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('failed'));
    expect(engine.getRun(runId)?.jobs['gen-a']).toMatchObject({
      error: { code: 'PROVIDER_ERROR' },
      request: { modelId: 'mock' }, // a failed AI job keeps what it sent
      model: { id: 'mock', provider: 'mock' },
    });

    engine.retryNode(runId, 'gen-a');
    // Nothing has run again yet, so this is the reset itself: no trace of the failed attempt is left.
    const reset = engine.getRun(runId)!.jobs['gen-a']!;
    expect(reset).toMatchObject({ status: 'queued', attempt: 2, startedAt: null, finishedAt: null });
    expect(reset.error).toBeUndefined();
    expect(reset.request).toBeUndefined();
    expect(reset.model).toBeUndefined();

    await vi.waitFor(() => expect(provider.calls).toHaveLength(3));
    provider.calls[2]!.resolve();
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('completed'));
  });

  it('does not re-run the successful ancestors of the failed node', async () => {
    const graph: Graph = {
      nodes: [
        promptNode('prompt'),
        generateNode('gen', { seed: 1 }),
        editNode('edit', { seed: 2 }),
        resultNode('result'),
      ],
      edges: [edge('prompt', 'gen', 'prompt'), edge('gen', 'edit', 'image'), edge('edit', 'result', 'image')],
    };
    const { engine, provider } = await createHarness();
    const runId = engine.startRun(graph);
    await vi.waitFor(() => expect(provider.calls).toHaveLength(1));
    provider.call(1).resolve(); // Generate succeeds…
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.call(2).reject(busy()); // …and Edit fails, which skips Result
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('failed'));

    expect(engine.retryNode(runId, 'result')).toBe('ok'); // retrying the skipped Result retries Edit
    await vi.waitFor(() => expect(provider.calls).toHaveLength(3));
    // Only Edit is called again, never Generate.
    expect(provider.calls[2]?.request).toMatchObject({ mode: 'edit', seed: 2, attempt: 2 });

    provider.calls[2]!.resolve();
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('completed'));
    expect(provider.calls).toHaveLength(3); // Generate was never called a second time
    const run = engine.getRun(runId)!;
    expect(run.jobs['gen']).toMatchObject({ status: 'success', attempt: 1 });
    expect(run.jobs['edit']).toMatchObject({ status: 'success', attempt: 2 });
    expect(run.jobs['result']).toMatchObject({ status: 'success', attempt: 1 });
  });

  it('resets the sibling dependents skipped by the same failure together', async () => {
    const graph: Graph = {
      nodes: [
        promptNode('prompt'),
        generateNode('gen', { seed: 1 }),
        resultNode('result-1'),
        resultNode('result-2'),
      ],
      edges: [
        edge('prompt', 'gen', 'prompt'),
        edge('gen', 'result-1', 'image'),
        edge('gen', 'result-2', 'image'),
      ],
    };
    const { engine, provider } = await createHarness();
    const runId = engine.startRun(graph);
    await vi.waitFor(() => expect(provider.calls).toHaveLength(1));
    provider.call(1).reject(busy());
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('failed'));
    for (const id of ['result-1', 'result-2']) {
      expect(engine.getRun(runId)?.jobs[id]?.error?.code).toBe('UPSTREAM_FAILED');
    }

    expect(engine.retryNode(runId, 'result-1')).toBe('ok');
    // Nothing has run again yet, so this is the reset itself: Result 2 was queued again along with Result 1.
    const sibling = engine.getRun(runId)!.jobs['result-2']!;
    expect(sibling).toMatchObject({ status: 'queued', attempt: 1 });
    expect(sibling.error).toBeUndefined();

    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.calls[1]!.resolve();
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('completed'));
    expect(provider.calls).toHaveLength(2); // one extra call serves both Results
    const run = engine.getRun(runId)!;
    expect(run.jobs['gen']).toMatchObject({ status: 'success', attempt: 2 });
    for (const id of ['result-1', 'result-2']) {
      expect(run.jobs[id]).toMatchObject({ status: 'success', attempt: 1 });
    }
  });

  it('leaves a reused node alone when the failed node above it is retried', async () => {
    // Room for one result only: storing Edit's pushes Generate's out, so the next run finds Edit reused
    // below a Generate that has to be called again.
    const { engine, provider } = await createHarness({ cacheEntries: 1 });
    const graph: Graph = {
      nodes: [
        promptNode('prompt'),
        generateNode('gen', { seed: 1 }),
        editNode('edit', { seed: 2 }),
        resultNode('result'),
      ],
      edges: [edge('prompt', 'gen', 'prompt'), edge('gen', 'edit', 'image'), edge('edit', 'result', 'image')],
    };
    const first = engine.startRun(graph);
    await vi.waitFor(() => expect(provider.calls).toHaveLength(1));
    provider.call(1).resolve();
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.call(2).resolve();
    await vi.waitFor(() => expect(engine.getRun(first)?.status).toBe('completed'));

    // The second run calls Generate again, while Edit is reused without waiting for it.
    const second = engine.startRun(graph);
    await vi.waitFor(() => expect(provider.calls).toHaveLength(3));
    expect(provider.calls[2]?.request).toMatchObject({ mode: 'generate', seed: 1, attempt: 1 });
    provider.calls[2]!.reject(busy());
    await vi.waitFor(() => expect(engine.getRun(second)?.status).toBe('failed'));
    expect(engine.getRun(second)?.jobs['edit']).toMatchObject({ status: 'success', cached: true });

    expect(engine.retryNode(second, 'gen')).toBe('ok');
    await vi.waitFor(() => expect(provider.calls).toHaveLength(4));
    expect(provider.calls[3]?.request).toMatchObject({ mode: 'generate', seed: 1, attempt: 2 });
    provider.calls[3]!.resolve();
    await vi.waitFor(() => expect(engine.getRun(second)?.status).toBe('completed'));
    expect(provider.calls).toHaveLength(4); // Edit was never called again
    const run = engine.getRun(second)!;
    expect(run.jobs['gen']).toMatchObject({ status: 'success', attempt: 2, cached: false });
    expect(run.jobs['edit']).toMatchObject({ status: 'success', attempt: 1, cached: true });
    expect(run.summary).toMatchObject({ reused: 1, failed: 0 });
  });

  it('keeps a reused sibling branch reused while the failed branch is retried', async () => {
    const { engine, provider } = await createHarness();
    const first = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.call(1).reject(busy());
    provider.call(2).resolve();
    await vi.waitFor(() => expect(engine.getRun(first)?.status).toBe('failed'));

    // Generate B is reused now; Generate A was never cached, so it is called again and fails again.
    const second = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(3));
    provider.calls[2]!.reject(busy());
    await vi.waitFor(() => expect(engine.getRun(second)?.status).toBe('failed'));
    expect(engine.getRun(second)?.jobs['gen-b']).toMatchObject({ status: 'success', cached: true });

    expect(engine.retryNode(second, 'gen-a')).toBe('ok');
    await vi.waitFor(() => expect(provider.calls).toHaveLength(4));
    expect(provider.calls[3]?.request).toMatchObject({ seed: 1, attempt: 2 });
    provider.calls[3]!.resolve();
    await vi.waitFor(() => expect(engine.getRun(second)?.status).toBe('completed'));
    expect(provider.calls).toHaveLength(4); // Generate B was not called again
    const run = engine.getRun(second)!;
    expect(run.jobs['gen-b']).toMatchObject({ status: 'success', cached: true, attempt: 1 });
    expect(run.summary).toMatchObject({ generated: 1, reused: 1, failed: 0 });
  });

  it('keeps a retried result that is built on a budget fallback out of the cache', async () => {
    const { engine, provider } = await createHarness({
      credentials: { cloudflare: true },
      dailyLimits: { cloudflare: 0 },
    });
    const graph: Graph = {
      nodes: [
        promptNode('prompt'),
        generateNode('gen', { seed: 1, modelId: 'flux-2-klein' }),
        editNode('edit', { seed: 2 }),
        resultNode('result'),
      ],
      edges: [edge('prompt', 'gen', 'prompt'), edge('gen', 'edit', 'image'), edge('edit', 'result', 'image')],
    };
    const first = engine.startRun(graph);
    await vi.waitFor(() => expect(provider.calls).toHaveLength(1));
    provider.call(1).resolve(); // Generate runs on Mock past its cap…
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.call(2).reject(busy()); // …and the Edit below it fails
    await vi.waitFor(() => expect(engine.getRun(first)?.status).toBe('failed'));

    expect(engine.retryNode(first, 'edit')).toBe('ok');
    await vi.waitFor(() => expect(provider.calls).toHaveLength(3));
    provider.calls[2]!.resolve();
    await vi.waitFor(() => expect(engine.getRun(first)?.status).toBe('completed'));

    // The retried Edit is still made from the fallback image, so the next run makes it again.
    const second = engine.startRun(graph);
    await vi.waitFor(() => expect(provider.calls).toHaveLength(4));
    provider.calls[3]!.resolve();
    await vi.waitFor(() => expect(provider.calls).toHaveLength(5));
    provider.calls[4]!.resolve();
    await vi.waitFor(() => expect(engine.getRun(second)?.status).toBe('completed'));
    expect(engine.getRun(second)?.jobs['edit']?.cached).toBe(false);
  });
});
