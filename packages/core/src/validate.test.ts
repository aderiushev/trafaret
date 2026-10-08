import { describe, expect, it } from 'vitest';
import type { Graph } from './graph.ts';
import {
  branchingGraph,
  edge,
  editNode,
  generateNode,
  imageInputNode,
  promptNode,
  resultNode,
} from './testing.ts';
import { LIMITS, validateGraph } from './validate.ts';

const codes = (graph: Graph) => validateGraph(graph).map((issue) => issue.code);

describe('validateGraph', () => {
  it('accepts the branching scenario', () => {
    expect(validateGraph(branchingGraph())).toEqual([]);
  });

  it('accepts Image Input → Edit Image → Result without a Prompt node', () => {
    const graph: Graph = {
      nodes: [imageInputNode('img'), editNode('edit'), resultNode('res')],
      edges: [edge('img', 'edit', 'image'), edge('edit', 'res', 'image')],
    };
    expect(validateGraph(graph)).toEqual([]);
  });

  it('reports duplicate ids', () => {
    const graph = branchingGraph();
    graph.nodes.push(promptNode('prompt'));
    expect(codes(graph)).toContain('DUPLICATE_ID');
  });

  it('reports edges that point to missing nodes', () => {
    const graph = branchingGraph();
    graph.edges.push(edge('ghost', 'gen-a', 'prompt'));
    expect(validateGraph(graph)).toContainEqual(
      expect.objectContaining({ code: 'DANGLING_EDGE', edgeId: 'ghost->gen-a:prompt' }),
    );
  });

  it('reports wires between incompatible ports', () => {
    const graph: Graph = {
      nodes: [promptNode('p'), editNode('e'), resultNode('r')],
      edges: [edge('p', 'e', 'image'), edge('e', 'r', 'image')],
    };
    expect(validateGraph(graph)).toContainEqual({
      code: 'PORT_TYPE_MISMATCH',
      message: "Text output can't feed an image input.",
      nodeId: 'e',
      edgeId: 'p->e:image',
    });
  });

  it('reports a second wire into one input', () => {
    const graph = branchingGraph();
    graph.nodes.push(promptNode('other'));
    graph.edges.push(edge('other', 'gen-a', 'prompt'));
    expect(codes(graph)).toContain('INPUT_ALREADY_CONNECTED');
  });

  it('reports loops', () => {
    const graph: Graph = {
      nodes: [editNode('a'), editNode('b')],
      edges: [edge('a', 'b', 'image'), edge('b', 'a', 'image')],
    };
    expect(validateGraph(graph)).toContainEqual({
      code: 'CYCLE',
      message: 'This connection would create a loop.',
      nodeId: 'a',
      edgeId: 'b->a:image',
    });
  });

  it('reports required inputs that are not connected', () => {
    expect(validateGraph({ nodes: [generateNode('gen')], edges: [] })).toEqual([
      { code: 'MISSING_INPUT', message: 'The Prompt input needs a connection.', nodeId: 'gen' },
    ]);
  });

  it('reports empty prompts, missing uploads and empty edit instructions', () => {
    const graph: Graph = {
      nodes: [
        promptNode('p', '   '),
        generateNode('g'),
        imageInputNode('img', null),
        editNode('e', { instruction: '' }),
      ],
      edges: [edge('p', 'g', 'prompt'), edge('img', 'e', 'image')],
    };
    expect(validateGraph(graph)).toEqual([
      { code: 'MISSING_VALUE', message: 'Write a prompt.', nodeId: 'p' },
      { code: 'MISSING_VALUE', message: 'Upload an image.', nodeId: 'img' },
      { code: 'MISSING_VALUE', message: 'Describe the edit or connect a prompt.', nodeId: 'e' },
    ]);
  });

  it('accepts an empty edit instruction when a prompt is wired', () => {
    const graph: Graph = {
      nodes: [promptNode('p'), imageInputNode('img'), editNode('e', { instruction: '' })],
      edges: [edge('img', 'e', 'image'), edge('p', 'e', 'prompt')],
    };
    expect(validateGraph(graph)).toEqual([]);
  });

  it('needs at least one AI node', () => {
    expect(codes({ nodes: [promptNode('p')], edges: [] })).toEqual(['NOTHING_TO_RUN']);
  });

  it('enforces the size limits', () => {
    const many = Array.from({ length: LIMITS.nodes + 1 }, (_, i) => promptNode(`p${i}`));
    expect(codes({ nodes: [...many, generateNode('g')], edges: [] })).toContain('LIMIT_EXCEEDED');

    const aiNodes = Array.from({ length: LIMITS.aiNodes + 1 }, (_, i) => generateNode(`g${i}`));
    expect(codes({ nodes: aiNodes, edges: [] })).toContain('LIMIT_EXCEEDED');

    const long = {
      nodes: [promptNode('p', 'x'.repeat(LIMITS.textLength + 1)), generateNode('g')],
      edges: [edge('p', 'g', 'prompt')],
    };
    expect(validateGraph(long)).toEqual([
      { code: 'LIMIT_EXCEEDED', message: 'Keep the prompt under 2000 characters.', nodeId: 'p' },
    ]);
  });
});
