import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createRunBodySchema,
  retryParamsSchema,
  runIdResponseSchema,
  runParamsSchema,
  runSchema,
} from '@trafaret/core';
import type { Engine } from '../engine/engine.ts';
import { AppError } from '../http/errors.ts';
import { validateRunGraph, type RunGraphContext } from './validate-run-graph.ts';

export type RunRoutesOptions = RunGraphContext & { engine: Engine; runsPer10Minutes: number };

const runNotFound = (): AppError =>
  new AppError(
    404,
    'RUN_NOT_FOUND',
    'This run no longer exists. Runs are kept for an hour after they finish.',
  );

export function registerRunRoutes(app: FastifyInstance, options: RunRoutesOptions): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  // One limiter instance on both routes, so a client's run creations and retries draw on the same allowance.
  // (A shared `groupId` in each route's config would not: every route would keep its own counter.)
  const rateLimit = app.rateLimit({ max: options.runsPer10Minutes, timeWindow: '10 minutes' });

  routes.post(
    '/api/runs',
    {
      onRequest: rateLimit,
      schema: {
        summary: 'Start a workflow run',
        body: createRunBodySchema,
        response: { 202: runIdResponseSchema },
      },
    },
    async (request, reply) => {
      const issues = validateRunGraph(request.body.graph, options);
      if (issues.length > 0) {
        const message =
          issues.length === 1
            ? (issues[0]?.message ?? '')
            : `Fix ${issues.length} issues to run this workflow.`;
        throw new AppError(400, 'INVALID_GRAPH', message, issues);
      }
      return reply.code(202).send({ runId: options.engine.startRun(request.body.graph) });
    },
  );

  routes.get(
    '/api/runs/:runId',
    { schema: { summary: 'Poll a run', params: runParamsSchema, response: { 200: runSchema } } },
    (request) => {
      const run = options.engine.getRun(request.params.runId);
      if (!run) throw runNotFound();
      return run;
    },
  );

  routes.post(
    '/api/runs/:runId/nodes/:nodeId/retry',
    {
      onRequest: rateLimit,
      schema: {
        summary: 'Retry a failed node',
        params: retryParamsSchema,
        response: { 202: runIdResponseSchema },
      },
    },
    async (request, reply) => {
      const outcome = options.engine.retryNode(request.params.runId, request.params.nodeId);
      if (outcome === 'run-not-found') throw runNotFound();
      if (outcome === 'node-not-failed')
        throw new AppError(409, 'NODE_NOT_FAILED', 'Only failed nodes can be retried.');
      return reply.code(202).send({ runId: request.params.runId });
    },
  );
}
