import { describe, expect, it } from 'vitest';
import { ancestorsOf, descendantsOf, indexGraph, topologicalOrder, wouldCreateCycle } from './graph-index.ts';
import type { Graph } from './graph.ts';
import { branchingGraph, edge, editNode, generateNode, promptNode } from './testing.ts';

describe('indexGraph', () => {
  it('lists incoming and outgoing edges per node', () => {
    const index = indexGraph(branchingGraph());
    expect(index.outgoing.get('prompt')?.map((e) => e.target)).toEqual(['gen-a', 'gen-b']);
    expect(index.incoming.get('result-b')?.map((e) => e.source)).toEqual(['gen-b']);
    expect(index.incoming.get('prompt')).toEqual([]);
  });

  it('leaves out edges that point to missing nodes', () => {
    const graph = branchingGraph();
    graph.edges.push(edge('ghost', 'gen-a', 'prompt'));
    expect(indexGraph(graph).incoming.get('gen-a')).toHaveLength(1);
  });
});

describe('topologicalOrder', () => {
  it('orders every node after its dependencies', () => {
    const order = topologicalOrder(indexGraph(branchingGraph()));
    expect(order).not.toBeNull();
    const position = (id: string) => order?.indexOf(id) ?? -1;
    expect(position('prompt')).toBeLessThan(position('gen-a'));
    expect(position('gen-a')).toBeLessThan(position('result-a'));
    expect(position('gen-b')).toBeLessThan(position('result-b'));
    expect(order).toHaveLength(5);
  });

  it('returns null for a cycle', () => {
    const graph: Graph = {
      nodes: [editNode('a'), editNode('b')],
      edges: [edge('a', 'b', 'image'), edge('b', 'a', 'image')],
    };
    expect(topologicalOrder(indexGraph(graph))).toBeNull();
  });
});

describe('ancestors and descendants', () => {
  const graph: Graph = {
    nodes: [promptNode('p'), generateNode('g'), editNode('e1'), editNode('e2')],
    edges: [edge('p', 'g', 'prompt'), edge('g', 'e1', 'image'), edge('e1', 'e2', 'image')],
  };
  const index = indexGraph(graph);

  it('walks upstream', () => {
    expect([...ancestorsOf(index, 'e2')].sort()).toEqual(['e1', 'g', 'p']);
    expect(ancestorsOf(index, 'p').size).toBe(0);
  });

  it('walks downstream', () => {
    expect([...descendantsOf(index, 'g')].sort()).toEqual(['e1', 'e2']);
  });

  it('detects connections that would close a loop', () => {
    expect(wouldCreateCycle(index, 'e2', 'g')).toBe(true);
    expect(wouldCreateCycle(index, 'g', 'g')).toBe(true);
    expect(wouldCreateCycle(index, 'g', 'e2')).toBe(false);
  });
});
