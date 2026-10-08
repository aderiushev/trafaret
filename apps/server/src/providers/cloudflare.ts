import { z } from 'zod';
import { fitWithin } from '../assets/image.ts';
import { postToProvider, readJson } from './http.ts';
import { ProviderError, type ImageProvider, type ProviderImage } from './types.ts';

const MAX_INPUT_IMAGES = 4;
/** The model requires reference images smaller than 512×512. */
const MAX_INPUT_SIDE = 511;

const responseSchema = z.object({ result: z.object({ image: z.string().min(1) }) });

export type CloudflareProviderOptions = { accountId: string; apiToken: string; fetch?: typeof fetch };

export function createCloudflareProvider(options: CloudflareProviderOptions): ImageProvider {
  const fetchFn = options.fetch ?? fetch;
  return {
    id: 'cloudflare',
    async generate(request, signal) {
      const form = new FormData();
      form.set('prompt', request.prompt);
      form.set('width', String(request.width));
      form.set('height', String(request.height));
      if (request.seed !== null) form.set('seed', String(request.seed));
      const inputs = await shrinkReferences(request.images);
      inputs.forEach((bytes, index) => {
        form.set(
          `input_image_${index}`,
          new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
          `input-${index}.png`,
        );
      });

      const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.accountId)}/ai/run/${request.model}`;
      const response = await postToProvider(fetchFn, url, {
        headers: { authorization: `Bearer ${options.apiToken}` },
        body: form,
        signal,
      });
      const parsed = responseSchema.safeParse(await readJson(response));
      if (!parsed.success) {
        throw new ProviderError(
          'PROVIDER_ERROR',
          'The AI service returned an unexpected response. Retry in a few seconds.',
          true,
          JSON.stringify(parsed.error.issues).slice(0, 500),
        );
      }
      return { bytes: Buffer.from(parsed.data.result.image, 'base64') };
    },
  };
}

/**
 * Keeps the first four references and shrinks each to what the model accepts.
 * An image that cannot be decoded fails the request as a non-retryable input error.
 */
async function shrinkReferences(images: readonly ProviderImage[]): Promise<Buffer[]> {
  try {
    return await Promise.all(
      images.slice(0, MAX_INPUT_IMAGES).map((image) => fitWithin(image.bytes, MAX_INPUT_SIDE)),
    );
  } catch (error) {
    throw new ProviderError(
      'INVALID_INPUT',
      'A reference image could not be read. Replace it and run again.',
      false,
      error instanceof Error ? error.message : 'unreadable reference image',
    );
  }
}
