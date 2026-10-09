import type { AiNodeType, Job } from '@trafaret/core';
import { retryTarget } from '@/entities/run';
import { RegenerateButton } from '@/features/regenerate-node';
import { RetryButton } from '@/features/retry-node';
import { useRunWorkflow } from '@/features/run-workflow';
import { cx } from '@/shared/lib';
import { Badge } from '@/shared/ui';
import styles from './nodes.module.css';

/** Where an image came from: reused from the cache, made by Mock, or by Mock because the daily limit was hit. */
export function JobBadges({ job }: { job: Job | undefined }) {
  if (!job) return null;
  const fallbackFrom = job.model?.fallbackFrom;
  return (
    <>
      {job.cached && (
        <Badge tone="accent" title="Nothing it depends on changed, so the earlier image was reused.">
          ⚡ reused
        </Badge>
      )}
      {fallbackFrom ? (
        <Badge
          tone="warning"
          title={`The daily limit for ${fallbackFrom} was reached, so Mock made this image.`}
        >
          Mock · daily limit
        </Badge>
      ) : (
        job.model?.provider === 'mock' && <Badge>Mock</Badge>
      )}
    </>
  );
}

/** A thumbnail of the image a Generate or Edit node made in the active run; the Result node shows it large. */
export function OutputPreview({ job }: { job: Job | undefined }) {
  if (job?.output?.kind !== 'image') return null;
  return (
    <figure className={styles.output}>
      <img src={job.output.url} alt="Generated image" width={72} height={72} className={styles.thumbnail} />
      <figcaption className={styles.badges}>
        <JobBadges job={job} />
      </figcaption>
    </figure>
  );
}

/** A failed job's message, with Retry when it can help — for a skipped node, Retry goes to the cause. */
export function JobError({ job, runId }: { job: Job | undefined; runId: string | null }) {
  if (job?.status !== 'error' || !job.error) return null;
  const target = retryTarget(job);
  return (
    <div role="alert" className={cx(styles.error, 'nodrag')}>
      <p className={styles.errorMessage}>{job.error.message}</p>
      {target !== null && runId !== null && <RetryButton runId={runId} nodeId={target} />}
    </div>
  );
}

/** The seed, and 🎲: a new seed followed by a run, so only this node and what depends on it re-render. */
export function SeedField({ nodeId, type, seed }: { nodeId: string; type: AiNodeType; seed: number }) {
  const { run, busy } = useRunWorkflow();
  return (
    <div className={styles.seed}>
      <span className={styles.seedLabel}>Seed</span>
      <div className={styles.seedControl}>
        <span className={styles.seedValue}>{seed}</span>
        <RegenerateButton nodeId={nodeId} type={type} disabled={busy} onRegenerated={run} />
      </div>
    </div>
  );
}
