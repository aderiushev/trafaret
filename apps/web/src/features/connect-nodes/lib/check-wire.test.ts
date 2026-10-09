import { describe, expect, it } from 'vitest';
import type { Graph } from '@trafaret/core';
import { branchingGraph, edge, editNode, imageInputNode, promptNode } from '@trafaret/core/testing';
import { checkWire, type WireEnd } from './check-wire';

const output = (nodeId: string): WireEnd => ({ nodeId, handleId: 'out', type: 'source' });
const input = (nodeId: string, handleId: string): WireEnd => ({ nodeId, handleId, type: 'target' });

describe('checkWire', () => {
  const graph = branchingGraph();

  it('accepts a text output into a free prompt input, whichever end the drag started from', () => {
    const free: Graph = {
      nodes: [...graph.nodes, promptNode('p2')],
      edges: graph.edges.filter((wire) => wire.target !== 'gen-b'),
    };
    expect(checkWire(free, output('p2'), input('gen-b', 'prompt'))).toEqual({ ok: true });
    expect(checkWire(free, input('gen-b', 'prompt'), output('p2'))).toEqual({ ok: true });
  });

  it('explains why an image cannot feed a prompt input', () => {
    expect(checkWire(graph, output('gen-a'), input('gen-b', 'prompt'))).toMatchObject({
      ok: false,
      reason: "Image output can't feed a text input.",
    });
  });

  it('refuses a second wire into a connected input', () => {
    const withSecondPrompt: Graph = { ...graph, nodes: [...graph.nodes, promptNode('p2')] };
    expect(checkWire(withSecondPrompt, output('p2'), input('gen-a', 'prompt'))).toMatchObject({
      ok: false,
      reason: 'The Prompt input is already connected.',
    });
  });

  it('refuses a loop', () => {
    const chain: Graph = {
      nodes: [imageInputNode('photo'), editNode('edit-a'), editNode('edit-b')],
      edges: [edge('edit-a', 'edit-b', 'image')],
    };
    expect(checkWire(chain, output('edit-b'), input('edit-a', 'image'))).toMatchObject({
      ok: false,
      reason: 'This connection would create a loop.',
    });
  });

  it('asks for an output on one end and an input on the other', () => {
    expect(checkWire(graph, output('gen-a'), output('gen-b'))).toMatchObject({
      ok: false,
      reason: 'Connect an output to an input.',
    });
  });
});
