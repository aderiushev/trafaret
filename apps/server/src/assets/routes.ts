import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { assetParamsSchema, assetSchema, assetUrl, type Asset } from '@trafaret/core';
import { AppError } from '../http/errors.ts';
import { UnsupportedImageError, type AssetStore, type StoredAsset } from './asset-store.ts';
import { inspectImage } from './image.ts';

export const MAX_UPLOAD_SIDE = 4096;

export const toAssetResponse = (asset: StoredAsset): Asset => ({
  assetId: asset.id,
  url: assetUrl(asset.id),
  width: asset.width,
  height: asset.height,
});

const unsupportedImage = (): AppError =>
  new AppError(415, 'UNSUPPORTED_IMAGE', 'Only PNG, JPEG and WebP images are supported.');

export function registerAssetRoutes(
  app: FastifyInstance,
  options: { assets: AssetStore; uploadsPer10Minutes: number },
): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.post(
    '/api/assets',
    {
      config: { rateLimit: { max: options.uploadsPer10Minutes, timeWindow: '10 minutes' } },
      schema: {
        summary: 'Upload an image (PNG, JPEG or WebP, up to 10 MB) as the multipart field "file"',
        response: { 201: assetSchema },
      },
    },
    async (request, reply) => {
      const file = await request.file();
      if (!file) throw new AppError(400, 'NO_FILE', 'Attach an image in the "file" field.');
      const bytes = await file.toBuffer();
      const info = await inspectImage(bytes);
      if (!info) throw unsupportedImage();
      if (info.width > MAX_UPLOAD_SIDE || info.height > MAX_UPLOAD_SIDE) {
        throw new AppError(
          422,
          'IMAGE_TOO_LARGE',
          `Images must be at most ${MAX_UPLOAD_SIDE}×${MAX_UPLOAD_SIDE} px.`,
        );
      }
      // Header-only inspection lets a corrupt rotated photo through; storing it upright is what rejects it.
      const asset = await options.assets.put(bytes).catch((error: unknown) => {
        throw error instanceof UnsupportedImageError ? unsupportedImage() : error;
      });
      return reply.code(201).send(toAssetResponse(asset));
    },
  );

  routes.get('/api/assets/:assetId', { schema: { params: assetParamsSchema } }, (request, reply) => {
    const asset = options.assets.get(request.params.assetId);
    if (!asset)
      throw new AppError(404, 'ASSET_NOT_FOUND', 'This image is no longer available. Upload it again.');
    return reply
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('etag', `"${asset.id}"`)
      .type(asset.mime)
      .send(asset.bytes);
  });
}
