import { TemplateButtons } from '@/features/load-template';
import styles from './WorkflowCanvas.module.css';

export function EmptyCanvas() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyPanel}>
        <h2 className={styles.emptyTitle}>Start from a template or add a node</h2>
        <TemplateButtons />
      </div>
    </div>
  );
}
