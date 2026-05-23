import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('admin ip address detail: shows header and links to user/vps', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET ip_addresses/100': () => ({
        ip_address: {
          id: 100,
          addr: '203.0.113.10',
          prefix: 32,
          routed: true,
          created_at: '2026-02-01T00:00:00.000Z',
          network: { id: 3, address: '203.0.113.0', prefix: 24 },
          vps: { id: 5 },
          user: { id: 42 },
        },
      }),
    },
  });

  await page.goto('/admin/ip-addresses/100');

  await expect(page.getByTestId('admin.ip_address.page')).toBeVisible();
  await expect(page.getByTestId('admin.ip_address.header')).toBeVisible();

  await expect(page.getByTestId('admin.ip.action.vps')).toHaveAttribute('href', '/admin/vps/5');
  await expect(page.getByTestId('admin.ip.action.user')).toHaveAttribute('href', '/admin/users/42');

  await expect(page.getByTestId('admin.ip_address.refresh')).toBeVisible();
});
