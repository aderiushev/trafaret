import type { XYPosition } from '@xyflow/react';
import { indexGraph, topologicalOrder, type Graph } from '@trafaret/core';

const COLUMN_WIDTH = 340;
const ROW_HEIGHT = 260;

/**
 * A position for every node: one column right of its deepest input, rows in node order. Used for graphs written
 * by hand (the API ignores positions), so they still open as a readable left-to-right flow.
 */
export function layoutByDepth(graph: Graph): Map<string, XYPosition> {
  const index = indexGraph(graph);
  const order = topologicalOrder(index) ?? graph.nodes.map((node) => node.id);
  const depth = new Map<string, number>();
  for (const id of order) {
    const inputs = index.incoming.get(id) ?? [];
    depth.set(id, Math.max(0, ...inputs.map((edge) => (depth.get(edge.source) ?? 0) + 1)));
  }
  const rowsUsed = new Map<number, number>();
  const positions = new Map<string, XYPosition>();
  for (const node of graph.nodes) {
    const column = depth.get(node.id) ?? 0;
    const row = rowsUsed.get(column) ?? 0;
    rowsUsed.set(column, row + 1);
    positions.set(node.id, { x: column * COLUMN_WIDTH, y: row * ROW_HEIGHT });
  }
  return positions;
}
