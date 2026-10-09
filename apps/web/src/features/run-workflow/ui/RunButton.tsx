import { Button, Spinner } from '@/shared/ui';
import { useRunShortcut } from '../model/use-run-shortcut';
import { useRunWorkflow } from '../model/use-run-workflow';

const SHORTCUT = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘↵' : 'Ctrl ↵';

export function RunButton() {
  const { run, busy } = useRunWorkflow();
  useRunShortcut(run);
  return (
    <Button variant="primary" disabled={busy} onClick={run} title={`Run the workflow (${SHORTCUT})`}>
      {busy ? <Spinner size="sm" /> : <span aria-hidden="true">▶</span>}
      {busy ? 'Running…' : 'Run'}
      <kbd aria-hidden="true">{SHORTCUT}</kbd>
    </Button>
  );
}
