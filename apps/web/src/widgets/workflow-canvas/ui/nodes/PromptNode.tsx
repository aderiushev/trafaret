import type { NodeProps } from '@xyflow/react';
import { LIMITS } from '@trafaret/core';
import { NodeShell, PortHandle } from '@/entities/node';
import { useWorkflowStore, type FlowNodeOf } from '@/entities/workflow';
import { useHandleCompatibility } from '@/features/connect-nodes';
import { cx } from '@/shared/lib';
import { Textarea } from '@/shared/ui';
import { useNodeView } from '../../model/use-node-view';
import styles from './nodes.module.css';

const count = (value: number): string => value.toLocaleString('en-US');

export function PromptNode({ id, data, selected }: NodeProps<FlowNodeOf<'prompt'>>) {
  const view = useNodeView(id, data);
  const update = useWorkflowStore((state) => state.updateNodeData);
  const out = useHandleCompatibility(id, 'out', 'source');
  return (
    <NodeShell
      title="Prompt"
      category="input"
      status={view.status}
      selected={selected}
      edited={view.edited}
      issues={view.issues}
      handles={<PortHandle direction="output" handle="out" portType="text" label="Text" compatible={out} />}
    >
      <Textarea
        aria-label="Prompt"
        className="nodrag nowheel"
        placeholder="Describe the image you want…"
        value={data.text}
        onChange={(event) => update(id, 'prompt', { text: event.target.value })}
      />
      <span className={cx(styles.counter, data.text.length > LIMITS.textLength && styles.over)}>
        {count(data.text.length)} / {count(LIMITS.textLength)}
      </span>
    </NodeShell>
  );
}
