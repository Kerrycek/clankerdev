import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('admin migration plan detail: busy transaction gates start', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
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
      'GET transaction_chains': (ctx) => {
        const cls = ctx.searchParams.get('transaction_chain[class_name]');
        const row = ctx.searchParams.get('transaction_chain[row_id]');
        const state = ctx.searchParams.get('transaction_chain[state]');

        if (
          cls === 'MigrationPlan' &&
          row === '2' &&
          (state === 'staged' || state === 'queued' || state === 'rollbacking')
        ) {
          return { transaction_chains: [{ id: 777, state: state ?? 'staged' }] };
        }

        return { transaction_chains: [] };
      },
    },
  });

  await page.goto('/admin/migration-plans/2');

  const startBtn = page.getByTestId('admin.migration_plan.start');
  await expect(startBtn).toBeVisible();

  // Wait for the active transaction chain to be loaded and applied to gates.
  await expect(startBtn).toHaveAttribute('aria-disabled', 'true');

  await startBtn.click({ force: true });
  await expect(page.getByTestId('admin.migration_plan.start.reason')).toBeVisible();
});
