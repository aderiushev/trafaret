import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { stubFetch } from '../test/fetch.ts';
import { makePng } from '../test/images.ts';
import { createCloudflareProvider } from './cloudflare.ts';
import type { ProviderRequest } from './types.ts';

const okResponse = (image: Buffer) =>
  new Response(JSON.stringify({ success: true, result: { image: image.toString('base64') } }), {
    status: 200,
  });

const baseRequest = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
  model: '@cf/black-forest-labs/flux-2-klein-4b',
  mode: 'generate',
  prompt: 'A white sneaker',
  negativePrompt: null,
  images: [],
  width: 1024,
  height: 768,
  seed: 42,
  attempt: 1,
  ...overrides,
});

describe('Cloudflare provider', () => {
  it('sends prompt, size, seed and shrunken reference images as multipart', async () => {
    const output = await makePng(8, 8);
    const { fetch, calls } = stubFetch(okResponse(output));
    const provider = createCloudflareProvider({ accountId: 'acc-1', apiToken: 'tok-1', fetch });
    const signal = new AbortController().signal;
    const source = { bytes: await makePng(1200, 800), mime: 'image/png' };

    const result = await provider.generate(baseRequest({ mode: 'edit', images: [source] }), signal);

    expect(result.bytes.equals(output)).toBe(true);
    const call = calls[0]!;
    expect(call.url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acc-1/ai/run/@cf/black-forest-labs/flux-2-klein-4b',
    );
    expect(new Headers(call.init.headers).get('authorization')).toBe('Bearer tok-1');
    expect(call.init.signal).toBe(signal);
    const form = call.init.body as FormData;
    expect(form.get('prompt')).toBe('A white sneaker');
    expect(form.get('width')).toBe('1024');
    expect(form.get('height')).toBe('768');
    expect(form.get('seed')).toBe('42');
    const reference = form.get('input_image_0') as Blob;
    const meta = await sharp(Buffer.from(await reference.arrayBuffer())).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThan(512);
  });

  it('sends at most four reference images and no seed when there is none', async () => {
    const { fetch, calls } = stubFetch(okResponse(await makePng()));
    const provider = createCloudflareProvider({ accountId: 'acc', apiToken: 'tok', fetch });
    const image = { bytes: await makePng(), mime: 'image/png' };
    await provider.generate(
      baseRequest({ images: [image, image, image, image, image], seed: null }),
      new AbortController().signal,
    );
    const form = calls[0]!.init.body as FormData;
    expect(form.get('input_image_3')).not.toBeNull();
    expect(form.get('input_image_4')).toBeNull();
    expect(form.get('seed')).toBeNull();
  });

  it('rejects a reference image that cannot be read, without calling the API', async () => {
    const { fetch, calls } = stubFetch(okResponse(await makePng()));
    const provider = createCloudflareProvider({ accountId: 'acc', apiToken: 'tok', fetch });
    const readable = { bytes: await makePng(), mime: 'image/png' };
    const unreadable = { bytes: Buffer.from('not an image'), mime: 'image/png' };
    await expect(
      provider.generate(
        baseRequest({ mode: 'edit', images: [readable, unreadable] }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      name: 'ProviderError',
      code: 'INVALID_INPUT',
      retryable: false,
      message: 'A reference image could not be read. Replace it and run again.',
      detail: expect.any(String),
    });
    expect(calls).toHaveLength(0);
  });

  it('maps provider failures to ProviderError', async () => {
    const { fetch } = stubFetch(
      new Response('{"errors":[{"message":"Capacity temporarily exceeded"}]}', { status: 503 }),
    );
    const provider = createCloudflareProvider({ accountId: 'acc', apiToken: 'tok', fetch });
    await expect(provider.generate(baseRequest(), new AbortController().signal)).rejects.toMatchObject({
      name: 'ProviderError',
      retryable: true,
    });
  });

  it('rejects unexpected response bodies', async () => {
    const { fetch } = stubFetch(new Response('{"success":true}', { status: 200 }));
    const provider = createCloudflareProvider({ accountId: 'acc', apiToken: 'tok', fetch });
    await expect(provider.generate(baseRequest(), new AbortController().signal)).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });

  it('treats a response body that is not JSON as a retryable provider error', async () => {
    const { fetch } = stubFetch(new Response('<html>Bad gateway</html>', { status: 200 }));
    const provider = createCloudflareProvider({ accountId: 'acc', apiToken: 'tok', fetch });
    await expect(provider.generate(baseRequest(), new AbortController().signal)).rejects.toMatchObject({
      name: 'ProviderError',
      code: 'PROVIDER_ERROR',
      retryable: true,
    });
  });
});
