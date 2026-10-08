import type { Run } from '@trafaret/core';
import type { RunExecution } from '../engine/run-execution.ts';

export type RunRecord = { readonly run: Run; readonly execution: RunExecution };

/** In-memory run store: keeps the newest `maxRuns` and drops runs that finished more than `retentionMs` ago. */
export class RunRepository {
  private readonly records = new Map<string, RunRecord>();
  private readonly maxRuns: number;
  private readonly retentionMs: number;
  private readonly now: () => number;

  constructor(options: { maxRuns: number; retentionMs: number; now?: () => number }) {
    this.maxRuns = options.maxRuns;
    this.retentionMs = options.retentionMs;
    this.now = options.now ?? Date.now;
  }

  add(record: RunRecord): void {
    this.records.set(record.run.id, record);
    this.evict();
  }

  get(runId: string): RunRecord | undefined {
    return this.records.get(runId);
  }

  /** A deep copy that is safe to serialise while the run keeps changing. */
  snapshot(runId: string): Run | undefined {
    const record = this.records.get(runId);
    return record ? structuredClone(record.run) : undefined;
  }

  private evict(): void {
    const cutoff = this.now() - this.retentionMs;
    for (const [id, { run }] of this.records) {
      if (run.finishedAt !== null && run.finishedAt < cutoff) this.records.delete(id);
    }
    for (const id of this.records.keys()) {
      if (this.records.size <= this.maxRuns) break;
      this.records.delete(id);
    }
  }
}
