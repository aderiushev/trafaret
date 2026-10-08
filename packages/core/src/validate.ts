import { z } from 'zod';
import { canConnect } from './connect.ts';
import { indexGraph, type GraphIndex } from './graph-index.ts';
import type { Graph, GraphEdge, GraphNode } from './graph.ts';
import { isAiNodeType, NODE_DEFINITIONS, type InputHandle } from './nodes.ts';

export const LIMITS = { nodes: 30, edges: 60, aiNodes: 8, textLength: 2000 } as const;

export const ISSUE_CODES = [
  'SCHEMA_MISMATCH',
  'DUPLICATE_ID',
  'DANGLING_EDGE',
  'PORT_TYPE_MISMATCH',
  'INPUT_ALREADY_CONNECTED',
  'CYCLE',
  'MISSING_INPUT',
  'MISSING_VALUE',
  'NOTHING_TO_RUN',
  'LIMIT_EXCEEDED',
  'UNKNOWN_MODEL',
  'MODEL_UNAVAILABLE',
  'MODEL_CANNOT_EDIT',
  'UNKNOWN_PRESET',
  'UNKNOWN_ASSET',
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];

export const issueSchema = z.object({
  code: z.enum(ISSUE_CODES),
  message: z.string(),
  nodeId: z.string().optional(),
  edgeId: z.string().optional(),
});
export type Issue = z.infer<typeof issueSchema>;

/** Everything that can be checked from the graph alone. An empty array means the graph is runnable. */
export function validateGraph(graph: Graph): Issue[] {
  const issues: Issue[] = [...limitIssues(graph), ...duplicateIssues(graph)];
  const accepted = replayEdges(graph, issues);
  for (const node of graph.nodes) {
    const wired = new Set((accepted.incoming.get(node.id) ?? []).map((edge) => edge.targetHandle));
    for (const input of NODE_DEFINITIONS[node.type].inputs) {
      if (input.required && !wired.has(input.handle)) {
        issues.push({
          code: 'MISSING_INPUT',
          message: `The ${input.label} input needs a connection.`,
          nodeId: node.id,
        });
      }
    }
    issues.push(...valueIssues(node, wired));
  }
  return issues;
}

/**
 * Replays every edge through canConnect — the rule the canvas applies while a wire is dragged — against the edges
 * accepted so far. Rejected edges become issues; the returned index holds only the accepted edges.
 */
function replayEdges(graph: Graph, issues: Issue[]): GraphIndex {
  const { nodes } = indexGraph({ nodes: graph.nodes, edges: [] });
  const incoming = new Map<string, GraphEdge[]>([...nodes.keys()].map((id) => [id, []]));
  const outgoing = new Map<string, GraphEdge[]>([...nodes.keys()].map((id) => [id, []]));
  const accepted: GraphIndex = { nodes, incoming, outgoing };
  for (const edge of graph.edges) {
    const result = canConnect(accepted, edge);
    if (!result.ok) {
      issues.push({
        code: result.code,
        message: result.reason,
        edgeId: edge.id,
        ...(nodes.has(edge.target) ? { nodeId: edge.target } : {}),
      });
      continue;
    }
    incoming.get(edge.target)?.push(edge);
    outgoing.get(edge.source)?.push(edge);
  }
  return accepted;
}

function limitIssues(graph: Graph): Issue[] {
  const issues: Issue[] = [];
  const aiNodes = graph.nodes.filter((node) => isAiNodeType(node.type)).length;
  if (graph.nodes.length > LIMITS.nodes) {
    issues.push({ code: 'LIMIT_EXCEEDED', message: `A workflow can have at most ${LIMITS.nodes} nodes.` });
  }
  if (graph.edges.length > LIMITS.edges) {
    issues.push({
      code: 'LIMIT_EXCEEDED',
      message: `A workflow can have at most ${LIMITS.edges} connections.`,
    });
  }
  if (aiNodes > LIMITS.aiNodes) {
    issues.push({
      code: 'LIMIT_EXCEEDED',
      message: `A workflow can have at most ${LIMITS.aiNodes} Generate or Edit nodes.`,
    });
  }
  if (aiNodes === 0) {
    issues.push({
      code: 'NOTHING_TO_RUN',
      message: 'Add a Generate Image or Edit Image node to run the workflow.',
    });
  }
  return issues;
}

function duplicateIssues(graph: Graph): Issue[] {
  const issues: Issue[] = [];
  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: 'DUPLICATE_ID',
        message: `Node id "${node.id}" is used more than once.`,
        nodeId: node.id,
      });
    }
    nodeIds.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({
        code: 'DUPLICATE_ID',
        message: `Connection id "${edge.id}" is used more than once.`,
        edgeId: edge.id,
      });
    }
    edgeIds.add(edge.id);
  }
  return issues;
}

function valueIssues(node: GraphNode, wired: ReadonlySet<InputHandle>): Issue[] {
  const tooLong = (text: string): boolean => text.length > LIMITS.textLength;
  switch (node.type) {
    case 'prompt':
      if (node.data.text.trim() === '')
        return [{ code: 'MISSING_VALUE', message: 'Write a prompt.', nodeId: node.id }];
      return tooLong(node.data.text)
        ? [
            {
              code: 'LIMIT_EXCEEDED',
              message: `Keep the prompt under ${LIMITS.textLength} characters.`,
              nodeId: node.id,
            },
          ]
        : [];
    case 'imageInput':
      return node.data.assetId === null
        ? [{ code: 'MISSING_VALUE', message: 'Upload an image.', nodeId: node.id }]
        : [];
    case 'editImage': {
      const promptWired = wired.has('prompt');
      if (!promptWired && node.data.instruction.trim() === '') {
        return [
          { code: 'MISSING_VALUE', message: 'Describe the edit or connect a prompt.', nodeId: node.id },
        ];
      }
      return tooLong(node.data.instruction)
        ? [
            {
              code: 'LIMIT_EXCEEDED',
              message: `Keep the instruction under ${LIMITS.textLength} characters.`,
              nodeId: node.id,
            },
          ]
        : [];
    }
    case 'generateImage':
    case 'result':
      return [];
  }
}
