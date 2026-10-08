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
    // get() (not has()) refreshes the image's LRU recency, so results that keep being reused don't age out of the store.
    cache: new ResultCache({
      maxEntries: 500,
      isValid: (entry) => assets.get(entry.output.assetId) !== undefined,
    }),
    runs: new RunRepository({ maxRuns: 200, retentionMs: 60 * 60 * 1000 }),
    semaphore: new Semaphore(config.maxConcurrentJobs),
    budget: new DailyBudget({
      cloudflare: config.dailyLimits.cloudflare,
      byteplus: config.dailyLimits.byteplus,
    }),
    jobTimeoutMs: config.jobTimeoutMs,
    logger,
  });

  return { assets, presets, samples, catalog, engine };
}
