import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { catalogResponseSchema } from '@trafaret/core';
import type { ModelCatalog } from './catalog.ts';

export function registerCatalogRoutes(app: FastifyInstance, options: { catalog: ModelCatalog }): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get('/api/catalog', { schema: { response: { 200: catalogResponseSchema } } }, () => ({
      models: [...options.catalog.list()],
    }));
}
