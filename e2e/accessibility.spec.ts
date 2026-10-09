import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cards, openEditor, runButton, timeline } from './editor.ts';

/** axe's findings for WCAG 2.2 A and AA plus its best practices, one line per rule and the elements it flags. */
async function accessibilityProblems(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  return violations.map(
    (rule) => `${rule.id}: ${rule.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
}

test('the editor passes an accessibility scan when idle, after a run and with a failed node', async ({
  page,
}) => {
  page.on('dialog', (dialog) => void dialog.accept()); // "Replace the current workflow?"
  await openEditor(page);
  expect(await accessibilityProblems(page)).toEqual([]);

  // A finished run, with a node selected: the inspector shows the request it sent to the AI.
  await runButton(page).click();
  await expect(timeline(page)).toContainText('Completed');
  await cards(page, 'generateImage')
    .first()
    .click({ position: { x: 20, y: 12 } });
  expect(await accessibilityProblems(page)).toEqual([]);

  // A failed node: error messages, Retry buttons and a failed timeline row.
  await page.getByRole('combobox', { name: 'Load a template' }).selectOption('text-to-image');
  const generate = cards(page, 'generateImage');
  await generate.getByLabel('Model').selectOption('mock-fails-first');
  await runButton(page).click();
  await expect(generate.getByRole('alert')).toContainText('always fails its first attempt');
  expect(await accessibilityProblems(page)).toEqual([]);
});
