import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('admin user: environment configs tab loads and can save', async ({ page }) => {
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

      'GET users/42/environment_configs': () => ({
        environment_configs: [
          {
            id: 1,
            default: true,
            environment: { id: 1, label: 'prod' },
            can_create_vps: true,
            can_destroy_vps: true,
            vps_lifetime: 0,
            max_vps_count: 0,
          },
          {
            id: 2,
            default: false,
            environment: { id: 2, label: 'test' },
            can_create_vps: true,
            can_destroy_vps: false,
            vps_lifetime: 86400,
            max_vps_count: 3,
          },
        ],
      }),

      'PUT users/42/environment_configs/1': () => ({
        environment_config: { id: 1 },
      }),
    },
  });

  await page.goto('/admin/users/42/environment-configs');

  await expect(page.getByTestId('admin.user.page')).toBeVisible();
  await expect(page.getByTestId('admin.user.env_configs.table')).toBeVisible();

  await expect(page.getByTestId('admin.user.env_configs.row.1')).toBeVisible();

  await page.getByTestId('admin.user.env_configs.row.1.edit').click();
  await expect(page.getByTestId('admin.user.env_configs.modal')).toBeVisible();

  // Switch from inherited -> custom
  await page.getByTestId('admin.user.env_configs.modal.inherit').click();

  await page.getByTestId('admin.user.env_configs.modal.vps_lifetime_days').fill('10');
  await page.getByTestId('admin.user.env_configs.modal.max_vps').fill('5');

  await page.getByTestId('admin.user.env_configs.modal.save').click();

  await expect(page.getByTestId('admin.user.env_configs.modal')).toBeHidden();
});
