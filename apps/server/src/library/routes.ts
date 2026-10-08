import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { presetsResponseSchema, samplesResponseSchema } from '@trafaret/core';
import type { PresetRepository } from './preset-repository.ts';
import type { SampleRepository } from './sample-repository.ts';

export function registerLibraryRoutes(
  app: FastifyInstance,
  options: { presets: PresetRepository; samples: SampleRepository },
): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  routes.get('/api/presets', { schema: { response: { 200: presetsResponseSchema } } }, () => ({
    presets: options.presets.list(),
  }));
  routes.get('/api/samples', { schema: { response: { 200: samplesResponseSchema } } }, () => ({
    samples: options.samples.list(),
  }));
}
