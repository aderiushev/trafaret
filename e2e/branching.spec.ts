import { expect, test } from '@playwright/test';
import { cards, openEditor, runButton, timeline } from './editor.ts';

test('runs both branches of the starter workflow at the same time', async ({ page }) => {
  await openEditor(page);
  await runButton(page).click();

  const results = cards(page, 'result');
  await expect(results.nth(0).getByRole('img', { name: 'Result' })).toBeVisible();
  await expect(results.nth(1).getByRole('img', { name: 'Result' })).toBeVisible();
  await expect(timeline(page)).toContainText('2 AI calls');

  const bars = timeline(page).locator('[data-bar]');
  await expect(bars).toHaveCount(2);
  const [a, b] = await Promise.all([bars.nth(0).boundingBox(), bars.nth(1).boundingBox()]);
  if (!a || !b) throw new Error('The timeline bars are not visible.');
  // Both Generate nodes depend only on the prompt, so their bars overlap in time.
  expect(a.x < b.x + b.width && b.x < a.x + a.width).toBe(true);
});
