import { useCatalog } from '@/entities/catalog';
import { useRunPolling } from '@/entities/run';
import { useStarterWorkflow } from '@/features/load-template';
import { EditorToolbar } from '@/widgets/editor-toolbar';
import { NodeInspector } from '@/widgets/node-inspector';
import { RunTimeline } from '@/widgets/run-timeline';
import { WorkflowCanvas } from '@/widgets/workflow-canvas';
import styles from './EditorPage.module.css';

export function EditorPage() {
  // The page polls the active run once for every widget, and places the starter workflow on a first visit.
  useRunPolling();
  useStarterWorkflow();
  // Without the models no template loads and no AI node can be added, so the page says why, first thing.
  const serverUnreachable = useCatalog().isError;
  return (
    <div className={styles.page}>
      <EditorToolbar />
      {serverUnreachable && (
        <p role="alert" className={styles.notice}>
          Can't reach the server. Reload the page to try again.
        </p>
      )}
      <main className={styles.main}>
        <WorkflowCanvas />
        <aside className={styles.inspector}>
          <NodeInspector />
        </aside>
      </main>
      <RunTimeline />
    </div>
  );
}
