import { describe, expect, it, vi } from 'vitest';
import type { Graph } from '@trafaret/core';
import {
  branchingGraph,
  edge,
  editNode,
  generateNode,
  imageInputNode,
  promptNode,
  resultNode,
} from '@trafaret/core/testing';
import { busy, createHarness } from '../test/engine-harness.ts';
import { makePng } from '../test/images.ts';

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

  it('settles a job at its deadline even when the provider ignores the abort signal', async () => {
    const { engine, provider } = await createHarness({
      maxConcurrentJobs: 1,
      jobTimeoutMs: 30,
      ignoreAbort: true,
    });
    const runId = engine.startRun(branchingGraph());

    // Only the deadline can end these jobs: the provider never settles a call and never reacts to the signal.
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('failed'));
    const run = engine.getRun(runId)!;
    for (const id of ['gen-a', 'gen-b']) {
      expect(run.jobs[id]).toMatchObject({ status: 'error', error: { code: 'TIMEOUT', retryable: true } });
    }
    // With a single permit, the second call can only exist if the first job gave its permit back at the deadline.
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls.every((call) => call.signal.aborted)).toBe(true);
  });

  it('leaves no rejected deadline behind when a provider throws synchronously', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const { engine, provider } = await createHarness({ jobTimeoutMs: 30 });
      const signals: AbortSignal[] = [];
      vi.spyOn(provider, 'generate').mockImplementation((_request, signal) => {
        signals.push(signal);
        throw new Error('thrown before any promise exists');
      });
      const runId = engine.startRun(branchingGraph());
      await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('failed'));
      expect(engine.getRun(runId)?.jobs['gen-a']?.error).toMatchObject({ code: 'INTERNAL' });
      expect(signals).toHaveLength(2);

      // Let every deadline pass, then one more turn of the event loop for Node to report unhandled rejections.
      await Promise.all(
        signals.map(
          (signal) =>
            new Promise<void>((resolve) => {
              if (signal.aborted) resolve();
              else signal.addEventListener('abort', () => resolve(), { once: true });
            }),
        ),
      );
      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('skips everything below a failure and names the node that actually failed', async () => {
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
    provider.call(1).reject(busy());

    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('failed'));
    const run = engine.getRun(runId)!;
    for (const id of ['edit', 'result']) {
      expect(run.jobs[id]).toMatchObject({
        status: 'error',
        error: { code: 'UPSTREAM_FAILED', upstreamNodeId: 'gen', message: 'Skipped: Generate Image failed.' },
      });
    }
    expect(provider.calls).toHaveLength(1); // the skipped Edit never reached the provider
    expect(run.summary).toMatchObject({ aiNodes: 2, generated: 0, failed: 1 });
  });

  it('bumps the run version on every change', async () => {
    const { engine, provider } = await createHarness();
    const runId = engine.startRun(branchingGraph());
    const queued = engine.getRun(runId)!.version;
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    const running = engine.getRun(runId)!.version;
    provider.call(1).resolve();
    provider.call(2).resolve();
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('completed'));
    const done = engine.getRun(runId)!.version;
    expect(queued).toBe(0);
    expect(running).toBeGreaterThan(queued);
    expect(done).toBeGreaterThan(running);
  });

  it('stamps when every job started and finished', async () => {
    let tick = 1_000;
    const { engine, provider } = await createHarness({ now: () => (tick += 10) });
    const runId = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.call(1).resolve();
    provider.call(2).resolve();
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('completed'));
    const run = engine.getRun(runId)!;
    for (const job of Object.values(run.jobs)) {
      expect(job.startedAt).toBeGreaterThan(run.startedAt!);
      expect(job.finishedAt).toBeGreaterThan(job.startedAt!);
    }
    const lastJobFinish = Math.max(...Object.values(run.jobs).map((job) => job.finishedAt!));
    expect(run.finishedAt).toBeGreaterThanOrEqual(lastJobFinish);
  });

  it('sends generation requests with the node settings and the attempt number', async () => {
    const { engine, provider } = await createHarness();
    engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    expect(provider.call(1).request).toMatchObject({
      model: 'mock',
      mode: 'generate',
      prompt: 'A white sneaker on a stone pedestal',
      width: 1024,
      height: 1024,
      seed: 1,
      attempt: 1,
      images: [],
    });
  });

  it('sends edit requests with the source image, the instruction and the source aspect ratio', async () => {
    const { engine, provider, assets } = await createHarness();
    const source = await assets.put(await makePng(40, 30));
    const graph: Graph = {
      nodes: [imageInputNode('photo', source.id), editNode('edit', { seed: 5 }), resultNode('result')],
      edges: [edge('photo', 'edit', 'image'), edge('edit', 'result', 'image')],
    };
    engine.startRun(graph);
    await vi.waitFor(() => expect(provider.calls).toHaveLength(1));
    const { request } = provider.call(5);
    expect(request).toMatchObject({
      mode: 'edit',
      prompt: 'Replace the background with plain studio grey',
      width: 1024,
      height: 768, // 40x30 is closest to 4:3
    });
    expect(request.images).toHaveLength(1);
    expect(request.images[0]!.bytes.equals(source.bytes)).toBe(true);
  });

  it('stores generated images as WebP', async () => {
    const { engine, provider, assets } = await createHarness();
    const runId = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.call(1).resolve();
    provider.call(2).resolve();
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('completed'));
    const output = engine.getRun(runId)?.jobs['result-a']?.output;
    if (output?.kind !== 'image') throw new Error('expected an image output');
    expect(assets.get(output.assetId)?.mime).toBe('image/webp');
  });

  it('hides unexpected errors behind a generic, retryable message', async () => {
    const { engine, provider } = await createHarness();
    const runId = engine.startRun(branchingGraph());
    await vi.waitFor(() => expect(provider.calls).toHaveLength(2));
    provider.call(1).reject(new TypeError('socket hang up at 10.0.0.7'));
    provider.call(2).resolve();
    await vi.waitFor(() => expect(engine.getRun(runId)?.status).toBe('failed'));
    expect(engine.getRun(runId)?.jobs['gen-a']?.error).toEqual({
      code: 'INTERNAL',
      message: 'Something went wrong on our side. Retry in a few seconds.',
      retryable: true,
    });
  });
});
