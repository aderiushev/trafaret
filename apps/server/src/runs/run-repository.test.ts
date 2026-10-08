import { describe, expect, it } from 'vitest';
import { emptyRunSummary, type Run } from '@trafaret/core';
import type { RunExecution } from '../engine/run-execution.ts';
import { RunRepository } from './run-repository.ts';

const run = (id: string, finishedAt: number | null = null): Run => ({
  id,
  status: finishedAt === null ? 'running' : 'completed',
  version: 1,
  createdAt: 0,
  startedAt: 0,
  finishedAt,
  jobs: {},
  summary: emptyRunSummary(),
});
const record = (value: Run) => ({ run: value, execution: {} as RunExecution });

describe('RunRepository', () => {
  it('hands out deep copies', () => {
    const repository = new RunRepository({ maxRuns: 10, retentionMs: 1_000 });
    repository.add(record(run('a')));
    const snapshot = repository.snapshot('a')!;
    snapshot.status = 'failed';
    expect(repository.snapshot('a')?.status).toBe('running');
  });

  it('keeps only the newest runs', () => {
    const repository = new RunRepository({ maxRuns: 2, retentionMs: 1_000 });
    for (const id of ['a', 'b', 'c']) repository.add(record(run(id)));
    expect(repository.get('a')).toBeUndefined();
    expect(repository.get('b')).toBeDefined();
    expect(repository.get('c')).toBeDefined();
  });

  it('drops runs that finished before the retention window', () => {
    const now = 10_000;
    const repository = new RunRepository({ maxRuns: 10, retentionMs: 1_000, now: () => now });
    repository.add(record(run('old', 5_000)));
    repository.add(record(run('recent', 9_500)));
    expect(repository.get('old')).toBeUndefined();
    expect(repository.get('recent')).toBeDefined();
  });
});
