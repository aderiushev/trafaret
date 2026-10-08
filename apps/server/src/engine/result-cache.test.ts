import { describe, expect, it } from 'vitest';
import { ResultCache, type CacheEntry } from './result-cache.ts';

const entry = (assetId: string): CacheEntry => ({
  output: { kind: 'image', assetId, url: `/api/assets/${assetId}`, width: 1, height: 1 },
  durationMs: 1000,
  request: {
    modelId: 'mock',
    prompt: 'p',
    negativePrompt: null,
    negativeMode: 'none',
    references: [],
    aspectRatio: '1:1',
    seed: 1,
    warnings: [],
  },
  model: { id: 'mock', provider: 'mock' },
});

describe('ResultCache', () => {
  it('returns stored entries', () => {
    const cache = new ResultCache({ maxEntries: 10 });
    cache.set('k', entry('a'));
    expect(cache.get('k')?.output.assetId).toBe('a');
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts the least recently used entry past the limit', () => {
    const cache = new ResultCache({ maxEntries: 2 });
    cache.set('a', entry('a'));
    cache.set('b', entry('b'));
    cache.get('a');
    cache.set('c', entry('c'));
    expect(cache.get('a')).toBeDefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.size).toBe(2);
  });

  it('drops entries that are no longer valid', () => {
    const cache = new ResultCache({ maxEntries: 10, isValid: (cached) => cached.output.assetId !== 'gone' });
    cache.set('k', entry('gone'));
    expect(cache.get('k')).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});
