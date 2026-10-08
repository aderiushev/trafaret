import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Sample } from '@trafaret/core';
import type { AssetStore, StoredAsset } from '../assets/asset-store.ts';
import { toAssetResponse } from '../assets/routes.ts';

type SampleEntry = { id: string; name: string; asset: StoredAsset };

const toName = (id: string): string => {
  const words = id.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Pinned sample photos (e.g. for the Edit templates); the file name is the sample id. */
export class SampleRepository {
  private readonly samples: readonly SampleEntry[];

  constructor(samples: readonly SampleEntry[]) {
    this.samples = samples;
  }

  static async load(dir: string, assets: AssetStore): Promise<SampleRepository> {
    const files = (await readdir(dir)).filter((name) => /\.(?:webp|png|jpe?g)$/i.test(name)).sort();
    const samples: SampleEntry[] = [];
    const fileById = new Map<string, string>();
    for (const file of files) {
      const id = file.replace(/\.[^.]+$/, '');
      const firstFile = fileById.get(id);
      if (firstFile !== undefined) throw new Error(`Duplicate sample id "${id}" (${firstFile}, ${file})`);
      fileById.set(id, file);
      const asset = await assets.put(await readFile(join(dir, file)), { pinned: true });
      samples.push({ id, name: toName(id), asset });
    }
    return new SampleRepository(samples);
  }

  list(): Sample[] {
    return this.samples.map(({ id, name, asset }) => ({ id, name, ...toAssetResponse(asset) }));
  }
}
