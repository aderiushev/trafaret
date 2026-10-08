import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../lib/hash.ts';
import { makePng } from '../test/images.ts';
import { AssetStore, UnsupportedImageError } from './asset-store.ts';

describe('AssetStore', () => {
  it('stores images under the SHA-256 of their bytes', async () => {
    const png = await makePng(4, 3);
    const store = new AssetStore({ maxBytes: 1_000_000 });
    const asset = await store.put(png);
    expect(asset).toMatchObject({
      id: sha256Hex(png),
      mime: 'image/png',
      width: 4,
      height: 3,
      pinned: false,
    });
    expect(store.get(asset.id)?.bytes.equals(png)).toBe(true);
  });

  it('deduplicates identical images', async () => {
    const png = await makePng();
    const store = new AssetStore({ maxBytes: 1_000_000 });
    await store.put(png);
    await store.put(png);
    expect(store.usage).toEqual({ count: 1, bytes: png.length });
  });

  it('deduplicates identical images that arrive concurrently', async () => {
    const png = await makePng();
    const store = new AssetStore({ maxBytes: 1_000_000 });
    await Promise.all([store.put(png), store.put(png)]);
    expect(store.usage).toEqual({ count: 1, bytes: png.length });
  });

  it('rejects bytes that are not PNG, JPEG or WebP', async () => {
    const store = new AssetStore({ maxBytes: 1_000_000 });
    await expect(store.put(Buffer.from('hello'))).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it('evicts the least recently used image past the byte budget', async () => {
    const [a, b, c] = await Promise.all([
      makePng(8, 8, '#111111'),
      makePng(8, 8, '#222222'),
      makePng(8, 8, '#333333'),
    ]);
    const store = new AssetStore({ maxBytes: a.length + b.length + c.length - 1 });
    const first = await store.put(a);
    const second = await store.put(b);
    store.get(first.id); // touch: "a" becomes the most recently used
    const third = await store.put(c);
    expect(store.has(first.id)).toBe(true);
    expect(store.has(second.id)).toBe(false);
    expect(store.has(third.id)).toBe(true);
  });

  it('never evicts pinned images', async () => {
    const [a, b] = await Promise.all([makePng(8, 8, '#111111'), makePng(8, 8, '#222222')]);
    const store = new AssetStore({ maxBytes: 1 });
    const pinned = await store.put(a, { pinned: true });
    const loose = await store.put(b);
    expect(store.has(pinned.id)).toBe(true);
    expect(store.has(loose.id)).toBe(false);
  });
});
