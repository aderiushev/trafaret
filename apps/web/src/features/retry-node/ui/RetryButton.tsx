import { Button } from '@/shared/ui';
import { useRetryNode } from '../model/use-retry-node';

/** Re-runs a failed node (and the nodes it skipped) in the same run. Never automatic: a retry may cost money. */
export function RetryButton({ runId, nodeId }: { runId: string; nodeId: string }) {
  const { mutate, isPending } = useRetryNode();
  return (
    <Button size="sm" disabled={isPending} onClick={() => mutate({ runId, nodeId })}>
      {isPending ? 'Retrying…' : 'Retry'}
    </Button>
  );
}
