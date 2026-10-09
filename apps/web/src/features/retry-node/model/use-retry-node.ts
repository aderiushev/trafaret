import { useMutation, useQueryClient } from '@tanstack/react-query';
import { retryNodeMutation, runQueryKey } from '@/entities/run';
import { toApiError } from '@/shared/api';
import { toast } from '@/shared/ui';

export function useRetryNode() {
  const queryClient = useQueryClient();
  return useMutation({
    ...retryNodeMutation,
    // Fetch the run at once: it is running again, so polling carries on from there.
    onSuccess: (_, { runId }) => queryClient.invalidateQueries({ queryKey: runQueryKey(runId) }),
    onError: (error) => toast.error(toApiError(error).message),
  });
}
