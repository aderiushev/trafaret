import { describe, expect, it } from 'vitest';
import { indexGraph, topologicalOrder, type Graph } from '@trafaret/core';
import {
  branchingGraph,
  edge,
  editNode,
  generateNode,
  imageInputNode,
  promptNode,
  resultNode,
} from '@trafaret/core/testing';
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

  it('prompt text changes the prompt key and every dependent key', () => {
    const base = branchingGraph();
    const changed: Graph = {
      ...base,
      nodes: base.nodes.map((node) => (node.id === 'prompt' ? promptNode('prompt', 'a new prompt') : node)),
    };
    const before = keysOf(base);
    const after = keysOf(changed);
    expect(after.get('prompt')).not.toBe(before.get('prompt'));
    expect(after.get('gen-a')).not.toBe(before.get('gen-a'));
    expect(after.get('gen-b')).not.toBe(before.get('gen-b'));
    expect(after.get('result-a')).not.toBe(before.get('result-a'));
    expect(after.get('result-b')).not.toBe(before.get('result-b'));
  });

  it('image input asset changes the input key and its dependents', () => {
    const graph = (assetId: string): Graph => ({
      nodes: [imageInputNode('img', assetId), editNode('e', { instruction: 'x' }), resultNode('r')],
      edges: [edge('img', 'e', 'image'), edge('e', 'r', 'image')],
    });
    const before = keysOf(graph('a'.repeat(64)));
    const after = keysOf(graph('b'.repeat(64)));
    expect(after.get('img')).not.toBe(before.get('img'));
    expect(after.get('e')).not.toBe(before.get('e'));
    expect(after.get('r')).not.toBe(before.get('r'));
  });

  it('aspect ratio changes a generation key and its dependents', () => {
    const graph = (aspectRatio: '1:1' | '16:9'): Graph => ({
      nodes: [promptNode('p'), generateNode('gen', { aspectRatio }), resultNode('r')],
      edges: [edge('p', 'gen', 'prompt'), edge('gen', 'r', 'image')],
    });
    const before = keysOf(graph('1:1'));
    const after = keysOf(graph('16:9'));
    expect(after.get('gen')).not.toBe(before.get('gen'));
    expect(after.get('r')).not.toBe(before.get('r'));
  });

  it('edit instruction changes the edit key and its dependents when no prompt is wired', () => {
    const graph = (instruction: string): Graph => ({
      nodes: [imageInputNode('img'), editNode('e', { instruction }), resultNode('r')],
      edges: [edge('img', 'e', 'image'), edge('e', 'r', 'image')],
    });
    const before = keysOf(graph('one'));
    const after = keysOf(graph('two'));
    expect(after.get('e')).not.toBe(before.get('e'));
    expect(after.get('r')).not.toBe(before.get('r'));
  });
});
