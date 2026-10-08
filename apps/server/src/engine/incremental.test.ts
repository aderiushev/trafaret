import { describe, expect, it, vi } from 'vitest';
import type { Graph } from '@trafaret/core';
import { branchingGraph, edge, editNode, generateNode, promptNode, withNode } from '@trafaret/core/testing';
import type { ResolvedPreset } from '../library/preset-repository.ts';
import { busy, createHarness } from '../test/engine-harness.ts';

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

    const second = engine.startRun(
      withNode(graph, generateNode('gen-b', { seed: 2, presetId: 'lifestyle' })),
    );
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
    provider.call(1).reject(busy());
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

  it('marks a reused job finished at the run start, with its original request and model', async () => {
    let tick = 1_000;
    const { engine, provider } = await createHarness({ now: () => (tick += 10) });
    const first = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.calls.forEach((call) => call.resolve());
    await vi.waitFor(() => expect(engine.getRun(first)?.status).toBe('completed'));
    const original = engine.getRun(first)!.jobs['gen-a']!;
    expect(original).toMatchObject({
      output: { kind: 'image' },
      request: { modelId: 'mock', seed: 1 },
      model: { id: 'mock', provider: 'mock' },
    });

    const second = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(engine.getRun(second)?.status).toBe('completed'));
    const run = engine.getRun(second)!;
    expect(run.startedAt).toEqual(expect.any(Number));
    expect(run.jobs['gen-a']).toEqual({
      nodeId: 'gen-a',
      nodeType: 'generateImage',
      status: 'success',
      attempt: 1,
      cached: true,
      startedAt: run.startedAt, // reused work takes no time: it starts and finishes with the run
      finishedAt: run.startedAt,
      output: original.output,
      request: original.request,
      model: original.model,
    });
  });

  it('falls back to the mock model once the daily budget is spent, and does not cache that', async () => {
    const { engine } = await createHarness({
      realMock: true,
      credentials: { cloudflare: true },
      dailyLimits: { cloudflare: 0 },
    });
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

  it('labels a fallback job while its call is still pending, and sends it to the mock model', async () => {
    const { engine, provider } = await createHarness({
      credentials: { cloudflare: true },
      dailyLimits: { cloudflare: 0 },
    });
    const graph = withNode(branchingGraph(), generateNode('gen-a', { seed: 1, modelId: 'flux-2-klein' }));
    const runId = engine.startRun(graph);
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));

    expect(engine.getRun(runId)?.jobs['gen-a']).toMatchObject({
      status: 'running',
      model: { id: 'mock', provider: 'mock', fallbackFrom: 'flux-2-klein' },
      request: { modelId: 'flux-2-klein' }, // the preview still shows what was asked for
    });
    expect(engine.getRun(runId)?.jobs['gen-b']?.model?.fallbackFrom).toBeUndefined();
    expect(provider.call(1).request.model).toBe('mock'); // not the Cloudflare model identifier

    provider.calls.forEach((call) => call.resolve());
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('completed'));
  });
});
