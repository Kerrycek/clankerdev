import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@workflow-matrix @pr-smoke @pr-smoke-mobile @smoke @smoke-mobile authenticated user lands on dashboard and can open VPS list', async ({ page }) => {
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
  await expect(page.getByTestId('app.dashboard.kpi.vps')).toContainText('2');
  await expect(page.getByText('Running:')).toHaveCount(0);

  await page.getByTestId('app.dashboard.kpi.vps').getByRole('link', { name: 'Open' }).click();

  await expect(page).toHaveURL(/\/app\/vps$/);
  await expect(page.getByRole('heading', { name: 'VPS' })).toBeVisible();
  await expect(page.getByRole('link', { name: /alpha/i })).toBeVisible();
});

test('@smoke authenticated dashboard skips HaveAPI description bootstrap in standalone mode', async ({ page }) => {
  const descriptionRequests: string[] = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      request.method() === 'GET' &&
      ['/api', '/api/', '/api/v7.0', '/api/v7.0/'].includes(url.pathname)
    ) {
      descriptionRequests.push(url.pathname);
    }
  });

  await bootstrapVpsAdminWindow(page, {
    sessionToken: 'TEST_USER_SESSION',
    description: false,
    webuiNext: {
      haveApi: {
        authHeader: 'X-HaveAPI-Auth-Token',
        metaNamespace: '_meta',
      },
    },
  });

  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
      'GET datasets': () => ({ datasets: [], _meta: { total_count: 0 } }),
      'GET dns_zones': () => ({ dns_zones: [], _meta: { total_count: 0 } }),
      'GET transaction_chains': () => ({ transaction_chains: [], _meta: { total_count: 0 } }),
    },
  });

  await page.goto('/app');

  await expect(page.getByTestId('app.dashboard.page')).toBeVisible();
  expect(descriptionRequests).toEqual([]);
});
