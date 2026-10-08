import { assetUrl, type AspectRatio, type Preset, type RequestPreview } from '@trafaret/core';
import type { ModelDefinition } from '../catalog/models.ts';

export type RequestBuilderInput = {
  /** The wired prompt, or an Edit node's instruction. */
  userText: string;
  aspectRatio: AspectRatio;
  seed: number;
  model: ModelDefinition;
  preset: { preset: Preset; referenceAssetIds: readonly string[] } | null;
  /** Edit Image only. */
  sourceAssetId: string | null;
};

export type BuiltRequest = {
  prompt: string;
  /** Set only when the model has a native negative-prompt field. */
  negativePrompt: string | null;
  /** Edit source first, then preset references, cut to the model limit. */
  referenceAssetIds: string[];
  width: number;
  height: number;
  seed: number | null;
  /** What the inspector shows as "Request sent to AI". */
  preview: RequestPreview;
};

const trimTrailingPunctuation = (text: string): string => text.trim().replace(/[\s.,;:!?]+$/u, '');

/** Pure: user prompt + selected preset + model capabilities → one provider request. */
export function buildRequest(input: RequestBuilderInput): BuiltRequest {
  const { model, preset } = input;
  let prompt = [input.userText, preset?.preset.mainPrompt ?? '']
    .map(trimTrailingPunctuation)
    .filter((part) => part.length > 0)
    .join('. ');

  const negativeText = trimTrailingPunctuation(preset?.preset.negativePrompt ?? '');
  let negativeMode: RequestPreview['negativeMode'] = 'none';
  let negativePrompt: string | null = null;
  if (negativeText) {
    if (model.supportsNegativePrompt) {
      negativeMode = 'native';
      negativePrompt = negativeText;
    } else {
      negativeMode = 'folded';
      prompt = `${prompt}. Avoid: ${negativeText}.`;
    }
  }

  const references = [
    ...(input.sourceAssetId ? [{ assetId: input.sourceAssetId, role: 'source' as const }] : []),
    ...(preset?.referenceAssetIds ?? []).map((assetId) => ({ assetId, role: 'preset' as const })),
  ];
  const kept = references.slice(0, model.maxReferenceImages);
  const dropped = references.length - kept.length;
  const warnings =
    dropped > 0
      ? [
          `${dropped} of ${references.length} reference images dropped: ${model.label} accepts ${model.maxReferenceImages}.`,
        ]
      : [];

  const size = model.sizes[input.aspectRatio];
  const seed = model.supportsSeed ? input.seed : null;

  return {
    prompt,
    negativePrompt,
    referenceAssetIds: kept.map((reference) => reference.assetId),
    width: size.width,
    height: size.height,
    seed,
    preview: {
      modelId: model.id,
      prompt,
      negativePrompt: negativeText || null,
      negativeMode,
      references: kept.map((reference) => ({ ...reference, url: assetUrl(reference.assetId) })),
      aspectRatio: input.aspectRatio,
      seed,
      warnings,
    },
  };
}
