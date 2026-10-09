import ky from 'ky';
import { describe, expect, it } from 'vitest';
import { catalogResponseSchema } from '@trafaret/core';
import { ApiError, request } from './http';

const server = (respond: () => Response | Promise<Response>, timeout = 1000) =>
  ky.create({ prefix: 'http://api.test/api', retry: 0, timeout, fetch: async () => respond() });

async function failureOf(call: Promise<unknown>): Promise<ApiError> {
  try {
    await request(call);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the call to fail');
}

describe('request', () => {
  it('returns the response of a successful call', async () => {
    const body = await request(
      server(() => Response.json({ models: [] }))
        .get('catalog')
        .json(),
    );
    expect(body).toEqual({ models: [] });
  });

  it('carries the code, message and issues of the error envelope', async () => {
    const issues = [{ code: 'MISSING_VALUE', message: 'Write a prompt.', nodeId: 'p1' }];
    const envelope = { error: { code: 'INVALID_GRAPH', message: 'Write a prompt.', issues } };
    const error = await failureOf(
      server(() => Response.json(envelope, { status: 400 }))
        .post('runs')
        .json(),
    );
    expect(error).toMatchObject({ status: 400, code: 'INVALID_GRAPH', message: 'Write a prompt.' });
    expect(error.issues).toEqual(issues);
  });

  it('explains a server error without an envelope', async () => {
    const page = () => new Response('<html>Service unavailable</html>', { status: 503 });
    const error = await failureOf(server(page).get('catalog').json());
    expect(error).toMatchObject({
      status: 503,
      code: 'HTTP_ERROR',
      message: 'The server is unavailable. Try again in a moment.',
    });
  });

  it('reports an unreachable server', async () => {
    const unreachable = () => Promise.reject(new TypeError('Failed to fetch'));
    const error = await failureOf(server(unreachable).get('catalog').json());
    expect(error).toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('reports a server that does not answer in time', async () => {
    const silent = () => new Promise<Response>(() => undefined);
    const error = await failureOf(server(silent, 20).get('catalog').json());
    expect(error).toMatchObject({ status: 0, code: 'TIMEOUT' });
  });

  it('reports a response that does not match its schema', async () => {
    const call = server(() => Response.json({ models: 'none' }))
      .get('catalog')
      .json(catalogResponseSchema);
    expect(await failureOf(call)).toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('lets a cancelled call through as it is', async () => {
    const controller = new AbortController();
    // Like fetch: never answers, and rejects with the signal's reason once the call is aborted.
    const hanging = (input: string | URL | Request) =>
      new Promise<Response>((_, reject) => {
        if (!(input instanceof Request)) return;
        const abort = () => reject(input.signal.reason as Error);
        if (input.signal.aborted) abort();
        else input.signal.addEventListener('abort', abort);
      });
    const client = ky.create({ prefix: 'http://api.test/api', retry: 0, fetch: hanging });
    const call = request(client.get('catalog', { signal: controller.signal }).json());
    controller.abort();
    await expect(call).rejects.toMatchObject({ name: 'AbortError' });
  });
});
