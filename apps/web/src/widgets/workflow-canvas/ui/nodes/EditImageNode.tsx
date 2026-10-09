import type { NodeProps } from '@xyflow/react';
import { ModelSelect, useCatalog } from '@/entities/catalog';
import { HANDLE_TOP, NodeShell, PortHandle } from '@/entities/node';
import { PresetReferences, PresetSelect, usePresets } from '@/entities/preset';
import { JobStatusBadge } from '@/entities/run';
import { useUpstreamNodeId, useWorkflowStore, type FlowNodeOf } from '@/entities/workflow';
import { useHandleCompatibility } from '@/features/connect-nodes';
import { cx } from '@/shared/lib';
import { Field, Textarea } from '@/shared/ui';
import { useNodeView } from '../../model/use-node-view';
import { JobError, OutputPreview, SeedField } from './parts';
import styles from './nodes.module.css';

export function EditImageNode({ id, data, selected }: NodeProps<FlowNodeOf<'editImage'>>) {
  const view = useNodeView(id, data);
  const update = useWorkflowStore((state) => state.updateNodeData);
  const models = useCatalog().data ?? [];
  const presets = usePresets().data ?? [];
  const imageIn = useHandleCompatibility(id, 'image', 'target');
  const promptIn = useHandleCompatibility(id, 'prompt', 'target');
  const out = useHandleCompatibility(id, 'out', 'source');
  // A wired prompt replaces the instruction.
  const promptWired = useUpstreamNodeId(id, 'prompt') !== null;

  return (
    <NodeShell
      title="Edit Image"
      category="generation"
      status={view.status}
      selected={selected}
      edited={view.edited}
      issues={view.issues}
      badge={view.job && <JobStatusBadge status={view.status} elapsedMs={view.elapsedMs} />}
      handles={
        <>
          <PortHandle direction="input" handle="image" portType="image" label="Image" compatible={imageIn} />
          <PortHandle
            direction="input"
            handle="prompt"
            portType="text"
            label="Prompt"
            top={HANDLE_TOP.second}
            compatible={promptIn}
          />
          <PortHandle direction="output" handle="out" portType="image" label="Image" compatible={out} />
        </>
      }
    >
      <div className={cx(styles.fields, 'nodrag')}>
        <Field label="Instruction">
          <Textarea
            className="nowheel"
            disabled={promptWired}
            placeholder={promptWired ? 'Using connected prompt' : 'Describe the change…'}
            value={promptWired ? '' : data.instruction}
            onChange={(event) => update(id, 'editImage', { instruction: event.target.value })}
          />
        </Field>
        <Field label="Model">
          <ModelSelect
            models={models}
            value={data.modelId}
            editOnly
            onChange={(modelId) => update(id, 'editImage', { modelId })}
          />
        </Field>
        <Field label="Preset">
          <PresetSelect
            presets={presets}
            value={data.presetId}
            onChange={(presetId) => update(id, 'editImage', { presetId })}
          />
        </Field>
        <PresetReferences preset={presets.find((preset) => preset.id === data.presetId)} />
        <SeedField nodeId={id} type="editImage" seed={data.seed} />
      </div>
      <OutputPreview job={view.job} />
      <JobError job={view.job} runId={view.runId} />
    </NodeShell>
  );
}
