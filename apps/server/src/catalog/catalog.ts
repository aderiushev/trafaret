import { ASPECT_RATIOS, type ImageModel } from '@trafaret/core';
import type { Config } from '../config.ts';
import { MODEL_DEFINITIONS, type ModelDefinition } from './models.ts';

const DEFAULT_PREFERENCE = ['seedream-4.5', 'flux-2-klein', 'mock'];

/** Capability-driven model list: models without credentials stay visible but disabled, with the reason. */
export class ModelCatalog {
  private readonly models: readonly ImageModel[];
  private readonly definitions: ReadonlyMap<string, ModelDefinition>;

  constructor(
    credentials: Pick<Config, 'cloudflare' | 'byteplus'>,
    definitions: readonly ModelDefinition[] = MODEL_DEFINITIONS,
  ) {
    this.definitions = new Map(definitions.map((definition) => [definition.id, definition]));
    const reasonFor = (definition: ModelDefinition): string | null => {
      switch (definition.provider) {
        case 'cloudflare':
          return credentials.cloudflare
            ? null
            : 'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN on the server to enable this model.';
        case 'byteplus':
          return credentials.byteplus ? null : 'Set ARK_API_KEY on the server to enable this model.';
        case 'mock':
          return null;
      }
    };
    const enabled = definitions
      .filter((definition) => reasonFor(definition) === null)
      .map((definition) => definition.id);
    const defaultId = DEFAULT_PREFERENCE.find((id) => enabled.includes(id)) ?? null;
    this.models = definitions.map((definition) => {
      const reason = reasonFor(definition);
      return {
        id: definition.id,
        label: definition.label,
        provider: definition.provider,
        default: definition.id === defaultId,
        enabled: reason === null,
        unavailableReason: reason,
        supportsEdit: definition.supportsEdit,
        supportsNegativePrompt: definition.supportsNegativePrompt,
        supportsSeed: definition.supportsSeed,
        maxReferenceImages: definition.maxReferenceImages,
        aspectRatios: ASPECT_RATIOS.filter((ratio) => ratio in definition.sizes),
        costPerImageUsd: definition.costPerImageUsd,
      };
    });
  }

  list(): readonly ImageModel[] {
    return this.models;
  }

  get(id: string): ImageModel | undefined {
    return this.models.find((model) => model.id === id);
  }

  definition(id: string): ModelDefinition | undefined {
    return this.definitions.get(id);
  }
}
