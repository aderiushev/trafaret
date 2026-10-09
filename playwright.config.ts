import { defineConfig, devices } from '@playwright/test';

// Ports of their own, so a running `pnpm dev` (which may have real API keys) is never reused.
const API_PORT = 8090;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: 'e2e',
  // One server for every test; a single worker keeps their jobs from queueing behind each other.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  expect: { timeout: 10_000 },
  use: { baseURL: `http://127.0.0.1:${WEB_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @trafaret/server start',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: {
        NODE_ENV: 'development',
        HOST: '127.0.0.1',
        PORT: String(API_PORT),
        LOG_LEVEL: 'warn',
        MOCK_LATENCY_MS: '800-1200',
        // The branching scenario needs both Generate nodes running at once.
        MAX_CONCURRENT_JOBS: '4',
        // Mock mode whatever the shell exports: a test never calls a real, paid model.
        CLOUDFLARE_ACCOUNT_ID: '',
        CLOUDFLARE_API_TOKEN: '',
        ARK_API_KEY: '',
      },
      reuseExistingServer: false,
    },
    {
      command: `pnpm --filter @trafaret/web exec vite --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      env: { API_ORIGIN: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
