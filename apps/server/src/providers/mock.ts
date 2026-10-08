import sharp from 'sharp';
import { ProviderError, type ImageProvider, type ProviderRequest } from './types.ts';

export const MOCK_FAILS_FIRST_MODEL = 'mock-fails-first';

export type MockProviderOptions = { latencyMs: { min: number; max: number } };

/** Deterministic placeholder images with realistic latency — the app works without any API key. */
export function createMockProvider(options: MockProviderOptions): ImageProvider {
  return {
    id: 'mock',
    async generate(request, signal) {
      await sleep(latencyFor(request, options.latencyMs), signal);
      if (request.model === MOCK_FAILS_FIRST_MODEL && request.attempt === 1) {
        throw new ProviderError(
          'PROVIDER_ERROR',
          'This mock model always fails its first attempt. Retry to see it succeed.',
          true,
        );
      }
      return { bytes: await renderMockImage(request) };
    },
  };
}

/** FNV-1a: a tiny, stable string hash. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abortReason = (): Error => (signal.reason instanceof Error ? signal.reason : new Error('Aborted'));
    if (signal.aborted) {
      reject(abortReason());
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortReason());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function latencyFor(request: ProviderRequest, range: { min: number; max: number }): number {
  const spread = range.max - range.min;
  return spread <= 0
    ? range.min
    : range.min + (hashString(`${request.prompt}|${request.seed ?? 0}`) % (spread + 1));
}

/** Characters XML 1.0 forbids even as references: one of them would make librsvg reject the whole image. */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

const escapeXml = (text: string): string =>
  text.replace(XML_ILLEGAL, '').replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function wrap(text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length > maxLines ? [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1] ?? ''}…`] : lines;
}

async function renderMockImage(request: ProviderRequest): Promise<Buffer> {
  const { width, height } = request;
  const hue = hashString(`${request.prompt}|${request.seed ?? 0}`) % 360;
  const fontSize = Math.round(Math.min(width, height) / 18);
  const lines = wrap(request.prompt, 34, 5);
  const text = lines
    .map((line, i) => {
      const y = height / 2 + (i - (lines.length - 1) / 2) * fontSize * 1.3;
      return `<text x="50%" y="${y}" font-size="${fontSize}" text-anchor="middle" fill="#ffffff" font-family="sans-serif">${escapeXml(line)}</text>`;
    })
    .join('');
  const label =
    `<text x="${fontSize}" y="${height - fontSize}" font-size="${Math.round(fontSize * 0.7)}" fill="#ffffff" ` +
    `fill-opacity="0.75" font-family="monospace">MOCK · ${request.mode} · seed ${request.seed ?? '–'}</text>`;

  const source = request.mode === 'edit' ? request.images[0] : undefined;
  if (source) {
    const overlay =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="100%" height="100%" fill="hsl(${hue}, 70%, 35%)" fill-opacity="0.45"/>${text}${label}</svg>`;
    return sharp(source.bytes)
      .resize(width, height, { fit: 'cover' })
      .composite([{ input: Buffer.from(overlay) }])
      .png()
      .toBuffer();
  }
  const scene =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue}, 70%, 55%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360}, 70%, 35%)"/>` +
    `</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${text}${label}</svg>`;
  return sharp(Buffer.from(scene)).png().toBuffer();
}
