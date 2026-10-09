import { mutationOptions, queryOptions, useIsMutating, useQuery } from '@tanstack/react-query';
import { isTerminalRunStatus, type Job, type Run } from '@trafaret/core';
import { createRun, fetchRun, retryNode } from '../api/run-api';
import { keepNewerRun } from '../lib/keep-newer-run';
import { shouldRetryRunPoll } from '../lib/should-retry-run-poll';
import { useRunSession } from './run-session';

export const POLL_INTERVAL_MS = 700;

export const runQueryKey = (runId: string) => ['runs', runId] as const;

export const runQueryOptions = (runId: string) =>
  queryOptions({
    queryKey: runQueryKey(runId),
    queryFn: ({ signal }) => fetchRun(runId, signal),
    retry: shouldRetryRunPoll,
    // This cache entry only ever holds runs.
    structuralSharing: (previous: unknown, next: unknown) =>
      keepNewerRun(previous as Run | undefined, next as Run),
  });

export const startRunMutation = mutationOptions({ mutationKey: ['runs', 'start'], mutationFn: createRun });

export const retryNodeMutation = mutationOptions({
  mutationKey: ['runs', 'retry'],
  mutationFn: ({ runId, nodeId }: { runId: string; nodeId: string }) => retryNode(runId, nodeId),
});

/** Polls the active run until it ends. Mount it once: every polling observer would add its own timer. */
export function useRunPolling(): void {
  const runId = useRunSession((state) => state.activeRunId);
  useQuery({
    ...runQueryOptions(runId ?? ''),
    enabled: runId !== null,
    refetchInterval: (query) => {
      const run = query.state.data;
      if (query.state.status === 'error' || (run && isTerminalRunStatus(run.status))) return false;
      return POLL_INTERVAL_MS;
    },
  });
}

/** The active run as last polled. Reading it never sends a request. */
export function useActiveRunQuery() {
  const runId = useRunSession((state) => state.activeRunId);
  return useQuery({ ...runQueryOptions(runId ?? ''), enabled: false });
}

export const useActiveRun = (): Run | undefined => useActiveRunQuery().data;

export function useNodeJob(nodeId: string | null): Job | undefined {
  const run = useActiveRun();
  return nodeId === null ? undefined : run?.jobs[nodeId];
}

/** True while a run is being started or retried, or is still going: Run and 🎲 wait for it to end. */
export function useIsRunBusy(): boolean {
  // The key prefix matches both run mutations, start and retry; useIsMutating never counts the run queries.
  const sending = useIsMutating({ mutationKey: ['runs'] }) > 0;
  const runId = useRunSession((state) => state.activeRunId);
  const { data: run, isError } = useActiveRunQuery();
  return sending || (runId !== null && !isError && (!run || !isTerminalRunStatus(run.status)));
}
