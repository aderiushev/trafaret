import type { NodeProps } from '@xyflow/react';
import { ASPECT_RATIOS, isAspectRatio } from '@trafaret/core';
import { ModelSelect, supportedAspectRatio, useCatalog } from '@/entities/catalog';
import { NodeShell, PortHandle } from '@/entities/node';
import { PresetReferences, PresetSelect, usePresets } from '@/entities/preset';
import { JobStatusBadge } from '@/entities/run';
import { useWorkflowStore, type FlowNodeOf } from '@/entities/workflow';
import { useHandleCompatibility } from '@/features/connect-nodes';
import { cx } from '@/shared/lib';
import { Field, Select } from '@/shared/ui';
import { useNodeView } from '../../model/use-node-view';
import { JobError, OutputPreview, SeedField } from './parts';
import styles from './nodes.module.css';

export function GenerateImageNode({ id, data, selected }: NodeProps<FlowNodeOf<'generateImage'>>) {
  const view = useNodeView(id, data);
  const update = useWorkflowStore((state) => state.updateNodeData);
  const models = useCatalog().data ?? [];
  const presets = usePresets().data ?? [];
  const promptIn = useHandleCompatibility(id, 'prompt', 'target');
  const out = useHandleCompatibility(id, 'out', 'source');
  const model = models.find((candidate) => candidate.id === data.modelId);

  const changeModel = (modelId: string): void => {
    const next = models.find((candidate) => candidate.id === modelId);
    update(id, 'generateImage', {
      modelId,
      ...(next && { aspectRatio: supportedAspectRatio(next, data.aspectRatio) }),
    });
  };

  return (
    <NodeShell
      title="Generate Image"
      category="generation"
      status={view.status}
      selected={selected}
      edited={view.edited}
      issues={view.issues}
      badge={view.job && <JobStatusBadge status={view.status} elapsedMs={view.elapsedMs} />}
      handles={
        <>
          <PortHandle
            direction="input"
            handle="prompt"
            portType="text"
            label="Prompt"
            compatible={promptIn}
          />
          <PortHandle direction="output" handle="out" portType="image" label="Image" compatible={out} />
        </>
      }
    >
      <div className={cx(styles.fields, 'nodrag')}>
        <Field label="Model">
          <ModelSelect models={models} value={data.modelId} onChange={changeModel} />
        </Field>
        <Field label="Preset">
          <PresetSelect
            presets={presets}
            value={data.presetId}
            onChange={(presetId) => update(id, 'generateImage', { presetId })}
          />
        </Field>
        <PresetReferences preset={presets.find((preset) => preset.id === data.presetId)} />
        <div className={styles.row}>
          <Field label="Aspect ratio">
            <Select
              value={data.aspectRatio}
              onChange={(event) => {
                const ratio = event.target.value;
                if (isAspectRatio(ratio)) update(id, 'generateImage', { aspectRatio: ratio });
              }}
            >
              {(model?.aspectRatios ?? ASPECT_RATIOS).map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
                </option>
              ))}
            </Select>
          </Field>
          <SeedField nodeId={id} type="generateImage" seed={data.seed} />
        </div>
      </div>
      <OutputPreview job={view.job} />
      <JobError job={view.job} runId={view.runId} />
    </NodeShell>
  );
}
