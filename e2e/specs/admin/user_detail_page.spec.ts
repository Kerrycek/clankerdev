import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('admin user detail: shows header and shortcut links', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/42': () => ({
        user: {
          id: 42,
          login: 'alice',
          level: 1,
          full_name: 'Alice Example',
          email: 'alice@example.test',
          created_at: '2026-02-01T00:00:00.000Z',
          last_activity_at: '2026-02-02T00:00:00.000Z',
          address: 'Example street\nExample city',
        },
      }),
    },
  });

  await page.goto('/admin/users/42');

  await expect(page.getByTestId('admin.user.page')).toBeVisible();
  await expect(page.getByTestId('admin.user.header')).toBeVisible();

  await expect(page.getByTestId('admin.user.action.vps')).toHaveAttribute('href', '/admin/vps?user=42');
  await expect(page.getByTestId('admin.user.action.datasets')).toHaveAttribute('href', '/admin/datasets?user=42');
  await expect(page.getByTestId('admin.user.action.dns')).toHaveAttribute('href', '/admin/dns?user=42');
  await expect(page.getByTestId('admin.user.action.requests')).toHaveAttribute('href', '/admin/requests?user=42');
  await expect(page.getByTestId('admin.user.action.user_namespaces')).toHaveAttribute('href', '/admin/user-namespaces/maps?user=42');

  await expect(page.getByTestId('admin.user.refresh')).toBeVisible();
});
