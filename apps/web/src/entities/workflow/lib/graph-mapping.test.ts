import { describe, expect, it } from 'vitest';
import type { Graph } from '@trafaret/core';
import { branchingGraph } from '@trafaret/core/testing';
import { fromGraph, toGraph } from './graph-mapping';

const positioned = (): Graph => {
  const graph = branchingGraph();
  return { ...graph, nodes: graph.nodes.map((node, i) => ({ ...node, position: { x: i * 100, y: 50 } })) };
};

describe('graph mapping', () => {
  it('round-trips a graph unchanged', () => {
    const graph = positioned();
    const { nodes, edges } = fromGraph(graph);
    expect(toGraph(nodes, edges)).toEqual(graph);
  });

  it("leaves React Flow's own state out of the graph", () => {
    const { nodes, edges } = fromGraph(positioned());
    const [first, ...rest] = nodes;
    const busyNode = { ...first!, selected: true, dragging: true, measured: { width: 260, height: 180 } };
    const graph = toGraph([busyNode, ...rest], [{ ...edges[0]!, selected: true, animated: true }]);
    expect(graph.nodes[0]).toEqual({
      id: 'prompt',
      type: 'prompt',
      data: first!.data,
      position: { x: 0, y: 50 },
    });
    expect(graph.edges[0]).toEqual(positioned().edges[0]);
  });

  it('lays out a graph that has no positions', () => {
    const { nodes } = fromGraph(branchingGraph());
    expect(nodes.find((node) => node.id === 'gen-b')?.position).toEqual({ x: 340, y: 260 });
  });
});
