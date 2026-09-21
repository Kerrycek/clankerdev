import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile support is redirected away from administrator-only package assignments', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  let packageAssignmentRequests = 0;
  await installHaveApiMock(page, {
    user: { id: 2, login: 'support', level: 21 },
    handlers: {
      'GET users/2': () => ({
        user: { id: 2, login: 'support', level: 21, full_name: 'Support Operator' },
      }),
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
      'GET user_cluster_resource_packages': () => {
        packageAssignmentRequests += 1;
        return { user_cluster_resource_packages: [] };
      },
    },
  });

  await page.goto('/admin/users/2/resources');

  await expect(page).toHaveURL('/admin/users/2');
  await expect(page.getByTestId('admin.user.page')).toBeVisible();
  await expect(page.getByRole('link', { name: /balíčky|packages/i })).toHaveCount(0);
  await expect(page.getByTestId('admin.user.resources.page')).toHaveCount(0);
  expect(packageAssignmentRequests).toBe(0);
});
