import type { NodeProps } from '@xyflow/react';
import { NodeShell, PortHandle } from '@/entities/node';
import type { FlowNodeOf } from '@/entities/workflow';
import { useHandleCompatibility } from '@/features/connect-nodes';
import { ImageUpload } from '@/features/upload-image';
import { useNodeView } from '../../model/use-node-view';
import { JobError } from './parts';

export function ImageInputNode({ id, data, selected }: NodeProps<FlowNodeOf<'imageInput'>>) {
  const view = useNodeView(id, data);
  const out = useHandleCompatibility(id, 'out', 'source');
  return (
    <NodeShell
      title="Image Input"
      category="input"
      status={view.status}
      selected={selected}
      edited={view.edited}
      issues={view.issues}
      handles={<PortHandle direction="output" handle="out" portType="image" label="Image" compatible={out} />}
    >
      <div className="nodrag">
        <ImageUpload nodeId={id} assetId={data.assetId} />
      </div>
      <JobError job={view.job} runId={view.runId} />
    </NodeShell>
  );
}
