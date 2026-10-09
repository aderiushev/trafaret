import { expect, test } from '@playwright/test';
import { cards, openEditor, runButton, timeline } from './editor.ts';

test('runs both branches of the starter workflow at the same time', async ({ page }) => {
  await openEditor(page);
  await runButton(page).click();

  const results = cards(page, 'result');
  await expect(results.nth(0).getByRole('img', { name: 'Result' })).toBeVisible();
  await expect(results.nth(1).getByRole('img', { name: 'Result' })).toBeVisible();
  await expect(timeline(page)).toContainText('2 AI calls');
  // Measure once the run is over, so the timeline's span no longer grows.
  await expect(timeline(page)).toContainText('Completed');

  const bars = timeline(page).locator('[data-bar]');
  await expect(bars).toHaveCount(2);
  const [a, b] = await Promise.all([bars.nth(0).boundingBox(), bars.nth(1).boundingBox()]);
  if (!a || !b) throw new Error('The timeline bars are not visible.');
  // Both Generate nodes depend only on the prompt, so they run at the same time and the shorter bar lies mostly
  // inside the longer one. Run one after the other, the bars would merely touch.
  const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  expect(overlap).toBeGreaterThan(0.5 * Math.min(a.width, b.width));
});
