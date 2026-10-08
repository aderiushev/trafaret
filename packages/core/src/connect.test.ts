import { describe, expect, it } from 'vitest';
import { canConnect, type Connection } from './connect.ts';
import { indexGraph } from './graph-index.ts';
import type { Graph } from './graph.ts';
import { edge, editNode, generateNode, imageInputNode, promptNode, resultNode } from './testing.ts';

const graph: Graph = {
  nodes: [promptNode('p'), imageInputNode('img'), generateNode('g'), editNode('e'), resultNode('r')],
  edges: [edge('p', 'g', 'prompt'), edge('g', 'r', 'image')],
};
const index = indexGraph(graph);
const connect = (source: string, target: string, targetHandle: string): Connection => ({
  source,
  sourceHandle: 'out',
  target,
  targetHandle,
});

describe('canConnect', () => {
  it('allows matching port types', () => {
    expect(canConnect(index, connect('img', 'e', 'image'))).toEqual({ ok: true });
    expect(canConnect(index, connect('p', 'e', 'prompt'))).toEqual({ ok: true });
  });

  it('allows one output to feed many inputs (branching)', () => {
    expect(canConnect(index, connect('g', 'e', 'image'))).toEqual({ ok: true });
  });

  it('blocks incompatible port types with a readable reason', () => {
    expect(canConnect(index, connect('p', 'e', 'image'))).toEqual({
      ok: false,
      reason: "Text output can't feed an image input.",
    });
    expect(canConnect(index, connect('img', 'g', 'prompt'))).toEqual({
      ok: false,
      reason: "Image output can't feed a text input.",
    });
  });

  it('blocks a second wire into the same input', () => {
    expect(canConnect(index, connect('img', 'r', 'image'))).toEqual({
      ok: false,
      reason: 'The Image input is already connected.',
    });
  });

  it('blocks loops and self-connections', () => {
    const chain = indexGraph({
      nodes: [editNode('a'), editNode('b')],
      edges: [edge('a', 'b', 'image')],
    });
    expect(canConnect(chain, connect('b', 'a', 'image'))).toEqual({
      ok: false,
      reason: 'This connection would create a loop.',
    });
    expect(canConnect(chain, connect('a', 'a', 'prompt'))).toEqual({
      ok: false,
      reason: "A node can't connect to itself.",
    });
  });

  it('blocks unknown nodes and handles', () => {
    expect(canConnect(index, connect('ghost', 'e', 'image')).ok).toBe(false);
    expect(canConnect(index, connect('img', 'e', 'mask')).ok).toBe(false);
    expect(canConnect(index, { ...connect('r', 'e', 'image') }).ok).toBe(false); // Result has no output
  });
});
