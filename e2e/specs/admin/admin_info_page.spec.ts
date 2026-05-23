import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('admin info page: renders diagnostics and shortcuts', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
  });

  await page.goto('/admin/admin-info');

  await expect(page.getByTestId('admin.info.page')).toBeVisible();
  await expect(page.getByTestId('admin.info.header')).toBeVisible();

  await expect(page.getByTestId('admin.info.session.card')).toBeVisible();
  await expect(page.getByTestId('admin.info.runtime.card')).toBeVisible();
  await expect(page.getByTestId('admin.info.shortcuts.card')).toBeVisible();

  await expect(page.getByTestId('admin.info.shortcuts.users')).toHaveAttribute('href', '/admin/users');
  await expect(page.getByTestId('admin.info.shortcuts.ip_addresses')).toHaveAttribute('href', '/admin/ip-addresses');
});
