import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile @smoke @smoke-mobile authenticated user lands on dashboard and can open VPS list', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_USER_SESSION' });

  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET vpses': () => ({
        vpses: [
          { id: 101, hostname: 'alpha', is_running: true, object_state: 'active' },
          { id: 102, hostname: 'beta', is_running: false, object_state: 'active' },
        ],
        _meta: { total_count: 2 },
      }),
      'GET datasets': () => ({ datasets: [{ id: 1 }], _meta: { total_count: 1 } }),
      'GET dns_zones': () => ({ dns_zones: [{ id: 1 }], _meta: { total_count: 1 } }),
      'GET transaction_chains': () => ({ transaction_chains: [], _meta: { total_count: 0 } }),
    },
  });

  await page.goto('/app');

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Signed in as alice')).toBeVisible();
  await expect(page.getByTestId('app.dashboard.kpi.vps')).toContainText('VPS');
  await expect(page.getByText('Running:')).toBeVisible();

  await page.getByTestId('app.dashboard.kpi.vps').getByRole('link', { name: 'Open' }).click();

  await expect(page).toHaveURL(/\/app\/vps$/);
  await expect(page.getByRole('heading', { name: 'VPS' })).toBeVisible();
  await expect(page.getByRole('link', { name: /alpha/i })).toBeVisible();
});
