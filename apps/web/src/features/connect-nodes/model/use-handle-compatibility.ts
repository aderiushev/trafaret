import { useConnection, type HandleType } from '@xyflow/react';
import { toGraph, useWorkflowStore } from '@/entities/workflow';
import { checkWire, isSameHandle } from '../lib/check-wire';

/**
 * While a wire is being dragged: whether it may end on this handle, so only compatible handles light up.
 * Null when no wire is dragged, and for the handle the wire starts from.
 */
export function useHandleCompatibility(nodeId: string, handleId: string, type: HandleType): boolean | null {
  // Three primitive selections, so the card re-renders when a drag starts or ends — not on every mouse move.
  const fromNodeId = useConnection((connection) => connection.fromHandle?.nodeId ?? null);
  const fromHandleId = useConnection((connection) => connection.fromHandle?.id ?? null);
  const fromType = useConnection((connection) => connection.fromHandle?.type ?? null);
  // The graph is read inside the store selector, so the verdict follows every change to it.
  return useWorkflowStore((state) => {
    if (fromNodeId === null || fromType === null) return null;
    const from = { nodeId: fromNodeId, handleId: fromHandleId, type: fromType };
    const here = { nodeId, handleId, type };
    if (isSameHandle(from, here)) return null;
    return checkWire(toGraph(state.nodes, state.edges), from, here).ok;
  });
}
