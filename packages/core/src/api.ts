import { z } from 'zod';
import { imageModelSchema } from './catalog.ts';
import { graphSchema } from './graph.ts';
import { presetSchema } from './preset.ts';
import { issueSchema } from './validate.ts';

export const createRunBodySchema = z.object({ graph: graphSchema });
export const runIdResponseSchema = z.object({ runId: z.string() });

export const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), issues: z.array(issueSchema).optional() }),
});

export const assetSchema = z.object({
  assetId: z.string(),
  url: z.string(),
  width: z.number().int(),
  height: z.number().int(),
});
export const sampleSchema = assetSchema.extend({ id: z.string(), name: z.string() });

export const catalogResponseSchema = z.object({ models: z.array(imageModelSchema) });
export const presetsResponseSchema = z.object({ presets: z.array(presetSchema) });
export const samplesResponseSchema = z.object({ samples: z.array(sampleSchema) });

export const runParamsSchema = z.object({ runId: z.string().min(1) });
export const retryParamsSchema = z.object({ runId: z.string().min(1), nodeId: z.string().min(1) });
export const assetParamsSchema = z.object({ assetId: z.string().regex(/^[a-f0-9]{64}$/) });

export type CreateRunBody = z.infer<typeof createRunBodySchema>;
export type RunIdResponse = z.infer<typeof runIdResponseSchema>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Sample = z.infer<typeof sampleSchema>;
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
export type PresetsResponse = z.infer<typeof presetsResponseSchema>;
export type SamplesResponse = z.infer<typeof samplesResponseSchema>;

export const assetUrl = (assetId: string): string => `/api/assets/${assetId}`;

/** What POST /api/assets accepts. The editor checks the same limits before it uploads. */
export const UPLOAD_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxSide: 4096,
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
} as const;
