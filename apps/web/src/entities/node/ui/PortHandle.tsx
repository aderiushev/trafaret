import { Handle, Position } from '@xyflow/react';
import type { PortType } from '@trafaret/core';
import { cx } from '@/shared/lib';
import { HANDLE_TOP } from '../config/layout';
import styles from './PortHandle.module.css';

type PortHandleProps = {
  direction: 'input' | 'output';
  handle: string;
  portType: PortType;
  label: string;
  /** Distance from the top of the card in px. */
  top?: number;
  /** While a wire is being dragged: whether it may end here. Null when no wire is dragged. */
  compatible?: boolean | null;
};

/** A typed port: coloured by its type, labelled, and lit up or dimmed while a wire is dragged. */
export function PortHandle({
  direction,
  handle,
  portType,
  label,
  top = HANDLE_TOP.first,
  compatible = null,
}: PortHandleProps) {
  const input = direction === 'input';
  return (
    <Handle
      id={handle}
      type={input ? 'target' : 'source'}
      position={input ? Position.Left : Position.Right}
      className={cx(
        styles.handle,
        styles[portType],
        compatible === true && styles.compatible,
        compatible === false && styles.dimmed,
      )}
      style={{ top }}
      title={`${label} (${portType})`}
    >
      <span className={cx(styles.label, input ? styles.inputLabel : styles.outputLabel)}>{label}</span>
    </Handle>
  );
}
