import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('admin users: empty state clears filters', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users': (ctx) => {
        const q = ctx.searchParams.get('user[q]');
        if (q === 'nomatch') return { users: [] };

        return {
          users: [
            {
              id: 11,
              login: 'alpha',
              full_name: 'Alpha User',
              email: 'alpha@example.test',
              level: 0,
              created_at: '2025-01-01T00:00:00Z',
              last_activity_at: '2025-01-02T00:00:00Z',
            },
          ],
        };
      },
    },
  });

  // Use a server-side filter that does not match any returned user.
  await page.goto('/admin/users?q=nomatch');

  await expect(page.getByTestId('admin.users.empty')).toBeVisible();

  // Clear filters from the empty state.
  await page.getByTestId('admin.users.empty.action').click();

  await expect(page.getByTestId('admin.users.row.11')).toBeVisible();
});
