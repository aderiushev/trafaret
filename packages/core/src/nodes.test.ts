import { describe, expect, it } from 'vitest';
import {
  AI_NODE_TYPES,
  MAX_SEED,
  NODE_DEFINITIONS,
  NODE_TYPES,
  isAiNodeType,
  isAspectRatio,
  isInputHandle,
  randomSeed,
} from './nodes.ts';

describe('NODE_DEFINITIONS', () => {
  it('defines exactly the five node types', () => {
    expect(NODE_TYPES).toEqual(['prompt', 'imageInput', 'generateImage', 'editImage', 'result']);
    expect(Object.keys(NODE_DEFINITIONS).sort()).toEqual([...NODE_TYPES].sort());
  });

  it('gives every AI node an image output', () => {
    for (const type of AI_NODE_TYPES) expect(NODE_DEFINITIONS[type].output?.type).toBe('image');
  });

  it('requires an image and accepts an optional prompt on Edit Image', () => {
    expect(NODE_DEFINITIONS.editImage.inputs).toEqual([
      { handle: 'image', type: 'image', required: true, label: 'Image' },
      { handle: 'prompt', type: 'text', required: false, label: 'Prompt' },
    ]);
  });

  it('makes Result a sink', () => {
    expect(NODE_DEFINITIONS.result.output).toBeNull();
  });

  it('recognises AI node types', () => {
    expect(isAiNodeType('generateImage')).toBe(true);
    expect(isAiNodeType('editImage')).toBe(true);
    expect(isAiNodeType('prompt')).toBe(false);
  });
});

describe('randomSeed', () => {
  it('returns integers inside the 31-bit range', () => {
    for (let i = 0; i < 200; i += 1) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(MAX_SEED);
    }
  });
});

describe('type guards', () => {
  it('recognises input handles', () => {
    expect(isInputHandle('prompt')).toBe(true);
    expect(isInputHandle('image')).toBe(true);
    expect(isInputHandle('out')).toBe(false);
    expect(isInputHandle(null)).toBe(false);
  });

  it('recognises aspect ratios', () => {
    expect(isAspectRatio('16:9')).toBe(true);
    expect(isAspectRatio('2:1')).toBe(false);
    expect(isAspectRatio(undefined)).toBe(false);
  });
});
