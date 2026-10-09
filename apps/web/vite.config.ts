import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The API server the dev proxy forwards /api to; the e2e run points it at its own server.
const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // The same loopback address as the API server, so the URL is the same everywhere.
  server: { host: '127.0.0.1', proxy: { '/api': apiOrigin } },
  // One editor screen: React, React Flow and zod ship as a single ~200 kB (gzip) bundle, which is fine here.
  build: { chunkSizeWarningLimit: 700 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
