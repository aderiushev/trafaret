import type { Issue, Job, JobStatus } from '@trafaret/core';
import { isNodeEdited, useNodeJob, useRunSession } from '@/entities/run';
import { useNodeIssues } from '@/entities/workflow';
import { useNow } from '@/shared/lib';

export type NodeView = {
  runId: string | null;
  job: Job | undefined;
  status: JobStatus;
  edited: boolean;
  issues: Issue[];
  /** How long the job has been running; null unless it is running. */
  elapsedMs: number | null;
};

/** What a card shows besides its settings: its job in the active run, its issues, and whether it was edited. */
export function useNodeView(nodeId: string, data: Readonly<Record<string, unknown>>): NodeView {
  const runId = useRunSession((state) => state.activeRunId);
  const submitted = useRunSession((state) => state.submittedGraph);
  const job = useNodeJob(nodeId);
  const issues = useNodeIssues(nodeId);
  const runningSince = job?.status === 'running' ? job.startedAt : null;
  const now = useNow(runningSince !== null, 500);
  return {
    runId,
    job,
    status: job?.status ?? 'idle',
    edited: isNodeEdited(nodeId, data, submitted),
    issues,
    elapsedMs: runningSince === null ? null : Math.max(0, now - runningSince),
  };
}
