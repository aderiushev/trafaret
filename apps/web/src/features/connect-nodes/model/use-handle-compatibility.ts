import { useConnection, type HandleType } from '@xyflow/react';
import { getWorkflowGraph } from '@/entities/workflow';
import { checkWire } from '../lib/check-wire';

/**
 * While a wire is being dragged: whether it may end on this handle, so only compatible handles light up.
 * Null when no wire is dragged, and for the handle the wire starts from.
 */
export function useHandleCompatibility(nodeId: string, handleId: string, type: HandleType): boolean | null {
  // Three primitive selections, so the card re-renders when a drag starts or ends — not on every mouse move.
  const fromNodeId = useConnection((connection) => connection.fromHandle?.nodeId ?? null);
  const fromHandleId = useConnection((connection) => connection.fromHandle?.id ?? null);
  const fromType = useConnection((connection) => connection.fromHandle?.type ?? null);
  if (fromNodeId === null || fromType === null) return null;
  if (fromNodeId === nodeId && fromHandleId === handleId) return null;
  const from = { nodeId: fromNodeId, handleId: fromHandleId, type: fromType };
  return checkWire(getWorkflowGraph(), from, { nodeId, handleId, type }).ok;
}
