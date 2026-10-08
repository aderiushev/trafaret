import type { ImageOutput, JobModel, RequestPreview } from '@trafaret/core';

export type CacheEntry = {
  output: ImageOutput;
  durationMs: number;
  request: RequestPreview;
  model: JobModel;
};

/** LRU map of successful AI results by cache key. */
export class ResultCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly isValid: (entry: CacheEntry) => boolean;

  constructor(options: { maxEntries: number; isValid?: (entry: CacheEntry) => boolean }) {
    this.maxEntries = options.maxEntries;
    this.isValid = options.isValid ?? (() => true);
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (!this.isValid(entry)) return undefined;
    this.entries.set(key, entry);
    return entry;
  }

  set(key: string, entry: CacheEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
    for (const oldest of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
