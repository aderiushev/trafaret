import type { FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import type { Config } from './config.ts';
import { createHttpServer } from './http/server.ts';

export async function buildApp(config: Config, logger: Logger): Promise<FastifyInstance> {
  return createHttpServer({ logger, trustProxy: config.env === 'production' });
}
