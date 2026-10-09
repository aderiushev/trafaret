import { expect, test } from '@playwright/test';
import { cards, openEditor, runButton } from './editor.ts';

test('retries a failed node and finishes the run', async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept()); // "Replace the current workflow?"
  await openEditor(page);
  await page.getByRole('combobox', { name: 'Load a template' }).selectOption('text-to-image');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);

  const generate = cards(page, 'generateImage');
  await generate.getByLabel('Model').selectOption('mock-fails-first');
  await runButton(page).click();
  await expect(generate.getByRole('alert')).toContainText('always fails its first attempt');
  await expect(cards(page, 'result').getByRole('alert')).toContainText('Skipped: Generate Image failed.');

  await generate.getByRole('button', { name: 'Retry' }).click();
  await expect(cards(page, 'result').getByRole('img', { name: 'Result' })).toBeVisible();
});
