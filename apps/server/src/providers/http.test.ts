import { describe, expect, it } from 'vitest';
import { errorFromResponse, postToProvider } from './http.ts';

describe('errorFromResponse', () => {
  it.each([
    [401, '', 'PROVIDER_ERROR', false, "The server's AI credentials were rejected."],
    [403, '', 'PROVIDER_ERROR', false, "The server's AI credentials were rejected."],
    [429, '', 'PROVIDER_ERROR', true, 'The AI service is busy. Retry in a few seconds.'],
    [503, '', 'PROVIDER_ERROR', true, "The AI service didn't respond. Retry in a few seconds."],
    [
      400,
      '{"error":{"code":"InputTextSensitiveContentDetected","message":"The request was blocked"}}',
      'INVALID_INPUT',
      false,
      'The model declined this prompt. Rephrase it and run again.',
    ],
    [
      400,
      '{"error":{"message":"width must be at most 1920"}}',
      'INVALID_INPUT',
      false,
      'The AI service rejected the request: width must be at most 1920',
    ],
  ] as const)('maps HTTP %i', async (status, body, code, retryable, message) => {
    expect(await errorFromResponse(new Response(body, { status }))).toMatchObject({
      code,
      retryable,
      message,
    });
  });
});

describe('postToProvider', () => {
  it('maps network failures to a retryable error', async () => {
    const failing = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    await expect(postToProvider(failing, 'https://ai.example.test', {})).rejects.toMatchObject({
      name: 'ProviderError',
      code: 'PROVIDER_ERROR',
      retryable: true,
    });
  });

  it('lets abort errors through untouched', async () => {
    const aborting = (() => Promise.reject(new DOMException('timed out', 'TimeoutError'))) as typeof fetch;
    await expect(postToProvider(aborting, 'https://ai.example.test', {})).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });

  it('returns successful responses', async () => {
    const ok = (() => Promise.resolve(new Response('{}', { status: 200 }))) as typeof fetch;
    expect((await postToProvider(ok, 'https://ai.example.test', {})).status).toBe(200);
  });
});
