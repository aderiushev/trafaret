import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from './errors.ts';
import { createHttpServer } from './server.ts';

const logger = pino({ level: 'silent' });

describe('createHttpServer', () => {
  it('answers health checks', async () => {
    const app = await createHttpServer({ logger });
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('serves the OpenAPI document', async () => {
    const app = await createHttpServer({ logger });
    const response = await app.inject({ method: 'GET', url: '/api/docs/json' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      openapi: expect.stringMatching(/^3\./),
      info: { title: 'Trafaret API' },
    });
  });

  it('answers unknown routes with the error envelope', async () => {
    const app = await createHttpServer({ logger });
    const response = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('turns AppError into the error envelope', async () => {
    const app = await createHttpServer({ logger });
    app.get('/boom', () => {
      throw new AppError(409, 'CONFLICT', 'Nope.');
    });
    const response = await app.inject({ method: 'GET', url: '/boom' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: 'CONFLICT', message: 'Nope.' } });
  });

  it('reports request-shape errors as SCHEMA_MISMATCH issues', async () => {
    const app = await createHttpServer({ logger });
    app
      .withTypeProvider<ZodTypeProvider>()
      .post('/echo', { schema: { body: z.object({ name: z.string() }) } }, (request) => request.body);
    const response = await app.inject({ method: 'POST', url: '/echo', payload: { name: 42 } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'INVALID_REQUEST', issues: [{ code: 'SCHEMA_MISMATCH' }] },
    });
  });

  it('never leaks internal error details', async () => {
    const app = await createHttpServer({ logger });
    app.get('/crash', () => {
      throw new Error('secret connection string');
    });
    const response = await app.inject({ method: 'GET', url: '/crash' });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('secret');
    expect(response.json()).toMatchObject({ error: { code: 'INTERNAL' } });
  });
});
