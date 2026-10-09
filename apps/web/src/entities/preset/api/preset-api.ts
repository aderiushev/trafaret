import { presetsResponseSchema, type Preset } from '@trafaret/core';
import { http, request } from '@/shared/api';

export async function fetchPresets(signal?: AbortSignal): Promise<Preset[]> {
  const { presets } = await request(http.get('presets', { signal }).json(presetsResponseSchema));
  return presets;
}
