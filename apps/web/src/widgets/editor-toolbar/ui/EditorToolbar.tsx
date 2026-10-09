import { NodePalette } from '@/features/add-node';
import { DeleteSelectionButton } from '@/features/delete-selection';
import { ExportImportButtons } from '@/features/export-import';
import { TemplateMenu } from '@/features/load-template';
import { RunButton } from '@/features/run-workflow';
import styles from './EditorToolbar.module.css';

export function EditorToolbar() {
  return (
    <header className={styles.toolbar}>
      <h1 className={styles.logo}>Trafaret</h1>
      <TemplateMenu />
      <NodePalette />
      <div className={styles.actions}>
        <ExportImportButtons />
        <DeleteSelectionButton />
        <RunButton />
      </div>
    </header>
  );
}
