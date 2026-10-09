/**
 * Generates the preset reference images and the sample product photo with FLUX.2 klein, through the project's own
 * Cloudflare adapter, and writes them to apps/server/library as WebP (at most 200 KB each). Needs the Cloudflare keys.
 *
 * Run from the repository root: node --env-file=.env apps/server/scripts/generate-library-assets.ts [name ...]
 * With names (e.g. `sample-product`), only those images are generated again.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { AspectRatio } from '@trafaret/core';
import { MODEL_DEFINITIONS } from '../src/catalog/models.ts';
import { loadConfig } from '../src/config.ts';
import { createCloudflareProvider } from '../src/providers/cloudflare.ts';

type LibraryImage = {
  name: string;
  /** Relative to apps/server/library. */
  path: string;
  prompt: string;
  aspectRatio: AspectRatio;
  seed: number;
  /** The longer side of the stored image, in pixels. */
  maxSide: number;
};

/**
 * References show a preset's look without a strong subject of their own, so they steer the style of a generation
 * without pulling their objects into it. The sample is a casual photo the Edit templates can visibly clean up.
 */
const IMAGES: readonly LibraryImage[] = [
  {
    name: 'premium-3d-1',
    path: 'presets/references/premium-3d-1.webp',
    prompt:
      'Premium minimal 3D render of pastel geometric shapes, a sphere, an arch and round podiums, soft studio ' +
      'lighting, matte materials, gentle shadows, clean pastel peach backdrop, no text',
    aspectRatio: '1:1',
    seed: 1101,
    maxSide: 768,
  },
  {
    name: 'premium-3d-2',
    path: 'presets/references/premium-3d-2.webp',
    prompt:
      'Premium minimal 3D render of stacked pastel blocks and a cylinder plinth in front of a soft gradient backdrop, ' +
      'soft studio lighting, matte clay materials, gentle contact shadows, no text',
    aspectRatio: '1:1',
    seed: 1102,
    maxSide: 768,
  },
  {
    name: 'lifestyle-1',
    path: 'presets/references/lifestyle-1.webp',
    prompt:
      'Natural daylight lifestyle photo of a sunlit living room corner with a linen sofa, a wool throw and green ' +
      'plants, warm tones, shallow depth of field, real home setting',
    aspectRatio: '1:1',
    seed: 2101,
    maxSide: 768,
  },
  {
    name: 'lifestyle-2',
    path: 'presets/references/lifestyle-2.webp',
    prompt:
      'Natural daylight lifestyle photo of a kitchen corner with a wooden counter, a linen towel and soft window ' +
      'light, warm tones, shallow depth of field, real home setting',
    aspectRatio: '1:1',
    seed: 2102,
    maxSide: 768,
  },
  {
    name: 'paper-craft-1',
    path: 'presets/references/paper-craft-1.webp',
    prompt:
      'Handmade paper-craft diorama of rolling hills, round trees and fluffy clouds made of layered cut paper, soft ' +
      'shadows, playful colors',
    aspectRatio: '1:1',
    seed: 3101,
    maxSide: 768,
  },
  {
    name: 'paper-craft-2',
    path: 'presets/references/paper-craft-2.webp',
    prompt:
      'Handmade paper-craft diorama of a tiny town street with colorful houses and a hot air balloon, layered cut ' +
      'paper, soft shadows, playful colors',
    aspectRatio: '1:1',
    seed: 3102,
    maxSide: 768,
  },
  {
    name: 'sample-product',
    path: 'samples/sample-product.webp',
    prompt:
      'Casual smartphone photo of a matte sage-green ceramic teapot with a bamboo handle on a cluttered dining ' +
      'table with mail, keys and a laptop, mixed indoor light, realistic',
    aspectRatio: '4:3',
    seed: 4101,
    maxSide: 1024,
  },
];

/** The spec keeps every committed library image at or under 200 KB. */
const MAX_BYTES = 200 * 1024;
const QUALITIES = [82, 76, 70] as const;

const libraryDir = fileURLToPath(new URL('../library/', import.meta.url));
const config = loadConfig(process.env);
if (!config.cloudflare) throw new Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env first.');
const model = MODEL_DEFINITIONS.find((definition) => definition.id === 'flux-2-klein');
if (!model) throw new Error('The model catalog has no flux-2-klein.');
const provider = createCloudflareProvider(config.cloudflare);

const only = process.argv.slice(2);
const unknown = only.filter((name) => !IMAGES.some((image) => image.name === name));
if (unknown.length > 0) throw new Error(`Unknown image name: ${unknown.join(', ')}`);

for (const image of IMAGES.filter(({ name }) => only.length === 0 || only.includes(name))) {
  const { width, height } = model.sizes[image.aspectRatio];
  const { bytes } = await provider.generate(
    {
      model: model.providerModel,
      mode: 'generate',
      prompt: image.prompt,
      negativePrompt: null,
      images: [],
      width,
      height,
      seed: image.seed,
      attempt: 1,
    },
    AbortSignal.timeout(config.jobTimeoutMs),
  );
  const webp = await smallEnoughWebp(bytes, image.maxSide);
  const target = join(libraryDir, image.path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, webp);
  console.log(`wrote ${image.path} (${Math.round(webp.length / 1024)} KB)`);
}

/** The best of a few WebP qualities that fits the size budget. */
async function smallEnoughWebp(bytes: Buffer, maxSide: number): Promise<Buffer> {
  const resized = sharp(bytes).resize({ width: maxSide, height: maxSide, fit: 'inside' });
  for (const quality of QUALITIES) {
    const webp = await resized.clone().webp({ quality }).toBuffer();
    if (webp.length <= MAX_BYTES) return webp;
  }
  throw new Error(`The image stays over ${MAX_BYTES / 1024} KB even at WebP quality ${QUALITIES.at(-1)}.`);
}
