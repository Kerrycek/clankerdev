import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('admin user resource usage and package assignment are separate', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/53': () => ({ user: { id: 53, login: 'kavman', level: 1 } }),
      'GET environments': () => ({ environments: [{ id: 7, label: 'Production' }, { id: 8, label: 'Playground' }] }),
      'GET cluster_resource_packages': () => ({ cluster_resource_packages: [{ id: 11, label: 'Standard Production' }] }),
      'GET user_cluster_resource_packages': () => ({ user_cluster_resource_packages: [
        { id: 20, environment: { id: 7, label: 'Production' }, cluster_resource_package: { id: 11, label: 'Standard Production' } },
        { id: 21, environment: { id: 8, label: 'Playground' }, cluster_resource_package: { id: 11, label: 'Standard Production' } },
      ] }),
      'GET users/53/cluster_resources': () => ({ cluster_resources: [{ id: 31, environment: { id: 7, label: 'Production' }, cluster_resource: { id: 2, name: 'cpu', label: 'CPU', stepsize: 1 }, value: 4, used: 2, free: 2 }] }),
      'GET users/1/cluster_resources': () => ({ cluster_resources: [{ id: 32, environment: { id: 7, label: 'Production' }, cluster_resource: { id: 2, name: 'cpu', label: 'CPU' }, value: 4, used: 1, free: 3 }] }),
      'GET cluster_resource_packages/11/items': () => ({ items: [{ id: 5, value: 4, cluster_resource: { id: 2, label: 'CPU' } }] }),
      'POST user_cluster_resource_packages': () => ({ user_cluster_resource_package: { id: 21 } }),
    },
  });

  await page.goto('/admin/users/53/resources/usage');
  await expect(page.getByTestId('admin.user.resource_usage.page')).toBeVisible();
  await expect(page.getByTestId('admin.user.resource_usage.resources.environment.7')).toContainText('CPU');
  await expect(page.getByTestId('admin.user.resource_usage.resources.environment.7')).toContainText('2');

  await page.goto('/admin/users/53/resources');
  await expect(page.getByTestId('admin.user.resources.page')).toBeVisible();
  await expect(page.getByRole('heading', { name: /přiřazené balíčky|assigned packages/i })).toBeVisible();
  await expect(page.getByTestId('admin.user.resources.summary')).toContainText('Standard Production');
  await expect(page.getByTestId('admin.user.resources.summary')).toContainText(/2[× ]+(přiděleno|assigned)/i);
  await expect(page.getByTestId('admin.user.resources.environment.7')).toContainText('Standard Production');

  await page.getByTestId('admin.user.resources.add').click();
  const modal = page.getByTestId('admin.user.resources.add.modal');
  await modal.getByRole('combobox').nth(0).selectOption('7');
  await modal.getByRole('combobox').nth(1).selectOption('11');
  await page.getByRole('button', { name: /přidat balíček|add package/i }).last().click();

  await page.goto('/app/profile/resources');
  await expect(page.getByTestId('profile.resources.page')).toBeVisible();
  await expect(page.getByTestId('profile.resources.usage.environment.7')).toContainText('CPU');
  await expect(page.getByTestId('profile.resources.page')).not.toContainText(/přidat balíček|add package/i);
});
