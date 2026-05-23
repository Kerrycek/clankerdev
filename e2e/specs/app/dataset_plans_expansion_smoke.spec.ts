import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke dataset plans and expansion', () => {
  test('renders dataset plans tab', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 10, login: 'alice', level: 1 },
      handlers: {
        'GET datasets/42': () => ({
          dataset: {
            id: 42,
            full_name: 'tank/users/alice',
            name: 'alice',
            environment: { id: 7, label: 'Production' },
            object_state: 'active',
          },
        }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET datasets/42/plans': () => ({
          plans: [
            {
              id: 2,
              environment_dataset_plan: {
                id: 12,
                label: 'Daily backup',
                dataset_plan: { id: 3, label: 'daily_backup' },
                user_add: true,
                user_remove: true,
              },
            },
          ],
        }),
        'GET environments/7/dataset_plans': () => ({
          dataset_plans: [
            { id: 12, label: 'Daily backup', dataset_plan: { id: 3, label: 'daily_backup' }, user_add: true, user_remove: true },
            { id: 13, label: 'Weekly backup', dataset_plan: { id: 4, label: 'weekly_backup' }, user_add: true, user_remove: false },
          ],
        }),
      },
    });

    await page.goto('/app/datasets/42/plans');
    await expect(page.getByTestId('dataset.plans.summary')).toBeVisible();
    await expect(page.getByTestId('dataset.plans.row.2')).toBeVisible();
  });

  test('renders dataset expansion tab with history', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET datasets/42': () => ({
          dataset: {
            id: 42,
            full_name: 'tank/users/alice',
            name: 'alice',
            environment: { id: 7, label: 'Production' },
            dataset_expansion: { id: 9 },
            object_state: 'active',
            refquota: 20480,
          },
        }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET dataset_expansions/9': () => ({
          dataset_expansion: {
            id: 9,
            state: 'active',
            added_space: 10240,
            original_refquota: 10240,
            enable_notifications: true,
            enable_shrink: true,
            stop_vps: true,
            over_refquota_seconds: 3600,
            max_over_refquota_seconds: 7200,
            created_at: '2026-02-27T10:00:00Z',
          },
        }),
        'GET dataset_expansions/9/history': () => ({
          histories: [
            {
              id: 1,
              added_space: 10240,
              original_refquota: 10240,
              new_refquota: 20480,
              created_at: '2026-02-27T10:00:00Z',
              admin: { id: 1, login: 'admin' },
            },
          ],
        }),
      },
    });

    await page.goto('/admin/datasets/42/expansion');
    await expect(page.getByTestId('dataset.expansion.summary')).toBeVisible();
    await expect(page.getByTestId('dataset.expansion.history.row.1')).toBeVisible();
  });
});
