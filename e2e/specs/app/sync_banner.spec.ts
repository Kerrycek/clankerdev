import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Sync banner', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
    });
  });

  test('shows a page banner when Tier A sync fails', async ({ page }) => {
    // Break background sync (Tier A) – AppLayout should switch to syncStatus=error.
    await page.route('**/api/app/action_states?**', (route) => route.fulfill({ status: 500 }));

    await page.goto('/app/vps');

    await expect(page.getByTestId('sync.banner')).toBeVisible();
    await expect(page.getByTestId('sync.banner.retry')).toBeVisible();
    await expect(page.getByTestId('sync.banner.reload')).toBeVisible();

    // The compact indicator should also still be present in the shell.
    await expect(page.getByTestId('shell.sync-indicator')).toBeVisible();
  });
});
