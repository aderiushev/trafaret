import { graphSchema, type CreateRunBody, type Graph } from '@trafaret/core';

export const WORKFLOW_FILE_NAME = 'trafaret-workflow.json';

/** An export is exactly the body of POST /api/runs, so `curl -d @trafaret-workflow.json …` runs it as it is. */
export const toWorkflowFile = (graph: Graph): CreateRunBody => ({ graph });

const unique = (ids: readonly string[]): boolean => new Set(ids).size === ids.length;

/** Reads an exported workflow, or a bare graph. Null for anything else, including repeated ids. */
export function parseWorkflowFile(text: string): Graph | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const candidate = typeof json === 'object' && json !== null && 'graph' in json ? json.graph : json;
  const parsed = graphSchema.safeParse(candidate);
  if (!parsed.success) return null;
  const { nodes, edges } = parsed.data;
  // The canvas keys nodes and wires by id; repeated ids would confuse it.
  return unique(nodes.map((node) => node.id)) && unique(edges.map((edge) => edge.id)) ? parsed.data : null;
}
