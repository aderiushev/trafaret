import type { IsValidConnection } from '@xyflow/react';
import { canConnect, indexGraph } from '@trafaret/core';
import { getWorkflowGraph, useWorkflowStore, type FlowEdge } from '@/entities/workflow';

/** The canvas's wiring callbacks: a wire is only accepted when the shared rule allows it. */
export function useConnectionRules() {
  const onConnect = useWorkflowStore((state) => state.connect);
  const isValidConnection: IsValidConnection<FlowEdge> = (wire) =>
    canConnect(indexGraph(getWorkflowGraph()), {
      source: wire.source,
      sourceHandle: wire.sourceHandle ?? null,
      target: wire.target,
      targetHandle: wire.targetHandle ?? null,
    }).ok;
  return { isValidConnection, onConnect };
}
