/**
 * Writes simple generated images for preset references and the sample photo, so the server works before the real
 * AI-generated assets exist (Phase 3 replaces them). Run: node apps/server/scripts/make-placeholder-assets.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

type Placeholder = { path: string; label: string; from: string; to: string };

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'library');

const placeholders: Placeholder[] = [
  { path: 'presets/references/premium-3d-1.webp', label: 'Premium 3D · 1', from: '#f6d5e5', to: '#c7d2fe' },
  { path: 'presets/references/premium-3d-2.webp', label: 'Premium 3D · 2', from: '#fde68a', to: '#fbcfe8' },
  { path: 'presets/references/lifestyle-1.webp', label: 'Lifestyle · 1', from: '#fcd34d', to: '#f97316' },
  { path: 'presets/references/lifestyle-2.webp', label: 'Lifestyle · 2', from: '#a7f3d0', to: '#facc15' },
  { path: 'presets/references/paper-craft-1.webp', label: 'Paper Craft · 1', from: '#fca5a5', to: '#93c5fd' },
  { path: 'presets/references/paper-craft-2.webp', label: 'Paper Craft · 2', from: '#c4b5fd', to: '#86efac' },
  { path: 'samples/sample-product.webp', label: 'Sample product', from: '#e5e7eb', to: '#9ca3af' },
];

const svg = ({ label, from, to }: Placeholder): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">` +
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
  `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
  `<rect width="512" height="512" fill="url(#g)"/>` +
  `<text x="256" y="268" font-family="sans-serif" font-size="40" text-anchor="middle" fill="#1b1c1f">${label}</text>` +
  `</svg>`;

for (const placeholder of placeholders) {
  const target = join(root, placeholder.path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(
    target,
    await sharp(Buffer.from(svg(placeholder)))
      .webp({ quality: 90 })
      .toBuffer(),
  );
  console.log(`wrote ${placeholder.path}`);
}
