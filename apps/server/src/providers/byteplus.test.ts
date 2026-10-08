import { describe, expect, it } from 'vitest';
import { stubFetch } from '../test/fetch.ts';
import { makePng } from '../test/images.ts';
import { BYTEPLUS_BASE_URL, createBytePlusProvider } from './byteplus.ts';
import type { ProviderRequest } from './types.ts';

const request = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
  model: 'seedream-4-5-251128',
  mode: 'generate',
  prompt: 'A white sneaker. premium minimal 3D render. Avoid: clutter.',
  negativePrompt: null,
  images: [],
  width: 2560,
  height: 1440,
  seed: null,
  attempt: 1,
  ...overrides,
});

describe('BytePlus provider', () => {
  it('sends an OpenAI-style JSON request with images as data URIs', async () => {
    const output = await makePng(8, 8);
    const { fetch, calls } = stubFetch(
      new Response(JSON.stringify({ data: [{ b64_json: output.toString('base64') }] })),
    );
    const provider = createBytePlusProvider({ apiKey: 'ark-key', fetch });
    const source = { bytes: await makePng(4, 4, '#000000'), mime: 'image/png' };
    const reference = { bytes: await makePng(4, 4, '#ffffff'), mime: 'image/webp' };

    const result = await provider.generate(
      request({ mode: 'edit', images: [source, reference] }),
      new AbortController().signal,
    );

    expect(result.bytes.equals(output)).toBe(true);
    const call = calls[0]!;
    expect(call.url).toBe(`${BYTEPLUS_BASE_URL}/images/generations`);
    expect(new Headers(call.init.headers).get('authorization')).toBe('Bearer ark-key');
    expect(JSON.parse(call.init.body as string)).toEqual({
      model: 'seedream-4-5-251128',
      prompt: 'A white sneaker. premium minimal 3D render. Avoid: clutter.',
      size: '2560x1440',
      response_format: 'b64_json',
      watermark: false,
      sequential_image_generation: 'disabled',
      image: [
        `data:image/png;base64,${source.bytes.toString('base64')}`,
        `data:image/webp;base64,${reference.bytes.toString('base64')}`,
      ],
    });
  });

  it('omits the image field for plain text-to-image', async () => {
    const { fetch, calls } = stubFetch(new Response(JSON.stringify({ data: [{ b64_json: 'aGk=' }] })));
    await createBytePlusProvider({ apiKey: 'k', fetch }).generate(request(), new AbortController().signal);
    expect(JSON.parse(calls[0]!.init.body as string)).not.toHaveProperty('image');
  });

  it('maps moderation refusals to a non-retryable error', async () => {
    const body = '{"error":{"code":"InputTextSensitiveContentDetected","message":"The request failed."}}';
    const { fetch } = stubFetch(new Response(body, { status: 400 }));
    await expect(
      createBytePlusProvider({ apiKey: 'k', fetch }).generate(request(), new AbortController().signal),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', retryable: false });
  });

  it('rejects unexpected response bodies', async () => {
    const { fetch } = stubFetch(new Response('{"data":[]}'));
    await expect(
      createBytePlusProvider({ apiKey: 'k', fetch }).generate(request(), new AbortController().signal),
    ).rejects.toMatchObject({ code: 'PROVIDER_ERROR', retryable: true });
  });

  it('treats a response body that is not JSON as a retryable provider error', async () => {
    const { fetch } = stubFetch(new Response('<html>Bad gateway</html>', { status: 200 }));
    await expect(
      createBytePlusProvider({ apiKey: 'k', fetch }).generate(request(), new AbortController().signal),
    ).rejects.toMatchObject({ name: 'ProviderError', code: 'PROVIDER_ERROR', retryable: true });
  });

  it('forwards the abort signal, declares a JSON body and honours a custom base URL', async () => {
    const { fetch, calls } = stubFetch(new Response(JSON.stringify({ data: [{ b64_json: 'aGk=' }] })));
    const provider = createBytePlusProvider({
      apiKey: 'k',
      fetch,
      baseUrl: 'https://ark.example.test/api/v3',
    });
    const signal = new AbortController().signal;

    await provider.generate(request(), signal);

    const call = calls[0]!;
    expect(call.url).toBe('https://ark.example.test/api/v3/images/generations');
    expect(call.init.signal).toBe(signal);
    expect(new Headers(call.init.headers).get('content-type')).toBe('application/json');
  });
});
