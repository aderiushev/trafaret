import { ApiError } from '@/shared/api';

/**
 * Polling rides out a short outage: four retries take about 15 s with the default backoff (1 + 2 + 4 + 8 s), and
 * the run stays busy meanwhile, so Run can't start it again. A 404 is final: the run is gone, say after a restart.
 */
export const shouldRetryRunPoll = (failureCount: number, error: Error): boolean =>
  failureCount < 4 && !(error instanceof ApiError && error.status === 404);
