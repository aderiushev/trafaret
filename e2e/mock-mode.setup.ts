import { expect, test as setup } from '@playwright/test';

type CatalogModel = { id: string; provider: string; enabled: boolean };

// Every scenario depends on this check: if a provider key ever reaches the e2e server, nothing runs.
setup('the server offers mock models only', async ({ request }) => {
  const response = await request.get('/api/catalog');
  expect(response.ok()).toBe(true);
  const { models } = (await response.json()) as { models: CatalogModel[] };
  // The Mock model is always enabled. If the check can't see it, the catalog's shape has changed and the check
  // below would pass without checking anything.
  expect(models.some((model) => model.provider === 'mock' && model.enabled)).toBe(true);
  const real = models.filter((model) => model.enabled && model.provider !== 'mock').map((model) => model.id);
  expect(real, 'a real model is enabled — blank its key in playwright.config.ts').toEqual([]);
});
