import { expect, test } from '@playwright/test';

import { expectSignedInShell } from './signedInShell.js';

test('signed-in shell shows logout', async ({ page }) => {
  await expectSignedInShell(page);
});

test('created loadout is still there after reload', async ({ page }) => {
  const name = 'E2E Loadout';
  await page.goto('/builder/my-builds');
  await expect(page.getByRole('button', { name: 'New Loadout' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'New Loadout' }).click();
  await page.getByPlaceholder('Loadout name...').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(name).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(name).first()).toBeVisible();
});
