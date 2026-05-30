import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@smoke admin migration plans: create binds local lock for newly created plan', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET migration_plans': () => {
        return { migration_plans: [] };
      },

      // Create returns an async action_state_id + the new plan id.
      'POST migration_plans': () => {
        return {
          migration_plan: {
            id: 888,
            state: 'staged',
            concurrency: 10,
            stop_on_error: true,
            send_mail: true,
            user: { id: 1, login: 'admin' },
            created_at: '2026-01-01T00:00:00Z',
            finished_at: null,
          },
          _meta: { action_state_id: 555 },
        };
      },

      'GET migration_plans/888': () => {
        return {
          migration_plan: {
            id: 888,
            state: 'staged',
            concurrency: 10,
            stop_on_error: true,
            send_mail: true,
            user: { id: 1, login: 'admin' },
            created_at: '2026-01-01T00:00:00Z',
            finished_at: null,
          },
        };
      },

      'GET migration_plans/888/vps_migrations': () => {
        return { vps_migrations: [] };
      },
    },
  });

  await page.goto('/admin/migration-plans');

  await page.getByTestId('admin.migration_plans.create.open').click();
  await page.getByTestId('admin.migration_plans.create.submit').click();

  await expect(page).toHaveURL('/admin/migration-plans/888');

  // Create action tracks the action_state; the drawer can be opened on demand.
  await page.getByTestId('tasks.open-button').click();
  await expect(page.getByTestId('tasks.drawer')).toBeVisible();

  // The plan page should gate actions due to the local lock that is bound once the new id is known.
  const startBtn = page.getByTestId('admin.migration_plan.start');
  await expect(startBtn).toHaveAttribute('aria-disabled', 'true');

  await expect(startBtn).toHaveAttribute('title', /Working|Operation/i);
});
