import { describe, expect, it } from 'vitest';
import type { Graph } from '@trafaret/core';
import {
  branchingGraph,
  edge,
  editNode,
  generateNode,
  imageInputNode,
  resultNode,
  withNode,
} from '@trafaret/core/testing';
import { AssetStore } from '../assets/asset-store.ts';
import { ModelCatalog } from '../catalog/catalog.ts';
import { MODEL_DEFINITIONS } from '../catalog/models.ts';
import { PresetRepository } from '../library/preset-repository.ts';
import { validateRunGraph } from './validate-run-graph.ts';

const mock = MODEL_DEFINITIONS.find((model) => model.id === 'mock')!;
const context = {
  catalog: new ModelCatalog({ cloudflare: null, byteplus: null }, [
    ...MODEL_DEFINITIONS,
    { ...mock, id: 'no-edit', supportsEdit: false },
  ]),
  presets: new PresetRepository([]),
  assets: new AssetStore({ maxBytes: 1e6 }),
};

describe('validateRunGraph', () => {
  it('accepts a runnable graph', () => {
    expect(validateRunGraph(branchingGraph(), context)).toEqual([]);
  });

  it('adds catalog, preset and asset checks to the graph rules', () => {
    const graph: Graph = {
      nodes: [
        ...withNode(branchingGraph(), generateNode('gen-a', { seed: 1, modelId: 'seedream-4.5' })).nodes.map(
          (node) => (node.id === 'gen-b' ? generateNode('gen-b', { seed: 2, presetId: 'nope' }) : node),
        ),
        imageInputNode('img', 'b'.repeat(64)),
        editNode('edit', { modelId: 'no-edit' }),
        resultNode('edited'),
      ],
      edges: [...branchingGraph().edges, edge('img', 'edit', 'image'), edge('edit', 'edited', 'image')],
    };
    expect(validateRunGraph(graph, context).map((issue) => [issue.code, issue.nodeId])).toEqual([
      ['MODEL_UNAVAILABLE', 'gen-a'],
      ['UNKNOWN_PRESET', 'gen-b'],
      ['UNKNOWN_ASSET', 'img'],
      ['MODEL_CANNOT_EDIT', 'edit'],
    ]);
  });

  it('reports unknown models', () => {
    const graph = withNode(branchingGraph(), generateNode('gen-a', { modelId: 'imaginary' }));
    expect(validateRunGraph(graph, context)).toContainEqual(
      expect.objectContaining({ code: 'UNKNOWN_MODEL', nodeId: 'gen-a' }),
    );
  });
});
