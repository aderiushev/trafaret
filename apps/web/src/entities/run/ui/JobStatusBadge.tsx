import type { ComponentProps } from 'react';
import type { JobStatus } from '@trafaret/core';
import { formatSeconds } from '@/shared/lib';
import { Badge, Spinner } from '@/shared/ui';
import { JOB_STATUS_LABEL } from '../lib/job-status';

const TONE: Readonly<Record<JobStatus, ComponentProps<typeof Badge>['tone']>> = {
  idle: 'neutral',
  queued: 'neutral',
  running: 'accent',
  success: 'success',
  error: 'error',
};

export function JobStatusBadge({
  status,
  elapsedMs = null,
}: {
  status: JobStatus;
  elapsedMs?: number | null;
}) {
  return (
    <Badge tone={TONE[status]}>
      {status === 'running' && <Spinner size="sm" />}
      {status === 'success' && '✓ '}
      {JOB_STATUS_LABEL[status]}
      {status === 'running' && elapsedMs !== null && ` · ${formatSeconds(elapsedMs)}`}
    </Badge>
  );
}
