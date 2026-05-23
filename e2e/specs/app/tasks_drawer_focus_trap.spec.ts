import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@smoke-mobile Tasks drawer traps focus and restores focus on close', async ({ page }) => {
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

  const closeBtn = page.getByTestId('tasks.close-button');
  await expect(closeBtn).toBeFocused();

  const focusInsideDrawer = async () =>
    page.evaluate(() => {
      const d = document.querySelector('[data-testid="tasks.drawer"]');
      if (!d) return false;
      return d.contains(document.activeElement);
    });

  // Shift+Tab from the first control should wrap to the last focusable inside the drawer.
  await page.keyboard.press('Shift+Tab');
  await expect.poll(focusInsideDrawer).toBe(true);

  // Tab must never escape the drawer.
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    await expect.poll(focusInsideDrawer).toBe(true);
  }

  // Close via Escape and ensure focus restores to the opener.
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(openBtn).toBeFocused();
});
