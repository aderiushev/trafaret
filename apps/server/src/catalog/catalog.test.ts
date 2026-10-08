import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { createHttpServer } from '../http/server.ts';
import { ModelCatalog } from './catalog.ts';
import { registerCatalogRoutes } from './routes.ts';

const noKeys = { cloudflare: null, byteplus: null };
const allKeys = { cloudflare: { accountId: 'acc', apiToken: 'tok' }, byteplus: { apiKey: 'key' } };
const defaultOf = (catalog: ModelCatalog) => catalog.list().find((model) => model.default)?.id;

describe('ModelCatalog', () => {
  it('enables only the mock models without credentials and explains why', () => {
    const catalog = new ModelCatalog(noKeys);
    expect(
      catalog
        .list()
        .filter((model) => model.enabled)
        .map((model) => model.id),
    ).toEqual(['mock', 'mock-fails-first']);
    expect(catalog.get('seedream-4.5')).toMatchObject({
      enabled: false,
      unavailableReason: 'Set ARK_API_KEY on the server to enable this model.',
    });
    expect(defaultOf(catalog)).toBe('mock');
  });

  it('prefers Seedream, then FLUX, as the default model', () => {
    expect(defaultOf(new ModelCatalog(allKeys))).toBe('seedream-4.5');
    expect(defaultOf(new ModelCatalog({ ...allKeys, byteplus: null }))).toBe('flux-2-klein');
  });

  it('describes capabilities and per-aspect sizes', () => {
    const catalog = new ModelCatalog(noKeys);
    expect(catalog.get('flux-2-klein')).toMatchObject({
      provider: 'cloudflare',
      supportsEdit: true,
      supportsNegativePrompt: false,
      supportsSeed: true,
      maxReferenceImages: 4,
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    });
    expect(catalog.definition('seedream-4.5')?.sizes['16:9']).toEqual({ width: 2560, height: 1440 });
    expect(catalog.get('nope')).toBeUndefined();
  });

  it('serves the catalog over HTTP', async () => {
    const app = await createHttpServer({ logger: pino({ level: 'silent' }) });
    registerCatalogRoutes(app, { catalog: new ModelCatalog(noKeys) });
    const response = await app.inject({ method: 'GET', url: '/api/catalog' });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ models: unknown[] }>().models).toHaveLength(4);
  });
});
