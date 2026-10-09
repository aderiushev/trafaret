import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createLogger } from './lib/logger.ts';
import { createServices } from './services.ts';

const config = loadConfig(process.env);
const logger = createLogger({ level: config.logLevel });
// The editor's production build, when it exists (`pnpm build`; always in the Docker image).
const webRoot = fileURLToPath(new URL('../../web/dist', import.meta.url));
const app = await buildApp(
  config,
  await createServices(config, logger),
  logger,
  existsSync(join(webRoot, 'index.html')) ? { webRoot } : {},
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'shutting down');
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: config.host, port: config.port });
