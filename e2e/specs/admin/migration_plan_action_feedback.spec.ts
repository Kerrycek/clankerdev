import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile rejected migration plan actions stay in their dialog for retry', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'MIGRATION_PLAN_ACTION_RETRY' });

  let attempts = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET migration_plans/2': () => ({
        migration_plan: {
          id: 2,
          state: 'staged',
          locked: false,
          concurrency: 2,
          stop_on_error: true,
          use_maintenance_windows: false,
          cleanup_data: false,
          send_mail: false,
          reason: null,
        },
      }),
      'GET migration_plans/2/vps_migrations': () => [],
      'GET nodes': () => [{ id: 1, domain_name: 'node1.example' }],
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'POST migration_plans/2/start': () => {
        attempts += 1;
        if (attempts === 1) return failEnvelope('Migration plan start was rejected');
        return { migration_plan: { id: 2, state: 'running' }, _meta: { action_state_id: 702 } };
      },
    },
  });

  await page.goto('/admin/migration-plans/2');
  await page.getByTestId('admin.migration_plan.start').click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /start|spustit/i }).click();
  await expect(dialog).toContainText('Migration plan start was rejected');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: /start|spustit/i }).click();
  await expect(dialog).toHaveCount(0);
  expect(attempts).toBe(2);
});
