import { describe, expect, it } from 'vitest';
import type { Preset } from '@trafaret/core';
import { MODEL_DEFINITIONS, type ModelDefinition } from '../catalog/models.ts';
import { buildRequest, type RequestBuilderInput } from './request-builder.ts';

const model = (id: string): ModelDefinition => {
  const found = MODEL_DEFINITIONS.find((definition) => definition.id === id);
  if (!found) throw new Error(`no model ${id}`);
  return found;
};

const premium = (references = 2): { preset: Preset; referenceAssetIds: string[] } => ({
  preset: {
    id: 'premium-3d',
    name: 'Premium 3D',
    mainPrompt: 'premium minimal 3D render, soft studio lighting.',
    negativePrompt: 'clutter, text',
    references: [],
  },
  referenceAssetIds: Array.from({ length: references }, (_, i) => `ref-${i + 1}`),
});

const input = (overrides: Partial<RequestBuilderInput> = {}): RequestBuilderInput => ({
  userText: 'A white sneaker',
  aspectRatio: '1:1',
  seed: 7,
  model: model('flux-2-klein'),
  preset: null,
  sourceAssetId: null,
  ...overrides,
});

describe('buildRequest', () => {
  it('uses the user text alone when there is no preset', () => {
    const built = buildRequest(input());
    expect(built).toMatchObject({
      prompt: 'A white sneaker',
      negativePrompt: null,
      referenceAssetIds: [],
      seed: 7,
    });
    expect(built.preview).toMatchObject({ negativeMode: 'none', negativePrompt: null, warnings: [] });
  });

  it('merges the main prompt and folds the negative prompt for models without a native field', () => {
    const built = buildRequest(input({ preset: premium() }));
    expect(built.prompt).toBe(
      'A white sneaker. premium minimal 3D render, soft studio lighting. Avoid: clutter, text.',
    );
    expect(built.negativePrompt).toBeNull();
    expect(built.preview).toMatchObject({ negativeMode: 'folded', negativePrompt: 'clutter, text' });
  });

  it('sends the negative prompt natively when the model supports it', () => {
    const built = buildRequest(input({ model: model('mock'), preset: premium() }));
    expect(built.prompt).toBe('A white sneaker. premium minimal 3D render, soft studio lighting');
    expect(built.negativePrompt).toBe('clutter, text');
    expect(built.preview.negativeMode).toBe('native');
  });

  it('puts the edit source first, then preset references', () => {
    const built = buildRequest(input({ preset: premium(), sourceAssetId: 'src' }));
    expect(built.referenceAssetIds).toEqual(['src', 'ref-1', 'ref-2']);
    expect(built.preview.references.map((reference) => reference.role)).toEqual([
      'source',
      'preset',
      'preset',
    ]);
    expect(built.preview.references[0]?.url).toBe('/api/assets/src');
  });

  it('drops references beyond the model limit and says so', () => {
    const built = buildRequest(input({ preset: premium(5), sourceAssetId: 'src' }));
    expect(built.referenceAssetIds).toEqual(['src', 'ref-1', 'ref-2', 'ref-3']);
    expect(built.preview.warnings).toEqual(['2 of 6 reference images dropped: FLUX.2 klein 4B accepts 4.']);
  });

  it('uses the model size for the aspect ratio and drops the seed when unsupported', () => {
    const built = buildRequest(input({ model: model('seedream-4.5'), aspectRatio: '16:9' }));
    expect(built).toMatchObject({ width: 2560, height: 1440, seed: null });
    expect(built.preview).toMatchObject({ aspectRatio: '16:9', seed: null, modelId: 'seedream-4.5' });
  });

  it('trims trailing punctuation before joining', () => {
    expect(buildRequest(input({ userText: 'A white sneaker!!! ', preset: premium() })).prompt).toMatch(
      /^A white sneaker\. premium/,
    );
  });
});
