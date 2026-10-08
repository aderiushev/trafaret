import sharp from 'sharp';
import { ASPECT_RATIOS, type AspectRatio } from '@trafaret/core';

export type ImageFormat = 'png' | 'jpeg' | 'webp';
export type ImageInfo = {
  format: ImageFormat;
  mime: string;
  width: number;
  height: number;
  /** EXIF orientation: 1 is upright, and 1 is also reported when the tag is absent. */
  orientation: number;
};

const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};
const isSupported = (format: string | undefined): format is ImageFormat =>
  format === 'png' || format === 'jpeg' || format === 'webp';

/**
 * Reads the real format from the bytes (never trusts a file name or Content-Type). SVG is rejected on purpose.
 * width and height are the displayed size: EXIF orientations 5 to 8 turn the image by 90 degrees, so they swap.
 * Header-only and without a pixel limit, so a huge image still reports its size.
 */
export async function inspectImage(bytes: Buffer): Promise<ImageInfo | null> {
  try {
    const {
      format,
      width,
      height,
      orientation = 1,
    } = await sharp(bytes, { limitInputPixels: false }).metadata();
    if (!isSupported(format) || !width || !height) return null;
    const swapsAxes = orientation >= 5;
    return {
      format,
      mime: MIME_BY_FORMAT[format],
      width: swapsAxes ? height : width,
      height: swapsAxes ? width : height,
      orientation,
    };
  } catch {
    return null;
  }
}

export const toWebp = (bytes: Buffer, quality = 90): Promise<Buffer> =>
  sharp(bytes).webp({ quality }).toBuffer();

/** Applies the EXIF orientation to the pixels and drops the tag, keeping the format. */
export const uprightImage = (bytes: Buffer): Promise<Buffer> => sharp(bytes).autoOrient().toBuffer();

/** Applies the EXIF orientation, then shrinks (never enlarges) to fit a square box; re-encodes as PNG. */
export const fitWithin = (bytes: Buffer, maxSide: number): Promise<Buffer> =>
  sharp(bytes)
    .autoOrient()
    .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

const RATIO_VALUES: Record<AspectRatio, number> = {
  '1:1': 1,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
};

/** The supported aspect ratio closest to width/height, compared on a log scale so 2:1 and 1:2 are symmetric. */
export function closestAspectRatio(width: number, height: number): AspectRatio {
  const target = Math.log(width / height);
  const distance = (ratio: AspectRatio): number => Math.abs(Math.log(RATIO_VALUES[ratio]) - target);
  return ASPECT_RATIOS.reduce((best, ratio) => (distance(ratio) < distance(best) ? ratio : best));
}
