import { nodeLabel } from '@trafaret/core';
import { useCatalog } from '@/entities/catalog';
import { useNodeJob, useRunSession } from '@/entities/run';
import { useSelectedNodeIds, useWorkflowNode } from '@/entities/workflow';
import { useNow } from '@/shared/lib';
import { Panel } from '@/shared/ui';
import { JobDetails } from './JobDetails';
import styles from './NodeInspector.module.css';
import { RequestPreview } from './RequestPreview';

const SHORTCUTS: ReadonlyArray<[keys: string, action: string]> = [
  ['⌘/Ctrl ↵', 'Run the workflow'],
  ['Delete', 'Remove the selection'],
  ['Esc', 'Clear the selection'],
  ['Shift + drag', 'Select several nodes'],
];

export function NodeInspector() {
  const selected = useSelectedNodeIds();
  const [only] = selected;
  return (
    <Panel title="Inspector">
      {selected.length === 1 && only ? (
        <NodeDetails nodeId={only} />
      ) : (
        <div className={styles.idle}>
          <p className={styles.hint}>
            {selected.length > 1
              ? `${selected.length} nodes selected.`
              : 'Select a node to see its status and exactly what it sent to the AI.'}
          </p>
          <dl className={styles.shortcuts}>
            {SHORTCUTS.map(([keys, action]) => (
              <div key={keys} className={styles.shortcut}>
                <dt>
                  <kbd>{keys}</kbd>
                </dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Panel>
  );
}

function NodeDetails({ nodeId }: { nodeId: string }) {
  const node = useWorkflowNode(nodeId);
  const job = useNodeJob(nodeId);
  const runId = useRunSession((state) => state.activeRunId);
  const models = useCatalog().data ?? [];
  const now = useNow(job?.status === 'running', 500);
  if (!node) return null;
  return (
    <div className={styles.details}>
      <h3 className={styles.nodeTitle}>{nodeLabel(node.type)}</h3>
      {job ? (
        <JobDetails job={job} runId={runId} models={models} now={now} />
      ) : (
        <p className={styles.hint}>Not run yet.</p>
      )}
      {job?.request && <RequestPreview request={job.request} />}
    </div>
  );
}
