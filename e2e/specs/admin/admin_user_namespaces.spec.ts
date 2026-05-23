import { test, expect } from '@playwright/test';

import { installHaveApiMock } from '../../fixtures/haveapi';

test('admin: user namespaces tool loads namespaces and maps', async ({ page }) => {
  await installHaveApiMock({
    page,
    authorizeUser: {
      user: {
        id: 1,
        login: 'admin',
        level: 100,
      },
    },
    handlers: {
      'GET user_namespaces': async () => ({
        user_namespaces: [
          { id: 101, size: 65536, user: { id: 11, login: 'alice' }, block_count: 3 },
          { id: 102, size: 131072, user: { id: 12, login: 'bob' }, block_count: 0 },
        ],
      }),
      'GET user_namespace_maps': async () => ({
        user_namespace_maps: [
          {
            id: 501,
            label: 'default',
            user_namespace: { id: 101, size: 65536, user: { id: 11, login: 'alice' } },
          },
        ],
      }),
    },
  });

  await page.goto('/admin/user-namespaces/namespaces');
  await expect(page.getByTestId('admin.userns.shell')).toBeVisible();
  await expect(page.getByTestId('admin.userns.namespaces.table')).toBeVisible();
  await expect(page.getByText('#101')).toBeVisible();

  await page.getByRole('link', { name: 'Maps' }).click();
  await expect(page).toHaveURL(/\/admin\/user-namespaces\/maps/);
  await expect(page.getByTestId('admin.userns.maps.table')).toBeVisible();
  await expect(page.getByText('#501')).toBeVisible();
});
