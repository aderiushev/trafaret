import { join, sep } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

/** Vite names the files in /assets after their content, so a browser may keep them for good. */
const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * Serves the built editor from the API's origin, so production needs no CORS. index.html is revalidated on every
 * visit, so returning visitors get a new deploy straight away.
 */
export async function registerWebApp(app: FastifyInstance, root: string): Promise<void> {
  const bundles = join(root, 'assets') + sep;
  await app.register(fastifyStatic, {
    root,
    setHeaders: (reply, path) => {
      reply.header('cache-control', path.startsWith(bundles) ? IMMUTABLE : 'no-cache');
    },
  });
}
