import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { assetUrl, presetSchema, type Preset } from '@trafaret/core';
import type { AssetStore } from '../assets/asset-store.ts';
import { canonicalJson } from '../lib/canonical-json.ts';
import { sha256Hex } from '../lib/hash.ts';

const presetFileSchema = presetSchema.extend({
  references: z.array(
    z
      .string()
      .regex(/^\/references\/[a-z0-9-]+\.(?:webp|png|jpe?g)$/, 'must look like /references/<name>.webp'),
  ),
});

export type ResolvedPreset = { preset: Preset; referenceAssetIds: string[]; contentHash: string };

/** Presets are files on the server: the UI only ever stores a preset id, never the merge logic. */
export class PresetRepository {
  private readonly byId: ReadonlyMap<string, ResolvedPreset>;

  constructor(presets: readonly ResolvedPreset[]) {
    this.byId = new Map(presets.map((entry) => [entry.preset.id, entry]));
  }

  static async load(dir: string, assets: AssetStore): Promise<PresetRepository> {
    const files = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
    const presets: ResolvedPreset[] = [];
    for (const file of files) {
      const parsed = presetFileSchema.safeParse(JSON.parse(await readFile(join(dir, file), 'utf8')));
      if (!parsed.success) {
        const details = parsed.error.issues
          .map((issue) => `${issue.path.join('.')} ${issue.message}`)
          .join('; ');
        throw new Error(`Invalid preset ${file}: ${details}`);
      }
      const preset = parsed.data;
      if (presets.some((entry) => entry.preset.id === preset.id)) {
        throw new Error(`Duplicate preset id "${preset.id}" in ${file}`);
      }
      const referenceAssetIds: string[] = [];
      for (const reference of preset.references) {
        const asset = await assets.put(await readFile(join(dir, reference)), { pinned: true });
        referenceAssetIds.push(asset.id);
      }
      const contentHash = sha256Hex(canonicalJson({ ...preset, references: referenceAssetIds }));
      presets.push({ preset, referenceAssetIds, contentHash });
    }
    return new PresetRepository(presets);
  }

  get(id: string): ResolvedPreset | undefined {
    return this.byId.get(id);
  }

  /** Presets as the API exposes them: references resolved to asset URLs. */
  list(): Preset[] {
    return [...this.byId.values()].map(({ preset, referenceAssetIds }) => ({
      ...preset,
      references: referenceAssetIds.map(assetUrl),
    }));
  }
}
