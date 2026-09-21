import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile support sees user details without administrator mutation controls', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  let updateRequests = 0;
  await installHaveApiMock(page, {
    user: { id: 2, login: 'support', level: 21 },
    handlers: {
      'GET users/2': () => ({
        user: {
          id: 2,
          login: 'support',
          level: 21,
          full_name: 'Support Operator',
          email: 'support@example.test',
          object_state: 'active',
        },
      }),
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
      'PUT users/2': () => {
        updateRequests += 1;
        return { user: { id: 2, login: 'support', level: 21 } };
      },
    },
  });

  await page.goto('/admin/users/2');

  await expect(page.getByTestId('admin.user.details.card')).toContainText('Support Operator');
  await expect(page.getByTestId('admin.user.edit.open')).toHaveCount(0);
  await expect(page.getByTestId('admin.user.edit.drawer')).toHaveCount(0);
  await expect(page.getByTestId('admin.user.account_actions.card')).toHaveCount(0);
  await expect(page.getByTestId('admin.user.lifecycle.form')).toHaveCount(0);
  expect(updateRequests).toBe(0);
});
