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

  it('reports duplicate connection ids', () => {
    const graph = branchingGraph();
    graph.edges.push(edge('prompt', 'gen-b', 'prompt'));
    expect(validateGraph(graph)).toContainEqual({
      code: 'DUPLICATE_ID',
      message: 'Connection id "prompt->gen-b:prompt" is used more than once.',
      edgeId: 'prompt->gen-b:prompt',
    });
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

  it('does not count a rejected wire as a connection', () => {
    const graph: Graph = {
      nodes: [promptNode('p'), editNode('e'), resultNode('r')],
      edges: [edge('p', 'e', 'image'), edge('e', 'r', 'image')],
    };
    expect(validateGraph(graph)).toEqual([
      {
        code: 'PORT_TYPE_MISMATCH',
        message: "Text output can't feed an image input.",
        nodeId: 'e',
        edgeId: 'p->e:image',
      },
      { code: 'MISSING_INPUT', message: 'The Image input needs a connection.', nodeId: 'e' },
    ]);
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

  it('treats a whitespace-only edit instruction as empty', () => {
    const graph: Graph = {
      nodes: [imageInputNode('img'), editNode('e', { instruction: '   ' })],
      edges: [edge('img', 'e', 'image')],
    };
    expect(validateGraph(graph)).toEqual([
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

  describe('at the size limits', () => {
    // The same wire repeated under distinct ids: replayed, the first is accepted and every repeat is rejected.
    const wires = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ ...edge('p', 'g', 'prompt'), id: `wire${i}` }));

    // A workflow over the node or connection limit can't run, so only its limit issues are reported and none of
    // the other checks run (which also keeps the work bounded for any input).
    it('reports only the node limit when there are too many nodes', () => {
      const prompts = Array.from({ length: LIMITS.nodes }, (_, i) => promptNode(`p${i}`));
      // The unconnected Generate node and the repeated id would be reported too if the other checks ran.
      const graph: Graph = { nodes: [...prompts, generateNode('g'), promptNode('p0')], edges: [] };
      expect(validateGraph(graph)).toEqual([
        { code: 'LIMIT_EXCEEDED', message: 'A workflow can have at most 30 nodes.' },
      ]);
    });

    it('reports only the connection limit when there are too many connections', () => {
      const graph: Graph = { nodes: [promptNode('p'), generateNode('g')], edges: wires(LIMITS.edges + 1) };
      expect(validateGraph(graph)).toEqual([
        { code: 'LIMIT_EXCEEDED', message: 'A workflow can have at most 60 connections.' },
      ]);
    });

    it('still checks every node at exactly the node limit', () => {
      const prompts = Array.from({ length: LIMITS.nodes - 1 }, (_, i) => promptNode(`p${i}`));
      expect(validateGraph({ nodes: [...prompts, generateNode('g')], edges: [] })).toEqual([
        { code: 'MISSING_INPUT', message: 'The Prompt input needs a connection.', nodeId: 'g' },
      ]);
    });

    it('still checks every connection at exactly the connection limit', () => {
      const graph: Graph = { nodes: [promptNode('p'), generateNode('g')], edges: wires(LIMITS.edges) };
      expect(codes(graph)).toEqual(Array.from({ length: LIMITS.edges - 1 }, () => 'INPUT_ALREADY_CONNECTED'));
    });

    it('accepts exactly LIMITS.aiNodes Generate or Edit nodes', () => {
      const generators = Array.from({ length: LIMITS.aiNodes }, (_, i) => generateNode(`g${i}`));
      const graph: Graph = {
        nodes: [promptNode('p'), ...generators],
        edges: generators.map((node) => edge('p', node.id, 'prompt')),
      };
      expect(validateGraph(graph)).toEqual([]);
    });

    it('accepts prompt text of exactly LIMITS.textLength characters', () => {
      const graph: Graph = {
        nodes: [promptNode('p', 'x'.repeat(LIMITS.textLength)), generateNode('g')],
        edges: [edge('p', 'g', 'prompt')],
      };
      expect(validateGraph(graph)).toEqual([]);
    });

    it('limits the edit instruction to LIMITS.textLength characters', () => {
      const withInstruction = (instruction: string): Graph => ({
        nodes: [imageInputNode('img'), editNode('e', { instruction })],
        edges: [edge('img', 'e', 'image')],
      });
      expect(validateGraph(withInstruction('x'.repeat(LIMITS.textLength)))).toEqual([]);
      expect(validateGraph(withInstruction('x'.repeat(LIMITS.textLength + 1)))).toEqual([
        { code: 'LIMIT_EXCEEDED', message: 'Keep the instruction under 2000 characters.', nodeId: 'e' },
      ]);
    });
  });
});
