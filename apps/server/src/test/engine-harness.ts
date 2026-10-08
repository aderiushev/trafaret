import { pino } from 'pino';
import type { ProviderId } from '@trafaret/core';
import { AssetStore } from '../assets/asset-store.ts';
import { ModelCatalog } from '../catalog/catalog.ts';
import { Engine } from '../engine/engine.ts';
import { Semaphore } from '../lib/semaphore.ts';
import { PresetRepository, type ResolvedPreset } from '../library/preset-repository.ts';
import { createMockProvider } from '../providers/mock.ts';
import {
  ProviderError,
  type ImageProvider,
  type ProviderRequest,
  type ProviderResult,
} from '../providers/types.ts';
import { RunRepository } from '../runs/run-repository.ts';
import { makePng } from './images.ts';

/** A retryable provider failure for tests. */
export const busy = (): ProviderError =>
  new ProviderError('PROVIDER_ERROR', 'The AI service is busy. Retry in a few seconds.', true);

export type PendingCall = {
  request: ProviderRequest;
  signal: AbortSignal;
  resolve: () => void;
  reject: (error: Error) => void;
};

/**
 * A provider whose calls stay pending until the test resolves or rejects them. By default a call also rejects when
 * its signal aborts, like a well-behaved provider; with `ignoreAbort` it never reacts to the signal.
 */
export class ControlledProvider implements ImageProvider {
  readonly id = 'mock' as const;
  readonly calls: PendingCall[] = [];
  private readonly image: Buffer;
  private readonly ignoreAbort: boolean;

  constructor(image: Buffer, options: { ignoreAbort?: boolean } = {}) {
    this.image = image;
    this.ignoreAbort = options.ignoreAbort ?? false;
  }

  generate(request: ProviderRequest, signal: AbortSignal): Promise<ProviderResult> {
    return new Promise((resolve, reject) => {
      this.calls.push({ request, signal, resolve: () => resolve({ bytes: this.image }), reject });
      if (this.ignoreAbort) return;
      signal.addEventListener(
        'abort',
        () => reject(signal.reason instanceof Error ? signal.reason : new Error('aborted')),
        { once: true },
      );
    });
  }

  /** The most recent call for the node with this seed (fixtures give every AI node its own seed). */
  call(seed: number): PendingCall {
    const found = this.calls.findLast((pending) => pending.request.seed === seed);
    if (!found) throw new Error(`no provider call with seed ${seed}`);
    return found;
  }
}

export type HarnessOptions = {
  maxConcurrentJobs?: number;
  jobTimeoutMs?: number;
  presets?: ResolvedPreset[];
  /** Use the real (instant) mock provider instead of the controlled one. */
  realMock?: boolean;
  /** The controlled provider never reacts to the abort signal, like a provider that ignores timeouts. */
  ignoreAbort?: boolean;
  now?: () => number;
};

export async function createHarness(options: HarnessOptions = {}) {
  const provider = new ControlledProvider(await makePng(16, 16), {
    ignoreAbort: options.ignoreAbort ?? false,
  });
  const assets = new AssetStore({ maxBytes: 64 * 1024 * 1024 });
  const catalog = new ModelCatalog({ cloudflare: null, byteplus: null });
  const presets = new PresetRepository(options.presets ?? []);
  const providers: Partial<Record<ProviderId, ImageProvider>> = {
    mock: options.realMock ? createMockProvider({ latencyMs: { min: 0, max: 0 } }) : provider,
  };
  const engine = new Engine({
    catalog,
    presets,
    assets,
    providers,
    runs: new RunRepository({ maxRuns: 50, retentionMs: 60 * 60 * 1000 }),
    semaphore: new Semaphore(options.maxConcurrentJobs ?? 4),
    jobTimeoutMs: options.jobTimeoutMs ?? 5_000,
    logger: pino({ level: 'silent' }),
    ...(options.now ? { now: options.now } : {}),
  });
  return { engine, provider, assets, catalog, presets };
}
