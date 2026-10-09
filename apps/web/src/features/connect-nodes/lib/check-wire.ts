import { canConnect, indexGraph, type ConnectResult, type Graph } from '@trafaret/core';

/** One end of a wire, as React Flow reports it while the wire is dragged. */
export type WireEnd = { nodeId: string; handleId: string | null | undefined; type: 'source' | 'target' };

/** Checks a wire dragged from either end against the one wiring rule. */
export function checkWire(graph: Graph, from: WireEnd, to: WireEnd): ConnectResult {
  if (from.type === to.type) {
    return { ok: false, code: 'PORT_TYPE_MISMATCH', reason: 'Connect an output to an input.' };
  }
  const [source, target] = from.type === 'source' ? [from, to] : [to, from];
  return canConnect(indexGraph(graph), {
    source: source.nodeId,
    sourceHandle: source.handleId ?? null,
    target: target.nodeId,
    targetHandle: target.handleId ?? null,
  });
}
