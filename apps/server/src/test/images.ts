import sharp from 'sharp';

/** A solid-colour PNG for tests. */
export async function makePng(width = 8, height = 8, color = '#ff5f1f'): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } })
    .png()
    .toBuffer();
}

/** A 40x20 JPEG tagged with EXIF orientation 6, so it displays as a 20x40 portrait photo. */
export async function makeRotatedJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 20, channels: 3, background: '#123456' } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
}
