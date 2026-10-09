import { assetSchema, samplesResponseSchema, type Asset, type Sample } from '@trafaret/core';
import { http, request } from '@/shared/api';

export function uploadAsset(file: File): Promise<Asset> {
  const body = new FormData();
  body.append('file', file);
  // A large photo on a slow connection takes a while: uploads get more time than other calls.
  return request(http.post('assets', { body, timeout: 120_000 }).json(assetSchema));
}

export async function fetchSamples(signal?: AbortSignal): Promise<Sample[]> {
  const { samples } = await request(http.get('samples', { signal }).json(samplesResponseSchema));
  return samples;
}
