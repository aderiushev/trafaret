import { describe, expect, it } from 'vitest';
import { branchingGraph, promptNode } from '@trafaret/core/testing';
import { parseWorkflowFile, toWorkflowFile } from './workflow-file';

describe('workflow files', () => {
  it('reads back what it exports', () => {
    const graph = branchingGraph();
    expect(parseWorkflowFile(JSON.stringify(toWorkflowFile(graph)))).toEqual(graph);
  });

  it('also reads a bare graph', () => {
    expect(parseWorkflowFile(JSON.stringify(branchingGraph()))).toEqual(branchingGraph());
  });

  it('refuses text that is not a workflow', () => {
    expect(parseWorkflowFile('not json')).toBeNull();
    expect(parseWorkflowFile(JSON.stringify({ graph: { nodes: 'none' } }))).toBeNull();
  });

  it('refuses repeated node ids', () => {
    const graph = branchingGraph();
    const repeated = { ...graph, nodes: [...graph.nodes, promptNode('prompt')] };
    expect(parseWorkflowFile(JSON.stringify(repeated))).toBeNull();
  });
});
