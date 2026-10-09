import { expect, type Locator, type Page } from '@playwright/test';

/** Opens the editor as a first-time visitor: the starter workflow, "One prompt, two styles", is on the canvas. */
export async function openEditor(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.react-flow__node')).toHaveCount(5);
}

/** Cards of one node type, in the order of the workflow's nodes. */
export const cards = (page: Page, type: string): Locator => page.locator(`.react-flow__node-${type}`);

export const runButton = (page: Page): Locator => page.getByRole('button', { name: 'Run', exact: true });

export const timeline = (page: Page): Locator => page.getByRole('region', { name: 'Run timeline' });
