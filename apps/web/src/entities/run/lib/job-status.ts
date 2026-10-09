import type { Graph, Job, JobStatus } from '@trafaret/core';

export const JOB_STATUS_LABEL: Readonly<Record<JobStatus, string>> = {
  idle: 'Not run',
  queued: 'Queued',
  running: 'Running',
  success: 'Done',
  error: 'Failed',
};

/**
 * Where a Retry goes: the failed node itself or, for a node skipped because an input failed, the node that
 * caused it. Null when retrying can't help (the failure is not retryable).
 */
export function retryTarget(job: Job): string | null {
  if (job.status !== 'error' || !job.error?.retryable) return null;
  return job.error.code === 'UPSTREAM_FAILED' ? (job.error.upstreamNodeId ?? null) : job.nodeId;
}

/** How long the job has run (so far, while running). Null before it starts and for a reused result. */
export function jobDurationMs(job: Job, now: number): number | null {
  if (job.cached || job.startedAt === null) return null;
  return (job.finishedAt ?? now) - job.startedAt;
}

/** True when a node's settings differ from the ones the active run was started with. */
export function isNodeEdited(
  nodeId: string,
  data: Readonly<Record<string, unknown>>,
  submitted: Graph | null,
): boolean {
  const before: Readonly<Record<string, unknown>> | undefined = submitted?.nodes.find(
    (node) => node.id === nodeId,
  )?.data;
  if (!before) return false;
  const keys = Object.keys(data);
  return keys.length !== Object.keys(before).length || keys.some((key) => !Object.is(data[key], before[key]));
}
