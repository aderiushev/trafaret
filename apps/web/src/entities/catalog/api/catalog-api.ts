import { catalogResponseSchema, type ImageModel } from '@trafaret/core';
import { http, request } from '@/shared/api';

export async function fetchCatalog(signal?: AbortSignal): Promise<ImageModel[]> {
  const { models } = await request(http.get('catalog', { signal }).json(catalogResponseSchema));
  return models;
}
