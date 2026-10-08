import { z } from 'zod';
import { ASPECT_RATIOS } from './nodes.ts';

export const PROVIDER_IDS = ['cloudflare', 'byteplus', 'mock'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const imageModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.enum(PROVIDER_IDS),
  default: z.boolean(),
  enabled: z.boolean(),
  unavailableReason: z.string().nullable(),
  supportsEdit: z.boolean(),
  supportsNegativePrompt: z.boolean(),
  supportsSeed: z.boolean(),
  maxReferenceImages: z.number().int().min(0),
  aspectRatios: z.array(z.enum(ASPECT_RATIOS)),
  costPerImageUsd: z.number().min(0),
});
export type ImageModel = z.infer<typeof imageModelSchema>;
