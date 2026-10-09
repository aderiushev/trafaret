import type { AspectRatio, ImageModel } from '@trafaret/core';

/** The model a new node starts with: the server's default if it can do the job, else the first one that can. */
export function defaultModelId(models: readonly ImageModel[], purpose: 'generate' | 'edit'): string | null {
  const usable = models.filter((model) => model.enabled && (purpose === 'generate' || model.supportsEdit));
  return (usable.find((model) => model.default) ?? usable[0])?.id ?? null;
}

/** Keeps the aspect ratio when the model supports it, otherwise falls back to the model's first one. */
export const supportedAspectRatio = (model: ImageModel, current: AspectRatio): AspectRatio =>
  model.aspectRatios.includes(current) ? current : (model.aspectRatios[0] ?? current);
