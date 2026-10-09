import { describe, expect, it } from 'vitest';
import { job, runSnapshot } from '@trafaret/core/testing';
import { keepNewerRun } from './keep-newer-run';

describe('keepNewerRun', () => {
  it('keeps the newer snapshot when an older one arrives late', () => {
    const newer = runSnapshot([job('a')], { version: 5 });
    const older = runSnapshot([job('a', { status: 'running', finishedAt: null })], { version: 3 });
    expect(keepNewerRun(newer, older)).toBe(newer);
  });

  it('takes a newer snapshot but keeps the jobs that did not change', () => {
    const running = job('b', { status: 'running', finishedAt: null });
    const before = runSnapshot([job('a'), running], { status: 'running', version: 2 });
    const after = runSnapshot([job('a'), job('b')], { version: 3 });
    const kept = keepNewerRun(before, after);
    expect(kept.version).toBe(3);
    expect(kept.jobs.a).toBe(before.jobs.a);
    expect(kept.jobs.b).toEqual(after.jobs.b);
  });

  it('switches to another run whatever its version', () => {
    const first = runSnapshot([], { id: 'run_1', version: 9 });
    const second = runSnapshot([], { id: 'run_2', version: 1 });
    expect(keepNewerRun(first, second)).toEqual(second);
  });
});
