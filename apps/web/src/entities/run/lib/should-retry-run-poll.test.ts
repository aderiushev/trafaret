import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { shouldRetryRunPoll } from './should-retry-run-poll';

const unreachable = new ApiError(0, 'NETWORK', "Can't reach the server.");
const unavailable = new ApiError(503, 'HTTP_ERROR', 'The server is unavailable.');
const gone = new ApiError(404, 'RUN_NOT_FOUND', 'This run no longer exists.');

describe('shouldRetryRunPoll', () => {
  it.each([
    ['an unreachable server', unreachable],
    ['a server error', unavailable],
  ])('rides out %s: four retries, then it gives up', (_, error) => {
    const verdicts = [0, 1, 2, 3, 4].map((failureCount) => shouldRetryRunPoll(failureCount, error));
    expect(verdicts).toEqual([true, true, true, true, false]);
  });

  it('never retries a run the server no longer has', () => {
    expect(shouldRetryRunPoll(0, gone)).toBe(false);
  });
});
