import type { Graph, GraphEdge, GraphNode } from './graph.ts';
import type { EditImageData, GenerateImageData, InputHandle } from './nodes.ts';
import { emptyRunSummary, type Job, type Run } from './run.ts';

export const promptNode = (id: string, text = 'A white sneaker on a stone pedestal'): GraphNode => ({
  id,
  type: 'prompt',
  data: { text },
});

export const imageInputNode = (id: string, assetId: string | null = 'a'.repeat(64)): GraphNode => ({
  id,
  type: 'imageInput',
  data: { assetId },
});

export const generateNode = (id: string, data: Partial<GenerateImageData> = {}): GraphNode => ({
  id,
  type: 'generateImage',
  data: { modelId: 'mock', presetId: null, aspectRatio: '1:1', seed: 1, ...data },
});

export const editNode = (id: string, data: Partial<EditImageData> = {}): GraphNode => ({
  id,
  type: 'editImage',
  data: {
    instruction: 'Replace the background with plain studio grey',
    modelId: 'mock',
    presetId: null,
    seed: 1,
    ...data,
  },
});

export const resultNode = (id: string): GraphNode => ({ id, type: 'result', data: {} });

export const edge = (source: string, target: string, targetHandle: InputHandle): GraphEdge => ({
  id: `${source}->${target}:${targetHandle}`,
  source,
  sourceHandle: 'out',
  target,
  targetHandle,
});

/** A copy of `graph` with the node that has the same id replaced by `node`. */
export const withNode = (graph: Graph, node: GraphNode): Graph => ({
  ...graph,
  nodes: graph.nodes.map((existing) => (existing.id === node.id ? node : existing)),
});

/** Prompt → Generate A / Generate B → Result A / Result B — the brief's mandatory branching scenario. */
export const branchingGraph = (): Graph => ({
  nodes: [
    promptNode('prompt'),
    generateNode('gen-a', { seed: 1 }),
    generateNode('gen-b', { seed: 2 }),
    resultNode('result-a'),
    resultNode('result-b'),
  ],
  edges: [
    edge('prompt', 'gen-a', 'prompt'),
    edge('prompt', 'gen-b', 'prompt'),
    edge('gen-a', 'result-a', 'image'),
    edge('gen-b', 'result-b', 'image'),
  ],
});

/** A job in a run snapshot: a successful Generate Image job that ran from t=1000 to t=2000 unless told otherwise. */
export const job = (nodeId: string, fields: Partial<Job> = {}): Job => ({
  nodeId,
  nodeType: 'generateImage',
  status: 'success',
  attempt: 1,
  startedAt: 1_000,
  finishedAt: 2_000,
  cached: false,
  ...fields,
});

/** A run snapshot holding `jobs`: completed, from t=1000 to t=2000, unless told otherwise. */
export const runSnapshot = (jobs: readonly Job[], fields: Partial<Run> = {}): Run => ({
  id: 'run_test',
  status: 'completed',
  version: 1,
  createdAt: 0,
  startedAt: 1_000,
  finishedAt: 2_000,
  jobs: Object.fromEntries(jobs.map((item) => [item.nodeId, item])),
  summary: emptyRunSummary(),
  ...fields,
});
