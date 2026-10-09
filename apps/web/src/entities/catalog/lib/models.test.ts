import { describe, expect, it } from 'vitest';
import type { ImageModel } from '@trafaret/core';
import { defaultModelId, supportedAspectRatio } from './models';

const model = (id: string, fields: Partial<ImageModel> = {}): ImageModel => ({
  id,
  label: id,
  provider: 'mock',
  default: false,
  enabled: true,
  unavailableReason: null,
  supportsEdit: true,
  supportsNegativePrompt: true,
  supportsSeed: true,
  maxReferenceImages: 4,
  aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
  costPerImageUsd: 0,
  ...fields,
});

describe('defaultModelId', () => {
  it("prefers the server's default", () => {
    expect(defaultModelId([model('a'), model('b', { default: true })], 'generate')).toBe('b');
  });

  it('skips disabled models', () => {
    const models = [model('a', { enabled: false, default: true }), model('b')];
    expect(defaultModelId(models, 'generate')).toBe('b');
  });

  it('picks an edit-capable model for Edit nodes', () => {
    const models = [model('a', { default: true, supportsEdit: false }), model('b')];
    expect(defaultModelId(models, 'edit')).toBe('b');
  });

  it('returns null when nothing can do the job', () => {
    expect(defaultModelId([model('a', { enabled: false })], 'generate')).toBeNull();
  });
});

describe('supportedAspectRatio', () => {
  it('keeps a supported ratio and replaces an unsupported one', () => {
    const square = model('square', { aspectRatios: ['1:1'] });
    expect(supportedAspectRatio(model('any'), '16:9')).toBe('16:9');
    expect(supportedAspectRatio(square, '16:9')).toBe('1:1');
  });
});
