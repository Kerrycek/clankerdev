import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('admin user resources show assigned package limits and allow assignment', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/53': () => ({ user: { id: 53, login: 'kavman', level: 1 } }),
      'GET environments': () => ({ environments: [{ id: 7, label: 'Production' }] }),
      'GET cluster_resource_packages': () => ({ cluster_resource_packages: [{ id: 11, label: 'Standard Production' }] }),
      'GET user_cluster_resource_packages': () => ({ user_cluster_resource_packages: [{ id: 20, environment: { id: 7, label: 'Production' }, cluster_resource_package: { id: 11, label: 'Standard Production' } }] }),
      'GET cluster_resource_packages/11/items': () => ({ items: [{ id: 5, value: 4, cluster_resource: { id: 2, label: 'CPU' } }] }),
      'POST user_cluster_resource_packages': () => ({ user_cluster_resource_package: { id: 21 } }),
    },
  });

  await page.goto('/admin/users/53/resources');
  await expect(page.getByTestId('admin.user.resources.page')).toBeVisible();
  await expect(page.getByText('Standard Production')).toBeVisible();
  await expect(page.getByText('CPU: 4')).toBeVisible();

  await page.getByTestId('admin.user.resources.add').click();
  const modal = page.getByTestId('admin.user.resources.add.modal');
  await modal.getByRole('combobox').nth(0).selectOption('7');
  await modal.getByRole('combobox').nth(1).selectOption('11');
  await page.getByRole('button', { name: /přidat balíček|add package/i }).last().click();
});
