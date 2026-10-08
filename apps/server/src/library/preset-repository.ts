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

/** A preset that cannot be loaded is reported with its file name, so a bad boot points straight at the fix. */
const invalidPreset = (file: string, reason: string, options?: ErrorOptions): Error =>
  new Error(`Invalid preset ${file}: ${reason}`, options);

const reasonOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

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
      const text = await readFile(join(dir, file), 'utf8');
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch (cause) {
        throw invalidPreset(file, `not valid JSON (${reasonOf(cause)})`, { cause });
      }
      const parsed = presetFileSchema.safeParse(json);
      if (!parsed.success) {
        const details = parsed.error.issues
          .map((issue) => `${issue.path.join('.')} ${issue.message}`)
          .join('; ');
        throw invalidPreset(file, details);
      }
      const preset = parsed.data;
      if (presets.some((entry) => entry.preset.id === preset.id)) {
        throw new Error(`Duplicate preset id "${preset.id}" in ${file}`);
      }
      const referenceAssetIds: string[] = [];
      for (const reference of preset.references) {
        try {
          const asset = await assets.put(await readFile(join(dir, reference)), { pinned: true });
          referenceAssetIds.push(asset.id);
        } catch (cause) {
          throw invalidPreset(file, `reference ${reference} could not be loaded: ${reasonOf(cause)}`, {
            cause,
          });
        }
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
