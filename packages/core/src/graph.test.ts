import { describe, expect, it } from 'vitest';
import { graphSchema, type GraphEdge } from './graph.ts';
import { branchingGraph, edge, generateNode, promptNode } from './testing.ts';

describe('graphSchema', () => {
  it('accepts the branching scenario', () => {
    expect(graphSchema.safeParse(branchingGraph()).success).toBe(true);
  });

  it('keeps node positions optional', () => {
    const graph = branchingGraph();
    const parsed = graphSchema.parse({
      ...graph,
      nodes: graph.nodes.map((node, i) => (i === 0 ? { ...node, position: { x: 10, y: 20 } } : node)),
    });
    expect(parsed.nodes[0]?.position).toEqual({ x: 10, y: 20 });
    expect(parsed.nodes[1]?.position).toBeUndefined();
  });

  it('rejects unknown node types', () => {
    expect(graphSchema.safeParse({ nodes: [{ id: 'x', type: 'video', data: {} }], edges: [] }).success).toBe(
      false,
    );
  });

  it('rejects data that does not belong to the node type', () => {
    const node = {
      ...generateNode('gen'),
      data: { modelId: 'mock', presetId: null, aspectRatio: '2:1', seed: 1 },
    };
    expect(graphSchema.safeParse({ nodes: [node], edges: [] }).success).toBe(false);
  });

  it('rejects seeds outside the 31-bit range', () => {
    const graph = { nodes: [generateNode('gen', { seed: 2 ** 31 })], edges: [] };
    expect(graphSchema.safeParse(graph).success).toBe(false);
  });

  it('rejects edges into handles that do not exist', () => {
    const bad = { ...edge('prompt', 'gen', 'prompt'), targetHandle: 'mask' };
    expect(
      graphSchema.safeParse({ nodes: [promptNode('prompt'), generateNode('gen')], edges: [bad] }).success,
    ).toBe(false);
  });

  it('accepts node ids made of the nanoid alphabet', () => {
    const graph = { nodes: [promptNode('V1StGXR8_Z5jdHi6B-myT')], edges: [] };
    expect(graphSchema.safeParse(graph).success).toBe(true);
  });

  it('rejects node ids outside the nanoid alphabet, longer than 64 characters, or __proto__', () => {
    for (const id of ['__proto__', 'a/b', 'has space', 'x'.repeat(65)]) {
      expect(graphSchema.safeParse({ nodes: [promptNode(id)], edges: [] }).success, id).toBe(false);
    }
  });

  it('applies the node id rule to edge endpoints, but not to edge ids', () => {
    const graph = (wire: GraphEdge) => ({
      nodes: [promptNode('prompt'), generateNode('gen')],
      edges: [wire],
    });
    const wire = edge('prompt', 'gen', 'prompt');
    expect(graphSchema.safeParse(graph({ ...wire, source: '__proto__' })).success).toBe(false);
    expect(graphSchema.safeParse(graph({ ...wire, target: 'a/b' })).success).toBe(false);
    expect(graphSchema.safeParse(graph({ ...wire, id: 'xy-edge__prompt-gen:prompt' })).success).toBe(true);
  });
});
