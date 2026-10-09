import { useMutation, useQueryClient } from '@tanstack/react-query';
import { retryNode, runQueryKey } from '@/entities/run';
import { toApiError } from '@/shared/api';
import { toast } from '@/shared/ui';

type RetryTarget = { runId: string; nodeId: string };

export function useRetryNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, nodeId }: RetryTarget) => retryNode(runId, nodeId),
    // Fetch the run at once: it is running again, so polling carries on from there.
    onSuccess: (_, { runId }) => queryClient.invalidateQueries({ queryKey: runQueryKey(runId) }),
    onError: (error) => toast.error(toApiError(error).message),
  });
}
