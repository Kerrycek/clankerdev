import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Dashboard', () => {
  test('shows KPI cards and navigation actions', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET vpses': () => {
          const vpses = [
            { id: 101, hostname: 'a', is_running: true, object_state: 'active' },
            { id: 102, hostname: 'b', is_running: false, object_state: 'active' },
            { id: 103, hostname: 'c', is_running: false, object_state: 'active' },
          ];
          return { vpses, _meta: { total_count: vpses.length } };
        },
        'GET datasets': () => ({ datasets: [{ id: 1 }], _meta: { total_count: 7 } }),
        'GET dns_zones': () => ({ dns_zones: [{ id: 1 }], _meta: { total_count: 2 } }),
        'GET transaction_chains': () => ({ transaction_chains: [], _meta: { total_count: 0 } }),
      },
    });

    await page.goto('/app');

    await expect(page.getByTestId('app.dashboard.page')).toBeVisible();
    await expect(page.getByTestId('app.dashboard.header')).toBeVisible();
    await expect(page.getByTestId('app.dashboard.summary-grid')).toBeVisible();

    await expect(page.getByTestId('app.dashboard.kpi.vps')).toContainText('3');
    await expect(page.getByTestId('app.dashboard.kpi.datasets')).toContainText('7');
    await expect(page.getByTestId('app.dashboard.kpi.dns')).toContainText('2');

    await expect(page.getByTestId('app.dashboard.kpi.vps.open')).toBeVisible();
    await expect(page.getByTestId('app.dashboard.kpi.tasks.open')).toBeVisible();
  });
});
