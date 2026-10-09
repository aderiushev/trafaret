import type { ImageModel, Job } from '@trafaret/core';
import { jobDurationMs, JobStatusBadge, retryTarget } from '@/entities/run';
import { RetryButton } from '@/features/retry-node';
import { formatDuration } from '@/shared/lib';
import styles from './NodeInspector.module.css';

type JobDetailsProps = { job: Job; runId: string | null; models: readonly ImageModel[]; now: number };

export function JobDetails({ job, runId, models, now }: JobDetailsProps) {
  const duration = jobDurationMs(job, now);
  const modelName = (id: string): string => models.find((model) => model.id === id)?.label ?? id;
  const target = retryTarget(job);
  return (
    <>
      <dl className={styles.facts}>
        <dt>Status</dt>
        <dd>
          <JobStatusBadge status={job.status} />
        </dd>
        <dt>Attempt</dt>
        <dd>{job.attempt}</dd>
        <dt>Duration</dt>
        <dd>
          {job.cached ? 'Reused from an earlier run' : duration === null ? '—' : formatDuration(duration)}
        </dd>
        {job.model && (
          <>
            <dt>Model</dt>
            <dd>{modelName(job.model.id)}</dd>
          </>
        )}
      </dl>
      {job.model?.fallbackFrom && (
        <p className={styles.note}>
          The daily limit for {modelName(job.model.fallbackFrom)} was reached, so Mock made this image.
        </p>
      )}
      {job.error && (
        <section aria-label="Error" className={styles.section}>
          <h4 className={styles.sectionTitle}>Error</h4>
          <p className={styles.errorText}>{job.error.message}</p>
          <p className={styles.note}>
            {job.error.code} · {job.error.retryable ? 'a retry may help' : 'a retry will not help'}
          </p>
          {target !== null && runId !== null && <RetryButton runId={runId} nodeId={target} />}
        </section>
      )}
    </>
  );
}
