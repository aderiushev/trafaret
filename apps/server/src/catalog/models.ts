import type { AspectRatio, ProviderId } from '@trafaret/core';

export type Size = { width: number; height: number };

export type ModelDefinition = {
  id: string;
  label: string;
  provider: ProviderId;
  /** The provider's own model identifier. */
  providerModel: string;
  supportsEdit: boolean;
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  maxReferenceImages: number;
  sizes: Record<AspectRatio, Size>;
  costPerImageUsd: number;
};

const STANDARD_SIZES: Record<AspectRatio, Size> = {
  '1:1': { width: 1024, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
};

/** Seedream 4.5 needs at least ~3.69 MP per image. */
const SEEDREAM_SIZES: Record<AspectRatio, Size> = {
  '1:1': { width: 2048, height: 2048 },
  '4:3': { width: 2304, height: 1728 },
  '3:4': { width: 1728, height: 2304 },
  '16:9': { width: 2560, height: 1440 },
  '9:16': { width: 1440, height: 2560 },
};

const mock = {
  provider: 'mock',
  supportsEdit: true,
  supportsNegativePrompt: true,
  supportsSeed: true,
  maxReferenceImages: 14,
  sizes: STANDARD_SIZES,
  costPerImageUsd: 0,
} as const;

export const MODEL_DEFINITIONS: readonly ModelDefinition[] = [
  {
    id: 'seedream-4.5',
    label: 'Seedream 4.5',
    provider: 'byteplus',
    providerModel: 'seedream-4-5-251128',
    supportsEdit: true,
    supportsNegativePrompt: false,
    supportsSeed: false,
    maxReferenceImages: 14,
    sizes: SEEDREAM_SIZES,
    costPerImageUsd: 0.04,
  },
  {
    id: 'flux-2-klein',
    label: 'FLUX.2 klein 4B',
    provider: 'cloudflare',
    providerModel: '@cf/black-forest-labs/flux-2-klein-4b',
    supportsEdit: true,
    supportsNegativePrompt: false,
    supportsSeed: true,
    maxReferenceImages: 4,
    sizes: STANDARD_SIZES,
    costPerImageUsd: 0.0012,
  },
  { id: 'mock', label: 'Mock', providerModel: 'mock', ...mock },
  { id: 'mock-fails-first', label: 'Mock · fails first attempt', providerModel: 'mock-fails-first', ...mock },
];
