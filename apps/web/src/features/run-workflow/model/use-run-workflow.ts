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
  const { mutate } = useMutation(startRunMutation);

  // Issues go onto their nodes and into a toast.
  const report = (issues: readonly Issue[]): void => {
    setIssues(issues);
    const { title, details } = describeIssues(issues);
    toast.error(title, details);
  };

  const run = (): void => {
    if (busy) return;
    const graph = getWorkflowGraph();
    const issues = validateGraph(graph);
    if (issues.length > 0) {
      report(issues);
      return;
    }
    mutate(graph, {
      onSuccess: (runId) => {
        setIssues([]);
        startSession(runId, graph);
      },
      onError: (error) => {
        // The server re-checks the graph (models, presets, uploads) and may still find issues.
        const apiError = toApiError(error);
        if (apiError.issues.length > 0) report(apiError.issues);
        else toast.error(apiError.message);
      },
    });
  };

  return { run, busy };
}
