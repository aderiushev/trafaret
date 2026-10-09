import { useState } from 'react';
import { isTerminalRunStatus, type Job, type RunStatus } from '@trafaret/core';
import { useCatalog } from '@/entities/catalog';
import { usePresets } from '@/entities/preset';
import {
  formatRunSummary,
  jobDurationMs,
  JOB_STATUS_LABEL,
  layoutTimeline,
  retryTarget,
  useActiveRunQuery,
  useRunSession,
  type TimelineBar,
} from '@/entities/run';
import { RetryButton } from '@/features/retry-node';
import { cx, formatDuration, useNow } from '@/shared/lib';
import { Badge } from '@/shared/ui';
import { timelineRows } from '../lib/timeline-rows';
import styles from './RunTimeline.module.css';

const RUN_STATUS: Readonly<
  Record<RunStatus, { label: string; tone: 'neutral' | 'accent' | 'success' | 'error' }>
> = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'accent' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'error' },
};

const percent = (fraction: number): string => `${(fraction * 100).toFixed(2)}%`;

const HOW_TO_RECOVER = 'Run the workflow again — finished nodes are reused.';

/** When each AI call of the active run started and ended: parallel branches overlap, reused nodes take no time. */
export function RunTimeline() {
  const { data: run, error } = useActiveRunQuery();
  const submitted = useRunSession((state) => state.submittedGraph);
  const runId = useRunSession((state) => state.activeRunId);
  const presets = usePresets().data ?? [];
  const models = useCatalog().data ?? [];
  const [open, setOpen] = useState(true);
  // Once polling has given up, the last snapshot stays as it is: its running bars stop growing.
  const now = useNow(run !== undefined && !isTerminalRunStatus(run.status) && !error, 200);

  if (!run || !submitted) {
    const message = error
      ? `Couldn't load the last run: ${error.message} ${HOW_TO_RECOVER}`
      : 'Run the workflow to see when each AI call starts and ends.';
    return (
      <section aria-label="Run timeline" className={styles.timeline}>
        <p className={styles.empty} role={error ? 'alert' : undefined}>
          {message}
        </p>
      </section>
    );
  }

  const rows = timelineRows(submitted, presets, models);
  const { bars } = layoutTimeline(
    run,
    rows.map((row) => row.nodeId),
    now,
  );
  const labels = new Map(rows.map((row) => [row.nodeId, row.label]));
  return (
    <section aria-label="Run timeline" className={styles.timeline}>
      <header className={styles.header}>
        <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
          Timeline <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
        <span className={styles.summary}>{formatRunSummary(run, now)}</span>
        <Badge tone={RUN_STATUS[run.status].tone}>{RUN_STATUS[run.status].label}</Badge>
      </header>
      {error && (
        <p className={styles.lostContact} role="alert">
          Lost contact with the server: {error.message} {HOW_TO_RECOVER}
        </p>
      )}
      {open && (
        <ol className={styles.rows}>
          {bars.map((bar) => {
            const job = run.jobs[bar.nodeId];
            return job ? (
              <TimelineRow
                key={bar.nodeId}
                label={labels.get(bar.nodeId) ?? bar.nodeId}
                bar={bar}
                job={job}
                runId={runId}
                now={now}
              />
            ) : null;
          })}
        </ol>
      )}
    </section>
  );
}

type TimelineRowProps = { label: string; bar: TimelineBar; job: Job; runId: string | null; now: number };

function TimelineRow({ label, bar, job, runId, now }: TimelineRowProps) {
  const duration = jobDurationMs(job, now);
  const target = retryTarget(job);
  return (
    <li className={styles.row}>
      <span className={styles.label} title={label}>
        {label}
      </span>
      <span className={styles.track}>
        {bar.start !== null && bar.end !== null && (
          <span
            data-bar
            className={cx(styles.bar, styles[bar.status], bar.cached && styles.cached)}
            style={{ left: percent(bar.start), width: percent(bar.end - bar.start) }}
          />
        )}
      </span>
      <span className={styles.value}>
        {bar.cached
          ? '⚡ reused'
          : duration === null || bar.status === 'error'
            ? JOB_STATUS_LABEL[bar.status]
            : formatDuration(duration)}
      </span>
      <span className={styles.action}>
        {target !== null && runId !== null && <RetryButton runId={runId} nodeId={target} />}
      </span>
    </li>
  );
}
