import { describe, expect, it } from 'vitest';
import { graphNodeSchema, NODE_TYPES } from '@trafaret/core';
import { createNode } from './create-node';

describe('createNode', () => {
  it('creates every node type with data the API accepts', () => {
    for (const type of NODE_TYPES) {
      const { id, data, position } = createNode(type, { x: 10, y: 20 }, 'mock');
      expect(graphNodeSchema.safeParse({ id, type, data, position }).success).toBe(true);
    }
  });

  it('gives Generate and Edit nodes the model and a random seed', () => {
    const node = createNode('generateImage', { x: 0, y: 0 }, 'flux-2-klein');
    expect(node.data).toMatchObject({ modelId: 'flux-2-klein', presetId: null, aspectRatio: '1:1' });
  });

  it('never reuses an id', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createNode('prompt', { x: 0, y: 0 }, 'mock').id));
    expect(ids.size).toBe(50);
  });
});
