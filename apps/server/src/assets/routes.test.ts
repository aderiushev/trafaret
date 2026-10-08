import type { FastifyInstance } from 'fastify';
import FormData from 'form-data';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { createHttpServer, MAX_UPLOAD_BYTES } from '../http/server.ts';
import { makePng, makeRotatedJpeg } from '../test/images.ts';
import { AssetStore } from './asset-store.ts';
import { inspectImage } from './image.ts';
import { registerAssetRoutes } from './routes.ts';

async function setup(uploadsPer10Minutes = 100) {
  const app = await createHttpServer({ logger: pino({ level: 'silent' }) });
  const assets = new AssetStore({ maxBytes: 50 * 1024 * 1024 });
  registerAssetRoutes(app, { assets, uploadsPer10Minutes });
  return { app, assets };
}

function upload(app: FastifyInstance, bytes: Buffer, filename = 'photo.png') {
  const form = new FormData();
  form.append('file', bytes, { filename });
  return app.inject({ method: 'POST', url: '/api/assets', payload: form, headers: form.getHeaders() });
}

describe('asset routes', () => {
  it('stores an upload and serves it back with immutable caching', async () => {
    const { app } = await setup();
    const png = await makePng(6, 4);
    const created = await upload(app, png);
    expect(created.statusCode).toBe(201);
    const body = created.json<{ assetId: string; url: string; width: number; height: number }>();
    expect(body).toMatchObject({ width: 6, height: 4, url: `/api/assets/${body.assetId}` });

    const served = await app.inject({ method: 'GET', url: body.url });
    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(served.rawPayload.equals(png)).toBe(true);
  });

  it('rejects files that are not PNG, JPEG or WebP', async () => {
    const { app } = await setup();
    const response = await upload(app, Buffer.from('definitely not an image'), 'notes.png');
    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({ error: { code: 'UNSUPPORTED_IMAGE' } });
  });

  it('rejects a corrupt rotated photo whose header still reads fine', async () => {
    const { app } = await setup();
    const truncated = (await makeRotatedJpeg()).subarray(0, -12);
    // Precondition: the header passes inspection, so only AssetStore.put can reject it.
    expect(await inspectImage(truncated)).not.toBeNull();
    const response = await upload(app, truncated, 'rotated.jpg');
    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({ error: { code: 'UNSUPPORTED_IMAGE' } });
  });

  it('rejects images larger than 4096 px on a side', async () => {
    const { app } = await setup();
    const response = await upload(app, await makePng(4097, 2));
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: { code: 'IMAGE_TOO_LARGE' } });
  });

  it('rejects files over 10 MB', async () => {
    const { app } = await setup();
    const response = await upload(app, Buffer.alloc(MAX_UPLOAD_BYTES + 1));
    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ error: { code: 'FILE_TOO_LARGE' } });
  });

  it('requires a file', async () => {
    const { app } = await setup();
    const form = new FormData();
    form.append('note', 'no file here');
    const response = await app.inject({
      method: 'POST',
      url: '/api/assets',
      payload: form,
      headers: form.getHeaders(),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'NO_FILE' } });
  });

  it('answers 404 for unknown ids and 400 for malformed ones', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'GET', url: `/api/assets/${'0'.repeat(64)}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/assets/not-a-hash' })).statusCode).toBe(400);
  });

  it('rate limits uploads per client', async () => {
    const { app } = await setup(1);
    expect((await upload(app, await makePng())).statusCode).toBe(201);
    const limited = await upload(app, await makePng(9, 9));
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });
});
