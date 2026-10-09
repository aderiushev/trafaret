import { copyFile, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pino } from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { AssetStore, UnsupportedImageError } from '../assets/asset-store.ts';
import { createHttpServer } from '../http/server.ts';
import { makePng } from '../test/images.ts';
import { PresetRepository } from './preset-repository.ts';
import { registerLibraryRoutes } from './routes.ts';
import { SampleRepository } from './sample-repository.ts';

const libraryDir = fileURLToPath(new URL('../../library', import.meta.url));
const referenceFile = join(libraryDir, 'presets', 'references', 'premium-3d-1.webp');
const sampleFile = join(libraryDir, 'samples', 'sample-product.webp');

const tempDirs: string[] = [];

afterAll(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'trafaret-library-'));
  tempDirs.push(dir);
  return dir;
}

const loadPresets = (dir: string): Promise<PresetRepository> =>
  PresetRepository.load(dir, new AssetStore({ maxBytes: 1e8 }));

async function presetDir(mainPrompt: string, file = 'custom.json', body?: unknown): Promise<string> {
  const dir = await tempDir();
  await mkdir(join(dir, 'references'));
  await copyFile(referenceFile, join(dir, 'references', 'ref-1.webp'));
  const preset = body ?? {
    id: 'custom',
    name: 'Custom',
    mainPrompt,
    negativePrompt: '',
    references: ['/references/ref-1.webp'],
  };
  await writeFile(join(dir, file), JSON.stringify(preset));
  return dir;
}

describe('the library', () => {
  it('keeps every image at or under 200 KB', async () => {
    for (const dir of [join(libraryDir, 'presets', 'references'), join(libraryDir, 'samples')]) {
      for (const name of await readdir(dir)) {
        expect((await stat(join(dir, name))).size, name).toBeLessThanOrEqual(200 * 1024);
      }
    }
  });
});

describe('PresetRepository', () => {
  it('loads every preset file and pins its reference images', async () => {
    const assets = new AssetStore({ maxBytes: 1 }); // tiny budget: pinned references must survive
    const presets = await PresetRepository.load(join(libraryDir, 'presets'), assets);
    const premium = presets.get('premium-3d');
    expect(premium?.preset).toMatchObject({
      name: 'Premium 3D',
      references: ['/references/premium-3d-1.webp', '/references/premium-3d-2.webp'],
    });
    expect(premium?.referenceAssetIds).toHaveLength(2);
    for (const id of premium?.referenceAssetIds ?? []) expect(assets.has(id)).toBe(true);
  });

  it('lists presets with references resolved to asset URLs', async () => {
    const presets = await PresetRepository.load(
      join(libraryDir, 'presets'),
      new AssetStore({ maxBytes: 1e8 }),
    );
    expect(
      presets
        .list()
        .map((preset) => preset.id)
        .sort(),
    ).toEqual(['lifestyle', 'paper-craft', 'premium-3d']);
    expect(presets.list()[0]?.references[0]).toMatch(/^\/api\/assets\/[a-f0-9]{64}$/);
  });

  it('changes the content hash when the preset changes', async () => {
    const assets = new AssetStore({ maxBytes: 1e8 });
    const a = await PresetRepository.load(await presetDir('soft light'), assets);
    const b = await PresetRepository.load(await presetDir('hard light'), assets);
    expect(a.get('custom')?.contentHash).not.toBe(b.get('custom')?.contentHash);
  });

  it('derives the content hash from the reference images, not their file names', async () => {
    const assets = new AssetStore({ maxBytes: 1e8 });
    const original = await PresetRepository.load(await presetDir('soft light'), assets);
    const identical = await PresetRepository.load(await presetDir('soft light'), assets);
    const swappedDir = await presetDir('soft light');
    await copyFile(
      join(libraryDir, 'presets', 'references', 'premium-3d-2.webp'),
      join(swappedDir, 'references', 'ref-1.webp'),
    );
    const swapped = await PresetRepository.load(swappedDir, assets);
    expect(identical.get('custom')?.contentHash).toBe(original.get('custom')?.contentHash);
    expect(swapped.get('custom')?.contentHash).not.toBe(original.get('custom')?.contentHash);
  });

  it('names the file when a preset is invalid', async () => {
    const dir = await presetDir('', 'broken.json', { id: 'broken', mainPrompt: 'x' });
    await expect(PresetRepository.load(dir, new AssetStore({ maxBytes: 1e8 }))).rejects.toThrow(
      /broken\.json/,
    );
  });

  it('names the file and keeps the cause when a preset file is not valid JSON', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'broken.json'), '{ not json');
    await expect(loadPresets(dir)).rejects.toMatchObject({
      message: expect.stringMatching(/^Invalid preset broken\.json: not valid JSON \(.+\)$/),
      cause: expect.any(SyntaxError),
    });
  });

  it('names the file and the reference when a reference image is missing', async () => {
    const dir = await presetDir('soft light');
    await rm(join(dir, 'references', 'ref-1.webp'));
    await expect(loadPresets(dir)).rejects.toMatchObject({
      message: expect.stringMatching(
        /^Invalid preset custom\.json: reference \/references\/ref-1\.webp could not be loaded: ENOENT/,
      ),
      cause: expect.objectContaining({ code: 'ENOENT' }),
    });
  });

  it('names the file and the reference when a reference is not an image', async () => {
    const dir = await presetDir('soft light');
    await writeFile(join(dir, 'references', 'ref-1.webp'), 'definitely not an image');
    await expect(loadPresets(dir)).rejects.toMatchObject({
      message:
        'Invalid preset custom.json: reference /references/ref-1.webp could not be loaded: ' +
        'Only PNG, JPEG and WebP images are supported.',
      cause: expect.any(UnsupportedImageError),
    });
  });
});

describe('SampleRepository', () => {
  it('pins sample photos so they survive eviction', async () => {
    const assets = new AssetStore({ maxBytes: 1 }); // tiny budget: pinned samples must survive
    const samples = (await SampleRepository.load(join(libraryDir, 'samples'), assets)).list();
    expect(samples).toHaveLength(1);
    for (const sample of samples) expect(assets.has(sample.assetId)).toBe(true);
  });

  it('accepts upper-case image extensions', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'shot.PNG'), await makePng());
    const samples = await SampleRepository.load(dir, new AssetStore({ maxBytes: 1e8 }));
    expect(samples.list()).toMatchObject([{ id: 'shot', name: 'Shot' }]);
  });

  it('rejects two files that map to the same sample id', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'shot.png'), await makePng());
    await copyFile(sampleFile, join(dir, 'shot.webp'));
    await expect(SampleRepository.load(dir, new AssetStore({ maxBytes: 1e8 }))).rejects.toThrow(
      'Duplicate sample id "shot" (shot.png, shot.webp)',
    );
  });
});

describe('library routes', () => {
  it('serves presets and samples', async () => {
    const assets = new AssetStore({ maxBytes: 1e8 });
    const app = await createHttpServer({ logger: pino({ level: 'silent' }) });
    registerLibraryRoutes(app, {
      presets: await PresetRepository.load(join(libraryDir, 'presets'), assets),
      samples: await SampleRepository.load(join(libraryDir, 'samples'), assets),
    });

    const presets = await app.inject({ method: 'GET', url: '/api/presets' });
    expect(presets.statusCode).toBe(200);
    expect(presets.json<{ presets: unknown[] }>().presets).toHaveLength(3);

    const samples = await app.inject({ method: 'GET', url: '/api/samples' });
    expect(samples.json()).toMatchObject({
      samples: [{ id: 'sample-product', name: 'Sample product', width: 1024, height: 768 }],
    });
  });
});
