import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke @smoke-mobile Header controls', () => {
  test('exposes search, tasks and account controls (touch targets on mobile)', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
      },
    });

    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();

    await expect(page.getByTestId('shell.header')).toBeVisible();

    const search = page.getByTestId('palette.open');
    const tasks = page.getByTestId('tasks.open-button');
    const account = page.getByTestId('shell.user-menu-button');
    const nav = page.getByTestId('shell.mobile-nav-button');

    await expect(search).toBeVisible();
    await expect(tasks).toBeVisible();
    await expect(account).toBeVisible();

    if (testInfo.project.name === 'mobile-chrome') {
      await expect(nav).toBeVisible();

      for (const loc of [search, tasks, account]) {
        const box = await loc.boundingBox();
        expect(box).not.toBeNull();
        // Minimum 44x44 CSS px touch target.
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    } else {
      await expect(nav).toBeHidden();
    }

    await account.click();
    await expect(page.getByTestId('shell.user-menu')).toBeVisible();
    await expect(page.getByTestId('shell.user-menu.account')).toBeVisible();
    await expect(page.getByTestId('shell.user-menu.public-status')).toBeVisible();
    await expect(page.getByTestId('shell.user-menu.logout')).toBeVisible();
  });
});
