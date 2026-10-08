import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { makePng } from '../test/images.ts';
import { createMockProvider } from './mock.ts';
import type { ProviderRequest } from './types.ts';

const request = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
  model: 'mock',
  mode: 'generate',
  prompt: 'A white sneaker on a stone pedestal',
  negativePrompt: null,
  images: [],
  width: 64,
  height: 48,
  seed: 7,
  attempt: 1,
  ...overrides,
});
const instant = createMockProvider({ latencyMs: { min: 0, max: 0 } });
const signal = new AbortController().signal;

describe('mock provider', () => {
  it('renders a PNG of the requested size', async () => {
    const { bytes } = await instant.generate(request(), signal);
    expect(await sharp(bytes).metadata()).toMatchObject({ format: 'png', width: 64, height: 48 });
  });

  it('is deterministic for the same prompt and seed', async () => {
    const [a, b, c] = await Promise.all([
      instant.generate(request(), signal),
      instant.generate(request(), signal),
      instant.generate(request({ seed: 8 }), signal),
    ]);
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.bytes.equals(c.bytes)).toBe(false);
  });

  it('renders prompts with characters that XML forbids', async () => {
    const { bytes } = await instant.generate(request({ prompt: 'A white\u0001 sneaker ￿' }), signal);
    expect(await sharp(bytes).metadata()).toMatchObject({ format: 'png', width: 64, height: 48 });
  });

  it('builds on the source image in edit mode', async () => {
    const source = { bytes: await makePng(20, 20, '#00ff00'), mime: 'image/png' };
    const { bytes } = await instant.generate(request({ mode: 'edit', images: [source] }), signal);
    expect(await sharp(bytes).metadata()).toMatchObject({ width: 64, height: 48 });
  });

  it('fails only the first attempt of the "fails first attempt" model', async () => {
    await expect(
      instant.generate(request({ model: 'mock-fails-first', attempt: 1 }), signal),
    ).rejects.toMatchObject({
      name: 'ProviderError',
      retryable: true,
    });
    await expect(
      instant.generate(request({ model: 'mock-fails-first', attempt: 2 }), signal),
    ).resolves.toBeDefined();
  });

  it('stops waiting when the signal aborts', async () => {
    const slow = createMockProvider({ latencyMs: { min: 5_000, max: 5_000 } });
    await expect(slow.generate(request(), AbortSignal.timeout(10))).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });
});
