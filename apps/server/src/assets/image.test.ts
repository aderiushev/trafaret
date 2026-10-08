import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { makePng } from '../test/images.ts';
import { closestAspectRatio, fitWithin, inspectImage, toWebp } from './image.ts';

describe('inspectImage', () => {
  it('reads format and size from the bytes', async () => {
    expect(await inspectImage(await makePng(6, 4))).toEqual({
      format: 'png',
      mime: 'image/png',
      width: 6,
      height: 4,
    });
    expect(await inspectImage(await toWebp(await makePng(6, 4)))).toMatchObject({
      format: 'webp',
      mime: 'image/webp',
    });
  });

  it('rejects anything that is not PNG, JPEG or WebP', async () => {
    expect(await inspectImage(Buffer.from('hello'))).toBeNull();
    expect(
      await inspectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>')),
    ).toBeNull();
  });
});

describe('fitWithin', () => {
  it('shrinks large images to fit the box', async () => {
    const meta = await sharp(await fitWithin(await makePng(1200, 600), 511)).metadata();
    expect(meta.width).toBe(511);
    expect(meta.height).toBeLessThanOrEqual(511);
  });

  it('never enlarges small images', async () => {
    const meta = await sharp(await fitWithin(await makePng(40, 20), 511)).metadata();
    expect([meta.width, meta.height]).toEqual([40, 20]);
  });
});

describe('closestAspectRatio', () => {
  it.each([
    [1024, 1024, '1:1'],
    [1920, 1080, '16:9'],
    [1000, 1300, '3:4'],
    [500, 1200, '9:16'],
    [1300, 1000, '4:3'],
  ] as const)('maps %ix%i to %s', (width, height, expected) => {
    expect(closestAspectRatio(width, height)).toBe(expected);
  });
});
