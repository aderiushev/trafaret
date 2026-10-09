import { useMutation } from '@tanstack/react-query';
import { validateGraph, type Issue } from '@trafaret/core';
import { startRunMutation, useIsRunBusy, useRunSession } from '@/entities/run';
import { getWorkflowGraph, useWorkflowStore } from '@/entities/workflow';
import { toApiError } from '@/shared/api';
import { toast } from '@/shared/ui';
import { describeIssues } from '../lib/describe-issues';

/** Checks the workflow with the same rules as the server, then starts a run of it. */
export function useRunWorkflow(): { run: () => void; busy: boolean } {
  const busy = useIsRunBusy();
  const startSession = useRunSession((state) => state.start);
  const setIssues = useWorkflowStore((state) => state.setIssues);

  // Issues go onto their nodes and into a toast.
  const report = (issues: readonly Issue[]): void => {
    setIssues(issues);
    const { title, details } = describeIssues(issues);
    toast.error(title, details);
  };

  // Callbacks given to `mutate` are dropped once the caller unmounts (a card deleted while its 🎲 run starts);
  // these run whatever happens to the caller, so a started run is always tracked.
  const { mutate } = useMutation({
    ...startRunMutation,
    onSuccess: (runId, graph) => {
      setIssues([]);
      toast.clearErrors(); // once a run has started, earlier error messages no longer apply
      startSession(runId, graph);
    },
    onError: (error) => {
      // The server re-checks the graph (models, presets, uploads) and may still find issues.
      const apiError = toApiError(error);
      if (apiError.issues.length > 0) report(apiError.issues);
      else toast.error(apiError.message);
    },
  });

  const run = (): void => {
    if (busy) return;
    const graph = getWorkflowGraph();
    const issues = validateGraph(graph);
    if (issues.length > 0) {
      report(issues);
      return;
    }
    mutate(graph);
  };

  return { run, busy };
}
