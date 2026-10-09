import { expect, test } from '@playwright/test';
import { cards, openEditor, runButton, timeline } from './editor.ts';

test('re-renders only the branch whose preset changed', async ({ page }) => {
  await openEditor(page);
  await runButton(page).click();
  await expect(timeline(page)).toContainText('Completed');

  const generateA = cards(page, 'generateImage').nth(0);
  const generateB = cards(page, 'generateImage').nth(1);
  await generateB.getByLabel('Preset').selectOption('paper-craft');
  await expect(generateB.getByText('● edited')).toBeVisible();

  await runButton(page).click();
  await expect(timeline(page)).toContainText('1 reused');
  await expect(generateA.getByText('⚡ reused')).toBeVisible();
  await expect(generateB.getByText('⚡ reused')).toHaveCount(0);
  await expect(cards(page, 'result').nth(1).getByRole('img', { name: 'Result' })).toBeVisible();
});
