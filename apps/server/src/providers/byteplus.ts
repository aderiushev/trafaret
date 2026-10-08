import { z } from 'zod';
import { postToProvider, readJson, unexpectedResponse } from './http.ts';
import type { ImageProvider } from './types.ts';

export const BYTEPLUS_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';

const responseSchema = z.object({ data: z.array(z.object({ b64_json: z.string().min(1) })).min(1) });

export type BytePlusProviderOptions = { apiKey: string; fetch?: typeof fetch; baseUrl?: string };

export function createBytePlusProvider(options: BytePlusProviderOptions): ImageProvider {
  const fetchFn = options.fetch ?? fetch;
  const baseUrl = options.baseUrl ?? BYTEPLUS_BASE_URL;
  return {
    id: 'byteplus',
    async generate(request, signal) {
      const body = {
        model: request.model,
        prompt: request.prompt,
        size: `${request.width}x${request.height}`,
        response_format: 'b64_json',
        watermark: false,
        sequential_image_generation: 'disabled',
        ...(request.images.length > 0
          ? {
              image: request.images.map(
                (image) => `data:${image.mime};base64,${image.bytes.toString('base64')}`,
              ),
            }
          : {}),
      };
      const response = await postToProvider(fetchFn, `${baseUrl}/images/generations`, {
        headers: { authorization: `Bearer ${options.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
      const parsed = responseSchema.safeParse(await readJson(response));
      const first = parsed.success ? parsed.data.data[0] : undefined;
      if (!first) throw unexpectedResponse();
      return { bytes: Buffer.from(first.b64_json, 'base64') };
    },
  };
}
