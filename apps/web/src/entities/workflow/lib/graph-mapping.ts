import { isInputHandle, type Graph, type GraphEdge, type GraphNode } from '@trafaret/core';
import type { FlowEdge, FlowNode } from '../model/types';
import { layoutByDepth } from './auto-layout';

/** The canvas state as a graph: exactly what is saved, exported and posted to /api/runs. */
export function toGraph(nodes: readonly FlowNode[], edges: readonly FlowEdge[]): Graph {
  return { nodes: nodes.map(toGraphNode), edges: edges.flatMap(toGraphEdge) };
}

// React Flow adds selection, size and drag state; a graph node keeps id, type, data and position only.
const toGraphNode = ({ id, type, data, position }: FlowNode): GraphNode =>
  // `type` and `data` come from the same node, but TypeScript can't follow the pairing through destructuring.
  ({ id, type, data, position: { x: position.x, y: position.y } }) as GraphNode;

const toGraphEdge = (edge: FlowEdge): GraphEdge[] =>
  isInputHandle(edge.targetHandle)
    ? [
        {
          id: edge.id,
          source: edge.source,
          sourceHandle: 'out',
          target: edge.target,
          targetHandle: edge.targetHandle,
        },
      ]
    : [];

/** A graph as canvas state. Nodes without a position (hand-written graphs) are laid out by depth. */
export function fromGraph(graph: Graph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const layout = graph.nodes.some((node) => !node.position) ? layoutByDepth(graph) : undefined;
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: node.position ?? layout?.get(node.id) ?? { x: 0, y: 0 },
    })),
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
}
