import type { FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import { registerAssetRoutes } from './assets/routes.ts';
import { registerCatalogRoutes } from './catalog/routes.ts';
import type { Config } from './config.ts';
import { edgeClientKey } from './http/client-key.ts';
import { createHttpServer } from './http/server.ts';
import { registerWebApp } from './http/web-app.ts';
import { registerLibraryRoutes } from './library/routes.ts';
import { registerRunRoutes } from './runs/routes.ts';
import type { Services } from './services.ts';

export type AppOptions = {
  rateLimits?: { runsPer10Minutes: number; uploadsPer10Minutes: number };
  /** The built editor (apps/web/dist). When set, the server serves it next to the API. */
  webRoot?: string;
};

export async function buildApp(
  config: Config,
  services: Services,
  logger: Logger,
  options: AppOptions = {},
): Promise<FastifyInstance> {
  const production = config.env === 'production';
  const app = await createHttpServer({ logger, ...(production ? { rateLimitKey: edgeClientKey } : {}) });
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
  if (options.webRoot) await registerWebApp(app, options.webRoot);
  return app;
}
