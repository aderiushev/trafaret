import { describe, expect, it } from 'vitest';
import { indexGraph, topologicalOrder, type Graph } from '@trafaret/core';
import { branchingGraph, edge, editNode, imageInputNode, promptNode } from '@trafaret/core/testing';
import { computeCacheKeys } from './cache-key.ts';

const keysOf = (graph: Graph, presetHash: (id: string) => string | undefined = () => undefined) => {
  const index = indexGraph(graph);
  return computeCacheKeys(index, topologicalOrder(index)!, presetHash);
};

const patchNode = (
  graph: Graph,
  id: string,
  patch: (node: Graph['nodes'][number]) => Graph['nodes'][number],
): Graph => ({
  ...graph,
  nodes: graph.nodes.map((node) => (node.id === id ? patch(node) : node)),
});

describe('computeCacheKeys', () => {
  it('is stable for equal graphs', () => {
    expect(keysOf(branchingGraph())).toEqual(keysOf(branchingGraph()));
  });

  it('changes a node and its dependents when the node changes', () => {
    const before = keysOf(branchingGraph());
    const after = keysOf(
      patchNode(branchingGraph(), 'gen-b', (node) =>
        node.type === 'generateImage' ? { ...node, data: { ...node.data, seed: 99 } } : node,
      ),
    );
    expect(after.get('gen-b')).not.toBe(before.get('gen-b'));
    expect(after.get('result-b')).not.toBe(before.get('result-b'));
    expect(after.get('gen-a')).toBe(before.get('gen-a'));
    expect(after.get('result-a')).toBe(before.get('result-a'));
    expect(after.get('prompt')).toBe(before.get('prompt'));
  });

  it('includes the preset content', () => {
    const graph = patchNode(branchingGraph(), 'gen-a', (node) =>
      node.type === 'generateImage' ? { ...node, data: { ...node.data, presetId: 'premium-3d' } } : node,
    );
    expect(keysOf(graph, () => 'hash-1').get('gen-a')).not.toBe(keysOf(graph, () => 'hash-2').get('gen-a'));
  });

  it('ignores the edit instruction when a prompt is wired, and node positions', () => {
    const graph = (instruction: string): Graph => ({
      nodes: [promptNode('p'), imageInputNode('img'), editNode('e', { instruction })],
      edges: [edge('img', 'e', 'image'), edge('p', 'e', 'prompt')],
    });
    expect(keysOf(graph('one')).get('e')).toBe(keysOf(graph('two')).get('e'));
    const moved = patchNode(branchingGraph(), 'gen-a', (node) => ({ ...node, position: { x: 500, y: 500 } }));
    expect(keysOf(moved)).toEqual(keysOf(branchingGraph()));
  });
});
