import { describe, expect, it } from 'vitest';
import type { Preset } from '@trafaret/core';
import { branchingGraph, withNode, generateNode } from '@trafaret/core/testing';
import { timelineRows } from './timeline-rows';

const lifestyle: Preset = {
  id: 'lifestyle',
  name: 'Lifestyle',
  mainPrompt: '',
  negativePrompt: '',
  references: [],
};

describe('timelineRows', () => {
  it('lists only the AI nodes, in execution order, named after their preset or model', () => {
    const graph = withNode(branchingGraph(), generateNode('gen-b', { presetId: 'lifestyle', seed: 2 }));
    expect(timelineRows(graph, [lifestyle], [])).toEqual([
      { nodeId: 'gen-a', label: 'Generate Image · mock' },
      { nodeId: 'gen-b', label: 'Generate Image · Lifestyle' },
    ]);
  });
});
