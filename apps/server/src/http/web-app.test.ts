import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { createHttpServer } from './server.ts';
import { registerWebApp } from './web-app.ts';

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'trafaret-web-'));
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'index.html'), '<!doctype html><title>Trafaret</title>');
  await writeFile(join(root, 'assets', 'index-3f2a1b.js'), 'console.log("editor")');
  await writeFile(join(root, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const app = await createHttpServer({ logger: pino({ level: 'silent' }) });
  await registerWebApp(app, root);
  return app;
}

describe('registerWebApp', () => {
  it('serves the editor at / and has browsers revalidate it', async () => {
    const app = await setup();
    const response = await app.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.body).toContain('<title>Trafaret</title>');
  });

  it('lets browsers keep the content-hashed bundles', async () => {
    const app = await setup();
    const response = await app.inject({ method: 'GET', url: '/assets/index-3f2a1b.js' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('revalidates other files at the root', async () => {
    const app = await setup();
    const response = await app.inject({ method: 'GET', url: '/favicon.svg' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('keeps answering unknown paths with the error envelope', async () => {
    const app = await setup();
    for (const url of ['/api/nope', '/nope.js']) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
    }
  });

  it('still routes the API', async () => {
    const app = await setup();
    expect((await app.inject({ method: 'GET', url: '/api/health' })).json()).toEqual({ ok: true });
  });
});
