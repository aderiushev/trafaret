import { sha256Hex } from '../lib/hash.ts';
import { inspectImage, uprightImage, type ImageInfo } from './image.ts';

export type StoredAsset = {
  readonly id: string;
  readonly bytes: Buffer;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  pinned: boolean;
};

export class UnsupportedImageError extends Error {
  constructor() {
    super('Only PNG, JPEG and WebP images are supported.');
    this.name = 'UnsupportedImageError';
  }
}

/** Validates the bytes; a photo with an EXIF rotation becomes its upright pixels, with their displayed size. */
async function toUpright(bytes: Buffer): Promise<{ bytes: Buffer; info: ImageInfo }> {
  const info = await inspectImage(bytes);
  if (!info) throw new UnsupportedImageError();
  if (info.orientation === 1) return { bytes, info };
  let upright: Buffer;
  try {
    upright = await uprightImage(bytes);
  } catch {
    throw new UnsupportedImageError();
  }
  const uprightInfo = await inspectImage(upright);
  if (!uprightInfo) throw new UnsupportedImageError();
  return { bytes: upright, info: uprightInfo };
}

/**
 * In-memory, content-addressed image store. The id is the SHA-256 of the stored bytes, so identical images dedupe and
 * an id never points at different content. Rotated photos are stored upright. Past `maxBytes`, the least recently used
 * unpinned images are evicted.
 */
export class AssetStore {
  private readonly assets = new Map<string, StoredAsset>();
  private readonly maxBytes: number;
  private totalBytes = 0;

  constructor(options: { maxBytes: number }) {
    this.maxBytes = options.maxBytes;
  }

  async put(bytes: Buffer, options: { pinned?: boolean } = {}): Promise<StoredAsset> {
    // Await before the lookup, never between it and the insert: concurrent puts would double-count bytes.
    const { bytes: upright, info } = await toUpright(bytes);
    const id = sha256Hex(upright);
    const existing = this.assets.get(id);
    if (existing) {
      if (options.pinned) existing.pinned = true;
      this.touch(existing);
      return existing;
    }
    const asset: StoredAsset = {
      id,
      bytes: upright,
      mime: info.mime,
      width: info.width,
      height: info.height,
      pinned: options.pinned ?? false,
    };
    this.assets.set(id, asset);
    this.totalBytes += upright.length;
    this.evict();
    return asset;
  }

  get(id: string): StoredAsset | undefined {
    const asset = this.assets.get(id);
    if (asset) this.touch(asset);
    return asset;
  }

  has(id: string): boolean {
    return this.assets.has(id);
  }

  get usage(): { count: number; bytes: number } {
    return { count: this.assets.size, bytes: this.totalBytes };
  }

  /** Map iteration order doubles as LRU order: re-inserting moves an asset to the end. */
  private touch(asset: StoredAsset): void {
    this.assets.delete(asset.id);
    this.assets.set(asset.id, asset);
  }

  private evict(): void {
    for (const asset of this.assets.values()) {
      if (this.totalBytes <= this.maxBytes) return;
      if (asset.pinned) continue;
      this.assets.delete(asset.id);
      this.totalBytes -= asset.bytes.length;
    }
  }
}
