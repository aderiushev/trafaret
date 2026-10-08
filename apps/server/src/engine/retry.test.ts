import { describe, expect, it, vi } from 'vitest';
import { branchingGraph, generateNode, withNode } from '@trafaret/core/testing';
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
});
