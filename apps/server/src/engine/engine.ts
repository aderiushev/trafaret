import { nanoid } from 'nanoid';
import { emptyRunSummary, indexGraph, topologicalOrder } from '@trafaret/core';
import type { Graph, Job, NodeType, Run } from '@trafaret/core';
import type { Logger } from 'pino';
import type { RunRepository } from '../runs/run-repository.ts';
import { computeCacheKeys } from './cache-key.ts';
import { createNodeExecutor, type NodeExecutorDeps } from './node-executors.ts';
import type { ResultCache } from './result-cache.ts';
import { RunExecution, summarize } from './run-execution.ts';

export type EngineDeps = NodeExecutorDeps & {
  runs: RunRepository;
  cache: ResultCache;
  logger: Pick<Logger, 'warn'>;
  now?: () => number;
};

const newJob = (nodeId: string, nodeType: NodeType): Job => ({
  nodeId,
  nodeType,
  status: 'idle',
  attempt: 1,
  startedAt: null,
  finishedAt: null,
  cached: false,
});

export class Engine {
  private readonly deps: EngineDeps;
  private readonly now: () => number;

  constructor(deps: EngineDeps) {
    this.deps = deps;
    this.now = deps.now ?? Date.now;
  }

  /** Starts a validated graph in the background and returns the new run's id. */
  startRun(graph: Graph): string {
    const index = indexGraph(graph);
    const order = topologicalOrder(index);
    if (!order) throw new Error('startRun needs a validated, acyclic graph');

    const run: Run = {
      id: `run_${nanoid(12)}`,
      status: 'queued',
      version: 0,
      createdAt: this.now(),
      startedAt: null,
      finishedAt: null,
      jobs: {},
      summary: emptyRunSummary(),
    };
    for (const nodeId of order) {
      const node = index.nodes.get(nodeId);
      if (node) run.jobs[nodeId] = newJob(nodeId, node.type);
    }
    run.summary = summarize(Object.values(run.jobs));

    const execution = new RunExecution(run, {
      index,
      order,
      cacheKeys: computeCacheKeys(index, order, (presetId) => this.deps.presets.get(presetId)?.contentHash),
      cache: this.deps.cache,
      now: this.now,
      executeNode: createNodeExecutor(index, this.deps),
      onJobFailed: (nodeId, error) =>
        this.deps.logger.warn({ runId: run.id, nodeId, err: error }, 'job failed'),
    });
    this.deps.runs.add({ run, execution });
    setImmediate(() => {
      // start() settles every node itself and is not expected to reject; if it ever does, log it, never crash on it.
      void execution.start().catch((error: unknown) => {
        this.deps.logger.warn({ runId: run.id, err: error }, 'run crashed');
      });
    });
    return run.id;
  }

  getRun(runId: string): Run | undefined {
    return this.deps.runs.snapshot(runId);
  }

  retryNode(runId: string, nodeId: string): 'ok' | 'run-not-found' | 'node-not-failed' {
    const record = this.deps.runs.get(runId);
    if (!record) return 'run-not-found';
    return record.execution.retry(nodeId) === 'ok' ? 'ok' : 'node-not-failed';
  }
}
