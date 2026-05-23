import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('admin users: keyset pagination (from_id)', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users': (ctx) => {
        const fromId = ctx.searchParams.get('user[from_id]');
        const limitStr = ctx.searchParams.get('user[limit]');
        const limit = limitStr ? Number(limitStr) : 50;

        const startId = fromId ? Number(fromId) - 1 : 125;
        const count = Number.isFinite(limit) && limit > 0 ? limit : 50;

        const users = Array.from({ length: count }, (_, i) => {
          const id = startId - i;
          return {
            id,
            login: `user${id}`,
            full_name: `User ${id}`,
            email: `user${id}@example.test`,
            level: id % 3 === 0 ? 100 : 1,
            lockout: id === 125,
            password_reset: id === 124,
            enable_multi_factor_auth: id === 123,
            mailer_enabled: id !== 122,
            last_activity_at: '2026-01-01T00:00:00Z',
            created_at: '2025-01-01T00:00:00Z',
          };
        }).filter((u) => u.id > 0);

        return { users };
      },
    },
  });

  await page.goto('/admin/users');

  await expect(page.getByTestId('admin.users.row.125')).toBeVisible();
  await expect(page.getByTestId('admin.users.row.125')).toHaveAttribute('data-row-variant', 'danger');
  await expect(page.getByTestId('admin.users.row.125.dot')).toBeVisible();
  await expect(page.getByTestId('admin.users.row.124')).toHaveAttribute('data-row-variant', 'warn');
  await expect(page.getByTestId('admin.users.row.123.dot')).toBeVisible();

  await page.getByTestId('admin.users.pagination.desktop.next').click();
  await expect(page.getByTestId('admin.users.row.75')).toBeVisible();

  await page.getByTestId('admin.users.pagination.desktop.prev').click();
  await expect(page.getByTestId('admin.users.row.125')).toBeVisible();
});
