import type { NodeProps } from '@xyflow/react';
import type { JobStatus } from '@trafaret/core';
import { NodeShell, PortHandle } from '@/entities/node';
import { useNodeJob } from '@/entities/run';
import { useUpstreamNodeId, type FlowNodeOf } from '@/entities/workflow';
import { useHandleCompatibility } from '@/features/connect-nodes';
import { cx } from '@/shared/lib';
import { Spinner } from '@/shared/ui';
import { useNodeView } from '../../model/use-node-view';
import { JobBadges, JobError } from './parts';
import styles from './nodes.module.css';

function Placeholder({ status }: { status: JobStatus }) {
  if (status === 'error') return null;
  if (status === 'queued' || status === 'running') {
    return (
      <p className={styles.placeholder}>
        <Spinner size="sm" /> Waiting for the image…
      </p>
    );
  }
  return <p className={styles.placeholder}>Run the workflow to see the image here.</p>;
}

export function ResultNode({ id, data, selected }: NodeProps<FlowNodeOf<'result'>>) {
  const view = useNodeView(id, data);
  const imageIn = useHandleCompatibility(id, 'image', 'target');
  // The badges describe the node that made the image.
  const sourceId = useUpstreamNodeId(id, 'image');
  const sourceJob = useNodeJob(sourceId);
  const output = view.job?.output?.kind === 'image' ? view.job.output : null;
  return (
    <NodeShell
      title="Result"
      category="output"
      status={view.status}
      selected={selected}
      issues={view.issues}
      handles={
        <PortHandle direction="input" handle="image" portType="image" label="Image" compatible={imageIn} />
      }
    >
      {output ? (
        <figure className={styles.result}>
          <img
            src={output.url}
            alt="Result"
            width={output.width}
            height={output.height}
            className={styles.resultImage}
          />
          <figcaption className={styles.resultFooter}>
            <span className={styles.badges}>
              <JobBadges job={sourceJob} />
            </span>
            <a className={cx(styles.download, 'nodrag')} href={output.url} download={`trafaret-${id}.webp`}>
              Download
            </a>
          </figcaption>
        </figure>
      ) : (
        <Placeholder status={view.status} />
      )}
      <JobError job={view.job} runId={view.runId} />
    </NodeShell>
  );
}
