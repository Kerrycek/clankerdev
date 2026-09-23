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
  const row = page.locator('[data-testid="admin.user.env_configs.row.1"]:visible');
  await expect(row).toBeVisible();

  // Switch from inherited -> custom
  await row.getByTestId('admin.user.env_configs.row.1.mode').selectOption('custom');

  await row.getByTestId('admin.user.env_configs.row.1.vps_lifetime_days').fill('10');
  await row.getByTestId('admin.user.env_configs.row.1.max_vps').fill('5');

  await row.getByTestId('admin.user.env_configs.row.1.save').click();

  await expect(row.getByTestId('admin.user.env_configs.row.1.save')).toBeDisabled();
});

test('@pr-smoke @pr-smoke-mobile admin user: failed environment config save stays with its row and can retry', async ({
  page,
}) => {
  await bootstrapVpsAdminWindow(page);

  let saveAttempts = 0;

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
      'PUT users/42/environment_configs/1': () => {
        saveAttempts += 1;
        if (saveAttempts === 1) {
          return {
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              status: false,
              message: 'Environment config changed on the server',
              response: null,
            }),
          };
        }

        return { environment_config: { id: 1 } };
      },
    },
  });

  await page.goto('/admin/users/42/environment-configs');

  const row = page.locator('[data-testid="admin.user.env_configs.row.1"]:visible');
  const otherRow = page.locator('[data-testid="admin.user.env_configs.row.2"]:visible');
  const mode = row.getByTestId('admin.user.env_configs.row.1.mode');
  const lifetime = row.getByTestId('admin.user.env_configs.row.1.vps_lifetime_days');
  const maxVps = row.getByTestId('admin.user.env_configs.row.1.max_vps');
  const save = row.getByTestId('admin.user.env_configs.row.1.save');

  await mode.selectOption('custom');
  await lifetime.fill('10');
  await maxVps.fill('5');
  await save.click();

  const error = row.getByTestId('admin.user.env_configs.row.1.save_error');
  await expect(error).toContainText('Environment config changed on the server');
  await expect(lifetime).toHaveValue('10');
  await expect(maxVps).toHaveValue('5');
  await expect(otherRow.getByTestId('admin.user.env_configs.row.2.save_error')).toHaveCount(0);

  await save.click();

  await expect(error).toHaveCount(0);
  await expect(save).toBeDisabled();
  expect(saveAttempts).toBe(2);
});
