import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock } from '../../fixtures';

test('@smoke admin user detail: ErrorState retry recovers after a transient API failure', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  let calls = 0;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/42': () => {
        calls += 1;
        if (calls === 1) {
          return failEnvelope('Temporary failure');
        }

        return {
          user: {
            id: 42,
            login: 'alice',
            level: 1,
            full_name: 'Alice Example',
            email: 'alice@example.test',
            created_at: '2026-02-01T00:00:00.000Z',
            last_activity_at: '2026-02-02T00:00:00.000Z',
          },
        };
      },
    },
  });

  await page.goto('/admin/users/42');

  await expect(page.getByTestId('admin.user.page')).toBeVisible();

  await expect(page.getByTestId('admin.user.error')).toBeVisible();
  await expect(page.getByTestId('admin.user.error.retry')).toBeVisible();
  await expect(page.getByTestId('admin.user.error.back')).toHaveAttribute('href', '/admin/users');

  await page.getByTestId('admin.user.error.retry').click();

  await expect(page.getByTestId('admin.user.header')).toBeVisible();
});
