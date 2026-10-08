import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, {
  type FastifyBaseLogger,
  type FastifyError,
  type FastifyInstance,
  type FastifyRequest,
} from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Logger } from 'pino';
import { z } from 'zod';
import type { Issue } from '@trafaret/core';
import { AppError, errorBody } from './errors.ts';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type HttpServerOptions = {
  logger: Logger;
  trustProxy?: boolean;
  /** Identifies a client for rate limiting; defaults to the request IP. */
  rateLimitKey?: (request: FastifyRequest) => string;
};

/** Fastify with zod validation, the error envelope, OpenAPI docs, uploads, rate limiting and /api/health. */
export async function createHttpServer(options: HttpServerOptions): Promise<FastifyInstance> {
  // Widened so the app keeps the default FastifyInstance type rather than one parameterised by pino's Logger.
  const loggerInstance: FastifyBaseLogger = options.logger;
  const app = Fastify({ loggerInstance, trustProxy: options.trustProxy ?? false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(app);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Trafaret API',
        description: 'Define and run node-based AI image workflows.',
        version: '0.1.0',
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });
  await app.register(rateLimit, {
    global: false,
    ...(options.rateLimitKey ? { keyGenerator: options.rateLimitKey } : {}),
    errorResponseBuilder: (_request, context) =>
      new AppError(429, 'RATE_LIMITED', `Too many requests. Try again in ${context.after}.`),
  });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, parts: 5 } });

  app
    .withTypeProvider<ZodTypeProvider>()
    .get('/api/health', { schema: { response: { 200: z.object({ ok: z.literal(true) }) } } }, () => ({
      ok: true as const,
    }));

  return app;
}

function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const issues: Issue[] = error.validation.map((item) => ({
        code: 'SCHEMA_MISMATCH',
        message: `${item.instancePath || 'body'} ${item.message ?? 'is invalid'}`.trim(),
      }));
      return reply
        .code(400)
        .send(errorBody('INVALID_REQUEST', "The request doesn't match the API schema.", issues));
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(errorBody(error.code, error.message, error.issues));
    }
    if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.code(413).send(errorBody('FILE_TOO_LARGE', 'Images must be 10 MB or smaller.'));
    }
    if (error.statusCode === 429) {
      return reply.code(429).send(errorBody('RATE_LIMITED', 'Too many requests. Try again in a minute.'));
    }
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500)
      return reply.code(status).send(errorBody('BAD_REQUEST', error.message));
    request.log.error({ err: error }, 'unhandled error');
    return reply
      .code(500)
      .send(errorBody('INTERNAL', 'Something went wrong on our side. Try again in a moment.'));
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send(errorBody('NOT_FOUND', `Nothing at ${request.method} ${request.url}.`)),
  );
}
