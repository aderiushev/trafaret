import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import { registerAssetRoutes } from './assets/routes.ts';
import { registerCatalogRoutes } from './catalog/routes.ts';
import type { Config } from './config.ts';
import { createHttpServer } from './http/server.ts';
import { registerLibraryRoutes } from './library/routes.ts';
import { registerRunRoutes } from './runs/routes.ts';
import type { Services } from './services.ts';

export type AppOptions = { rateLimits?: { runsPer10Minutes: number; uploadsPer10Minutes: number } };

/** Behind the demo host's edge, the visitor's address arrives in cf-connecting-ip. */
const clientKey = (request: FastifyRequest): string => {
  const header = request.headers['cf-connecting-ip'];
  return typeof header === 'string' && header !== '' ? header : request.ip;
};

export async function buildApp(
  config: Config,
  services: Services,
  logger: Logger,
  options: AppOptions = {},
): Promise<FastifyInstance> {
  const production = config.env === 'production';
  const app = await createHttpServer({
    logger,
    trustProxy: production,
    ...(production ? { rateLimitKey: clientKey } : {}),
  });
  const limits =
    options.rateLimits ??
    (production
      ? { runsPer10Minutes: 20, uploadsPer10Minutes: 30 }
      : { runsPer10Minutes: 1000, uploadsPer10Minutes: 1000 });

  registerAssetRoutes(app, { assets: services.assets, uploadsPer10Minutes: limits.uploadsPer10Minutes });
  registerLibraryRoutes(app, { presets: services.presets, samples: services.samples });
  registerCatalogRoutes(app, { catalog: services.catalog });
  registerRunRoutes(app, {
    engine: services.engine,
    catalog: services.catalog,
    presets: services.presets,
    assets: services.assets,
    runsPer10Minutes: limits.runsPer10Minutes,
  });
  return app;
}
