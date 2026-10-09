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
  return (
    <div className={styles.page}>
      <EditorToolbar />
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
