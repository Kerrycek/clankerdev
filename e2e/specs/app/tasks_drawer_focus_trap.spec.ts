import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile @smoke @smoke-mobile Tasks drawer opens as a non-modal side panel', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'test', level: 1 },
    handlers: {
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
    },
  });

  await page.goto('/app/vps');

  const openBtn = page.getByTestId('tasks.open-button');
  await expect(openBtn).toBeVisible();

  await openBtn.focus();
  await expect(openBtn).toBeFocused();

  await openBtn.click();

  const drawer = page.getByTestId('tasks.drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute('aria-modal', 'false');
  await expect(page.locator('[data-overlay-backdrop="true"]')).toHaveCount(0);

  const closeBtn = page.getByTestId('tasks.close-button');
  await expect(closeBtn).toBeVisible();

  // The Tasks drawer is intentionally non-modal: the current page remains visible and usable behind it.
  await expect(page.getByTestId('vps.list')).toBeVisible();
  await expect(openBtn).toBeVisible();

  // Escape still closes the panel without navigating away from the underlying page.
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/app\/vps(?:\?.*)?$/);
});
