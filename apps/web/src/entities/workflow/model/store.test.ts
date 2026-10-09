import { beforeEach, describe, expect, it } from 'vitest';
import { graphSchema, type Issue } from '@trafaret/core';
import { branchingGraph, edge, generateNode, promptNode } from '@trafaret/core/testing';
import { createNode } from '../lib/create-node';
import { getWorkflowGraph } from './hooks';
import { STORAGE_KEY, useWorkflowStore } from './store';

const store = () => useWorkflowStore.getState();
const issue = (fields: Partial<Issue>): Issue => ({ code: 'MISSING_VALUE', message: 'Fix me.', ...fields });

beforeEach(() => {
  useWorkflowStore.setState({ nodes: [], edges: [], issues: [], needsStarter: false });
});

describe('workflow store', () => {
  it('places a graph on the canvas and reads it back', () => {
    store().replaceGraph(branchingGraph());
    const graph = getWorkflowGraph();
    expect(graph.nodes.map((node) => node.id)).toEqual(['prompt', 'gen-a', 'gen-b', 'result-a', 'result-b']);
    expect(graph.edges).toEqual(branchingGraph().edges);
  });

  it('selects a newly added node and only that one', () => {
    store().replaceGraph(branchingGraph());
    store().onNodesChange([{ type: 'select', id: 'prompt', selected: true }]);
    const added = createNode('prompt', { x: 0, y: 0 }, 'mock');
    store().addNode(added);
    expect(
      store()
        .nodes.filter((node) => node.selected)
        .map((node) => node.id),
    ).toEqual([added.id]);
  });

  it('updates data only when the node has the expected type', () => {
    store().replaceGraph(branchingGraph());
    store().updateNodeData('prompt', 'prompt', { text: 'A red kite' });
    store().updateNodeData('gen-a', 'prompt', { text: 'ignored' });
    const graph = getWorkflowGraph();
    expect(graph.nodes.find((node) => node.id === 'prompt')?.data).toEqual({ text: 'A red kite' });
    expect(graph.nodes.find((node) => node.id === 'gen-a')?.data).not.toHaveProperty('text');
  });

  it("clears a node's issues once the node is edited or wired", () => {
    store().replaceGraph(branchingGraph());
    store().setIssues([issue({ nodeId: 'prompt' }), issue({ nodeId: 'result-a' }), issue({})]);
    store().updateNodeData('prompt', 'prompt', { text: 'Fixed' });
    expect(store().issues.map((item) => item.nodeId)).toEqual(['result-a', undefined]);
    store().connect({ source: 'gen-a', sourceHandle: 'out', target: 'result-a', targetHandle: 'image' });
    expect(store().issues.map((item) => item.nodeId)).toEqual([undefined]);
  });

  it('drops the issues of removed nodes and connections', () => {
    store().replaceGraph(branchingGraph());
    const wire = edge('prompt', 'gen-a', 'prompt');
    store().setIssues([issue({ nodeId: 'gen-b' }), issue({ code: 'CYCLE', edgeId: wire.id })]);
    store().onNodesChange([{ type: 'remove', id: 'gen-b' }]);
    store().onEdgesChange([{ type: 'remove', id: wire.id }]);
    expect(store().issues).toEqual([]);
  });

  it('clears the selection', () => {
    store().replaceGraph(branchingGraph());
    store().onNodesChange([{ type: 'select', id: 'gen-a', selected: true }]);
    store().clearSelection();
    expect(store().nodes.some((node) => node.selected)).toBe(false);
  });

  it('gives a new connection an id the API accepts, however long the node ids are', () => {
    const long = (name: string): string => `${name}-${'x'.repeat(40)}`;
    store().replaceGraph({ nodes: [promptNode(long('p')), generateNode(long('g'))], edges: [] });
    store().connect({ source: long('p'), sourceHandle: 'out', target: long('g'), targetHandle: 'prompt' });
    expect(graphSchema.safeParse(getWorkflowGraph()).success).toBe(true);
  });
});

describe('saving', () => {
  it('saves only the graph, in the shape the API takes', () => {
    store().replaceGraph(branchingGraph());
    store().onNodesChange([{ type: 'select', id: 'gen-a', selected: true }]);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { state: unknown };
    expect(saved.state).toEqual({ graph: getWorkflowGraph() });
  });

  it('restores a saved graph', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { graph: branchingGraph() }, version: 0 }));
    await useWorkflowStore.persist.rehydrate();
    expect(store().nodes).toHaveLength(5);
    expect(store().needsStarter).toBe(false);
  });

  it('asks for a starter workflow when nothing usable is saved', async () => {
    localStorage.removeItem(STORAGE_KEY); // every change saves, so the reset above saved an empty graph
    await useWorkflowStore.persist.rehydrate();
    expect(store().needsStarter).toBe(true);
    useWorkflowStore.setState({ needsStarter: false });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { graph: { nodes: 'broken' } }, version: 0 }));
    await useWorkflowStore.persist.rehydrate();
    expect(store().needsStarter).toBe(true);
  });
});
