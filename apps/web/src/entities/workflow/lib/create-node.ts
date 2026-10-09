import type { XYPosition } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { randomSeed, type NodeType } from '@trafaret/core';
import type { FlowNode } from '../model/types';

/** A new node with default data and a fresh id and seed. `modelId` is used by Generate and Edit nodes. */
export function createNode(type: NodeType, position: XYPosition, modelId: string): FlowNode {
  const id = nanoid();
  switch (type) {
    case 'prompt':
      return { id, type, position, data: { text: '' } };
    case 'imageInput':
      return { id, type, position, data: { assetId: null } };
    case 'generateImage':
      return {
        id,
        type,
        position,
        data: { modelId, presetId: null, aspectRatio: '1:1', seed: randomSeed() },
      };
    case 'editImage':
      return { id, type, position, data: { instruction: '', modelId, presetId: null, seed: randomSeed() } };
    case 'result':
      return { id, type, position, data: {} };
  }
}
