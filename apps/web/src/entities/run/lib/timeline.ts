import type { Job, JobStatus, Run } from '@trafaret/core';

export type TimelineBar = {
  nodeId: string;
  status: JobStatus;
  cached: boolean;
  /** Where the bar starts and ends, as fractions (0–1) of the timeline. Null for a job that hasn't started. */
  start: number | null;
  end: number | null;
};

export type TimelineLayout = { spanMs: number; bars: TimelineBar[] };

/** The shortest timeline, so a run that finished almost at once still draws readable bars. */
const MIN_SPAN_MS = 1000;

/** Lays out one bar per node, in the given order, relative to the start of the run. Pure, so it is tested. */
export function layoutTimeline(run: Run, nodeIds: readonly string[], now: number): TimelineLayout {
  const origin = run.startedAt ?? run.createdAt;
  const jobs = nodeIds.flatMap((id) => run.jobs[id] ?? []);
  // A running job reaches up to now; a finished or failed one ends when it did.
  const endOf = (job: Job): number | null =>
    job.finishedAt ??
    (job.status === 'running' && job.startedAt !== null ? Math.max(now, job.startedAt) : null);
  const runEnd = run.finishedAt ?? (run.status === 'running' ? now : origin);
  const latest = Math.max(runEnd, ...jobs.map((job) => endOf(job) ?? origin));
  const spanMs = Math.max(latest - origin, MIN_SPAN_MS);
  const fraction = (time: number): number => Math.min(1, Math.max(0, (time - origin) / spanMs));
  return {
    spanMs,
    bars: jobs.map((job) => {
      const end = endOf(job);
      // A job skipped before it could start is a zero-width mark at the moment it failed.
      const start = job.startedAt ?? end;
      return {
        nodeId: job.nodeId,
        status: job.status,
        cached: job.cached,
        start: start === null ? null : fraction(start),
        end: end === null ? null : fraction(end),
      };
    }),
  };
}
