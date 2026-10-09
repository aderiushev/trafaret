import { getBezierPath, type ConnectionLineComponentProps, type Handle } from '@xyflow/react';
import { getWorkflowGraph, type FlowNode } from '@/entities/workflow';
import { cx } from '@/shared/lib';
import { checkWire, isSameHandle, type WireEnd } from '../lib/check-wire';
import styles from './ConnectionLine.module.css';

const wireEnd = (handle: Handle): WireEnd => ({
  nodeId: handle.nodeId,
  handleId: handle.id,
  type: handle.type,
});

/** The wire being dragged. Over a handle it can't connect to, it turns red and says why. */
export function ConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  fromHandle,
  toHandle,
}: ConnectionLineComponentProps<FlowNode>) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });
  const from = wireEnd(fromHandle);
  const to = toHandle ? wireEnd(toHandle) : null;
  // While the pointer is still on the start handle, React Flow reports it as the end too: nothing to judge yet.
  const verdict = to && !isSameHandle(from, to) ? checkWire(getWorkflowGraph(), from, to) : null;
  const reason = verdict && !verdict.ok ? verdict.reason : null;
  return (
    <g className={cx(styles.wire, reason !== null && styles.rejected)}>
      <path d={path} className={styles.path} />
      {reason !== null && (
        <foreignObject x={toX + 14} y={toY - 18} width={240} height={56}>
          <p role="status" className={styles.reason}>
            {reason}
          </p>
        </foreignObject>
      )}
    </g>
  );
}
