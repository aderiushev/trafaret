import type { Graph, GraphEdge, GraphNode } from './graph.ts';

export type GraphIndex = {
  readonly nodes: ReadonlyMap<string, GraphNode>;
  readonly incoming: ReadonlyMap<string, readonly GraphEdge[]>;
  readonly outgoing: ReadonlyMap<string, readonly GraphEdge[]>;
};

/** Adjacency lists for a graph. Edges that reference missing nodes are left out (validateGraph reports them). */
export function indexGraph(graph: Graph): GraphIndex {
  const nodes = new Map<string, GraphNode>();
  const incoming = new Map<string, GraphEdge[]>();
  const outgoing = new Map<string, GraphEdge[]>();
  for (const node of graph.nodes) {
    nodes.set(node.id, node);
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }
  for (const edge of graph.edges) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) continue;
    incoming.get(edge.target)?.push(edge);
    outgoing.get(edge.source)?.push(edge);
  }
  return { nodes, incoming, outgoing };
}

/** Kahn's algorithm. Ties keep the order of `graph.nodes`. Returns null when the graph has a cycle. */
export function topologicalOrder(index: GraphIndex): string[] | null {
  const remaining = new Map<string, number>();
  for (const [id, edges] of index.incoming) remaining.set(id, edges.length);
  const ready = [...index.nodes.keys()].filter((id) => remaining.get(id) === 0);
  const order: string[] = [];
  for (const id of ready) {
    order.push(id);
    for (const edge of index.outgoing.get(id) ?? []) {
      const left = (remaining.get(edge.target) ?? 0) - 1;
      remaining.set(edge.target, left);
      if (left === 0) ready.push(edge.target);
    }
  }
  return order.length === index.nodes.size ? order : null;
}

function walk(
  start: string,
  next: ReadonlyMap<string, readonly GraphEdge[]>,
  pick: (edge: GraphEdge) => string,
): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    for (const edge of next.get(id) ?? []) {
      const neighbour = pick(edge);
      if (seen.has(neighbour)) continue;
      seen.add(neighbour);
      stack.push(neighbour);
    }
  }
  return seen;
}

export const ancestorsOf = (index: GraphIndex, nodeId: string): Set<string> =>
  walk(nodeId, index.incoming, (edge) => edge.source);

export const descendantsOf = (index: GraphIndex, nodeId: string): Set<string> =>
  walk(nodeId, index.outgoing, (edge) => edge.target);

export const wouldCreateCycle = (index: GraphIndex, source: string, target: string): boolean =>
  source === target || descendantsOf(index, target).has(source);
