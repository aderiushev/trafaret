import { expect, vi } from 'vitest';
import type { Run, RunStatus } from '@trafaret/core';

/**
 * Rendering real Mock images costs real CPU time: on a loaded machine (CI, parallel test runs) a run can take far
 * longer than vi.waitFor's 1 s default, so waits on such runs get this long.
 */
export const RENDER_WAIT_MS = 10_000;

/** The test timeout for suites that wait on real Mock renders: room for several waits of RENDER_WAIT_MS. */
export const RENDER_TEST_TIMEOUT_MS = 30_000;

/** Waits until the run has `status`, allowing for real Mock renders, and returns it. */
export function waitForRun(
  runs: { getRun(runId: string): Run | undefined },
  runId: string,
  status: RunStatus,
): Promise<Run> {
  return vi.waitFor(
    () => {
      const run = runs.getRun(runId);
      expect(run?.status).toBe(status);
      return run!;
    },
    { timeout: RENDER_WAIT_MS },
  );
}
