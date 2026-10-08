import { ancestorsOf, descendantsOf, isAiNodeType, NODE_DEFINITIONS } from '@trafaret/core';
import type {
  GraphIndex,
  Job,
  JobError,
  JobModel,
  NodeOutput,
  RequestPreview,
  Run,
  RunSummary,
} from '@trafaret/core';
import { toJobError } from './errors.ts';
import type { CacheEntry, ResultCache } from './result-cache.ts';

export type NodeInputs = { prompt?: NodeOutput; image?: NodeOutput };
export type ExecutedNode = { output: NodeOutput; request?: RequestPreview; model?: JobModel };
/** What the inspector shows for a job that has been sent to a provider: the request and the model handling it. */
export type RunningDetails = { request: RequestPreview; model: JobModel };
export type NodeExecutionContext = {
  nodeId: string;
  inputs: NodeInputs;
  attempt: number;
  /** Marks the job running. AI nodes pass `details` so the request is visible while it runs and after it fails. */
  markRunning: (details?: RunningDetails) => void;
};
export type NodeExecutor = (context: NodeExecutionContext) => Promise<ExecutedNode>;

export type RunExecutionOptions = {
  index: GraphIndex;
  order: readonly string[];
  cacheKeys: ReadonlyMap<string, string>;
  cache: ResultCache;
  executeNode: NodeExecutor;
  now: () => number;
  onJobFailed: (nodeId: string, error: unknown) => void;
};

/** Rejection that tells dependents which node actually failed. */
class UpstreamFailure extends Error {
  readonly rootNodeId: string;

  constructor(rootNodeId: string) {
    super(`Node ${rootNodeId} failed`);
    this.name = 'UpstreamFailure';
    this.rootNodeId = rootNodeId;
  }
}

/**
 * Executes one run. Each node is a memoised promise that awaits only its own inputs, so independent branches run
 * concurrently and a node starts the moment its dependencies succeed — not level by level.
 */
export class RunExecution {
  readonly run: Run;
  private readonly options: RunExecutionOptions;
  private readonly promises = new Map<string, Promise<NodeOutput>>();
  private readonly hits = new Map<string, CacheEntry>();
  /** Nodes whose result is a budget-fallback result or was built on one (see `isFallbackDerived`). */
  private readonly tainted = new Set<string>();

  constructor(run: Run, options: RunExecutionOptions) {
    this.run = run;
    this.options = options;
  }

  /** Marks cache hits as done, queues the rest and settles every node, until nothing is left to run. */
  async start(): Promise<void> {
    const startedAt = this.options.now();
    this.run.startedAt = startedAt;
    for (const nodeId of this.options.order) {
      const job = this.job(nodeId);
      const key = this.options.cacheKeys.get(nodeId);
      const hit = key !== undefined && isAiNodeType(job.nodeType) ? this.options.cache.get(key) : undefined;
      if (!hit) {
        job.status = 'queued';
        continue;
      }
      this.hits.set(nodeId, hit);
      job.status = 'success';
      job.cached = true;
      job.startedAt = startedAt;
      job.finishedAt = startedAt;
      job.output = hit.output;
      job.request = hit.request;
      job.model = hit.model;
    }
    this.changed();
    await Promise.allSettled(this.options.order.map((nodeId) => this.settle(nodeId)));
  }

  /** Re-runs a failed node together with the failed ancestors it depends on and the dependents it blocked. */
  retry(nodeId: string): 'ok' | 'not-failed' {
    if (this.run.jobs[nodeId]?.status !== 'error') return 'not-failed';
    const reset = this.resetSet(nodeId);
    for (const id of reset) {
      const job = this.job(id);
      if (job.error?.code !== 'UPSTREAM_FAILED') job.attempt += 1;
      job.status = 'queued';
      job.startedAt = null;
      job.finishedAt = null;
      delete job.error;
      delete job.output;
      delete job.request;
      delete job.model;
      this.promises.delete(id);
    }
    this.changed();
    for (const id of reset) void this.settle(id);
    return 'ok';
  }

  private resetSet(nodeId: string): Set<string> {
    const failed = (id: string): boolean => this.run.jobs[id]?.status === 'error';
    const reset = new Set([nodeId]);
    for (const id of ancestorsOf(this.options.index, nodeId)) if (failed(id)) reset.add(id);
    for (const id of [...reset]) {
      for (const dependent of descendantsOf(this.options.index, id))
        if (failed(dependent)) reset.add(dependent);
    }
    return reset;
  }

  private settle(nodeId: string): Promise<NodeOutput> {
    const existing = this.promises.get(nodeId);
    if (existing) return existing;
    const promise = this.execute(nodeId);
    promise.catch(() => undefined); // failures are recorded on the job itself
    this.promises.set(nodeId, promise);
    return promise;
  }

  private async execute(nodeId: string): Promise<NodeOutput> {
    const hit = this.hits.get(nodeId);
    if (hit) return hit.output; // known at planning time: no need to wait for inputs
    const job = this.job(nodeId);
    let inputs: NodeInputs;
    try {
      inputs = await this.collectInputs(nodeId);
    } catch (error) {
      const rootNodeId = error instanceof UpstreamFailure ? error.rootNodeId : nodeId;
      this.fail(job, {
        code: 'UPSTREAM_FAILED',
        message: `Skipped: ${this.label(rootNodeId)} failed.`,
        // Retrying a skipped node cannot help unless its root failure can be retried.
        retryable: this.run.jobs[rootNodeId]?.error?.retryable ?? true,
        upstreamNodeId: rootNodeId,
      });
      throw new UpstreamFailure(rootNodeId);
    }
    try {
      const executed = await this.options.executeNode({
        nodeId,
        inputs,
        attempt: job.attempt,
        markRunning: (details) => this.markRunning(job, details),
      });
      this.succeed(job, executed);
      if (this.isFallbackDerived(nodeId, executed)) this.tainted.add(nodeId);
      else this.remember(nodeId, job, executed);
      return executed.output;
    } catch (error) {
      // Record the failure first: a logger that throws must not leave the job running.
      this.fail(job, toJobError(error));
      this.options.onJobFailed(nodeId, error);
      throw new UpstreamFailure(nodeId);
    }
  }

  private async collectInputs(nodeId: string): Promise<NodeInputs> {
    const edges = this.options.index.incoming.get(nodeId) ?? [];
    const outputs = await Promise.all(edges.map((edge) => this.settle(edge.source)));
    const inputs: NodeInputs = {};
    edges.forEach((edge, position) => {
      inputs[edge.targetHandle] = outputs[position];
    });
    return inputs;
  }

  private markRunning(job: Job, details?: RunningDetails): void {
    job.status = 'running';
    job.startedAt = this.options.now();
    if (details) {
      job.request = details.request;
      job.model = details.model;
    }
    this.changed();
  }

  private succeed(job: Job, executed: ExecutedNode): void {
    const now = this.options.now();
    job.status = 'success';
    job.startedAt ??= now;
    job.finishedAt = now;
    job.output = executed.output;
    if (executed.request) job.request = executed.request;
    if (executed.model) job.model = executed.model;
    this.changed();
  }

  /**
   * True for a budget-fallback result and for everything built on one, however many nodes away. Cache keys
   * are input-addressed and assume the upstream outputs are the real ones, so such a result is never stored.
   * Nodes reused at planning time are never tainted: their entries were stored from real inputs.
   */
  private isFallbackDerived(nodeId: string, executed: ExecutedNode): boolean {
    if (executed.model?.fallbackFrom !== undefined) return true;
    return (this.options.index.incoming.get(nodeId) ?? []).some((edge) => this.tainted.has(edge.source));
  }

  /** Stores a successful AI result under the node's cache key. */
  private remember(nodeId: string, job: Job, executed: ExecutedNode): void {
    const key = this.options.cacheKeys.get(nodeId);
    const { output, request, model } = executed;
    if (key === undefined || output.kind !== 'image' || !request || !model) return;
    this.options.cache.set(key, {
      output,
      request,
      model,
      durationMs: (job.finishedAt ?? 0) - (job.startedAt ?? 0),
    });
  }

  private fail(job: Job, error: JobError): void {
    job.status = 'error';
    job.finishedAt = this.options.now();
    job.error = error;
    this.changed();
  }

  private job(nodeId: string): Job {
    const job = this.run.jobs[nodeId];
    if (!job) throw new Error(`Run ${this.run.id} has no job for node ${nodeId}`);
    return job;
  }

  private label(nodeId: string): string {
    const node = this.options.index.nodes.get(nodeId);
    return node ? NODE_DEFINITIONS[node.type].label : nodeId;
  }

  /** Derives the run status and summary from the jobs and bumps the version on every change. */
  private changed(): void {
    const jobs = Object.values(this.run.jobs);
    const active = jobs.some(
      (job) => job.status === 'idle' || job.status === 'queued' || job.status === 'running',
    );
    const failed = jobs.some((job) => job.status === 'error');
    this.run.status =
      this.run.startedAt === null ? 'queued' : active ? 'running' : failed ? 'failed' : 'completed';
    const terminal = this.run.status === 'completed' || this.run.status === 'failed';
    this.run.finishedAt = terminal ? (this.run.finishedAt ?? this.options.now()) : null;
    const savedMs = [...this.hits.values()].reduce((sum, hit) => sum + hit.durationMs, 0);
    this.run.summary = summarize(jobs, savedMs);
    this.run.version += 1;
  }
}

export function summarize(jobs: readonly Job[], savedMs = 0): RunSummary {
  const ai = jobs.filter((job) => isAiNodeType(job.nodeType));
  const succeeded = ai.filter((job) => job.status === 'success' && !job.cached);
  return {
    aiNodes: ai.length,
    generated: succeeded.filter((job) => job.model?.fallbackFrom === undefined).length,
    reused: ai.filter((job) => job.cached).length,
    failed: jobs.filter((job) => job.status === 'error' && job.error?.code !== 'UPSTREAM_FAILED').length,
    savedMs,
    fallbacks: succeeded.filter((job) => job.model?.fallbackFrom !== undefined).length,
  };
}
