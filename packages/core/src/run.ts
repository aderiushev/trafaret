import { z } from 'zod';
import { ASPECT_RATIOS, NODE_TYPES } from './nodes.ts';

export const RUN_STATUSES = ['queued', 'running', 'completed', 'failed'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const JOB_STATUSES = ['idle', 'queued', 'running', 'success', 'error'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_ERROR_CODES = [
  'PROVIDER_ERROR',
  'TIMEOUT',
  'UPSTREAM_FAILED',
  'INVALID_INPUT',
  'INTERNAL',
] as const;
export type JobErrorCode = (typeof JOB_ERROR_CODES)[number];

export const isTerminalRunStatus = (status: RunStatus): boolean =>
  status === 'completed' || status === 'failed';

export const textOutputSchema = z.object({ kind: z.literal('text'), text: z.string() });
export const imageOutputSchema = z.object({
  kind: z.literal('image'),
  assetId: z.string(),
  url: z.string(),
  width: z.number().int(),
  height: z.number().int(),
});
export const nodeOutputSchema = z.discriminatedUnion('kind', [textOutputSchema, imageOutputSchema]);

export const requestPreviewSchema = z.object({
  modelId: z.string(),
  prompt: z.string(),
  negativePrompt: z.string().nullable(),
  negativeMode: z.enum(['native', 'folded', 'none']),
  references: z.array(z.object({ assetId: z.string(), url: z.string(), role: z.enum(['source', 'preset']) })),
  aspectRatio: z.enum(ASPECT_RATIOS).nullable(),
  seed: z.number().int().nullable(),
  warnings: z.array(z.string()),
});

export const jobErrorSchema = z.object({
  code: z.enum(JOB_ERROR_CODES),
  message: z.string(),
  retryable: z.boolean(),
  upstreamNodeId: z.string().optional(),
});

export const jobModelSchema = z.object({
  id: z.string(),
  provider: z.string(),
  fallbackFrom: z.string().optional(),
});

export const jobSchema = z.object({
  nodeId: z.string(),
  nodeType: z.enum(NODE_TYPES),
  status: z.enum(JOB_STATUSES),
  attempt: z.number().int().min(1),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  cached: z.boolean(),
  output: nodeOutputSchema.optional(),
  error: jobErrorSchema.optional(),
  request: requestPreviewSchema.optional(),
  model: jobModelSchema.optional(),
});

export const runSummarySchema = z.object({
  aiNodes: z.number().int(),
  generated: z.number().int(),
  reused: z.number().int(),
  failed: z.number().int(),
  savedMs: z.number(),
  fallbacks: z.number().int(),
});

export const runSchema = z.object({
  id: z.string(),
  status: z.enum(RUN_STATUSES),
  version: z.number().int(),
  createdAt: z.number(),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  jobs: z.record(z.string(), jobSchema),
  summary: runSummarySchema,
});

export type TextOutput = z.infer<typeof textOutputSchema>;
export type ImageOutput = z.infer<typeof imageOutputSchema>;
export type NodeOutput = z.infer<typeof nodeOutputSchema>;
export type RequestPreview = z.infer<typeof requestPreviewSchema>;
export type JobError = z.infer<typeof jobErrorSchema>;
export type JobModel = z.infer<typeof jobModelSchema>;
export type Job = z.infer<typeof jobSchema>;
export type RunSummary = z.infer<typeof runSummarySchema>;
export type Run = z.infer<typeof runSchema>;

export const emptyRunSummary = (): RunSummary => ({
  aiNodes: 0,
  generated: 0,
  reused: 0,
  failed: 0,
  savedMs: 0,
  fallbacks: 0,
});
