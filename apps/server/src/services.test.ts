import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { Run } from '@trafaret/core';
import { branchingGraph } from '@trafaret/core/testing';
import { loadConfig } from './config.ts';
import { createServices } from './services.ts';
import { RENDER_TEST_TIMEOUT_MS, waitForRun } from './test/wait.ts';

// The runs render real Mock images at full size; the suite timeout leaves room for that on a loaded machine.
describe('createServices', { timeout: RENDER_TEST_TIMEOUT_MS }, () => {
  it('keeps the images behind reused results fresh in the asset store', async () => {
    const config = loadConfig({ NODE_ENV: 'test', MOCK_LATENCY_MS: '0-0' });
    const { assets, engine } = await createServices(config, pino({ level: 'silent' }));

    const completed = (runId: string): Promise<Run> => waitForRun(engine, runId, 'completed');
    const generatedAssetIds = (run: Run): string[] =>
      ['gen-a', 'gen-b'].map((nodeId) => {
        const output = run.jobs[nodeId]?.output;
        if (output?.kind !== 'image') throw new Error(`${nodeId} produced no image`);
        return output.assetId;
      });

    const generated = generatedAssetIds(await completed(engine.startRun(branchingGraph())));

    // AssetStore.get() refreshes an image's LRU recency; has() would leave it to age out while its result is reused.
    const get = vi.spyOn(assets, 'get');
    const second = await completed(engine.startRun(branchingGraph()));

    expect(second.summary).toMatchObject({ generated: 0, reused: 2 });
    for (const assetId of generated) expect(get).toHaveBeenCalledWith(assetId);
  });
});
