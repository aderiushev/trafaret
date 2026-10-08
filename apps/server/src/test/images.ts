import sharp from 'sharp';

/** A solid-colour PNG for tests. */
export async function makePng(width = 8, height = 8, color = '#ff5f1f'): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } })
    .png()
    .toBuffer();
}
