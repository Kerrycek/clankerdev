import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

async function expectNormalizedVpsListUrl(page: Page, pathname: '/app/vps' | '/admin/vps') {
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return {
        pathname: url.pathname,
        page: url.searchParams.get('page'),
        limit: url.searchParams.get('limit'),
      };
    })
    .toEqual({ pathname, page: '1', limit: '50' });
}

test.describe('@smoke Admin scope switcher', () => {
  test('switches between All and Mine views preserving safe routes', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 42, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({
          vpses: [{ id: 1, hostname: 'vps1.example', object_state: 'active', is_running: true }],
          _meta: { total_count: 1 },
        }),
        'GET datasets': () => ({ datasets: [], _meta: { total_count: 0 } }),
        'GET dns_zones': () => ({ dns_zones: [], _meta: { total_count: 0 } }),
        'GET nodes': () => ({
          nodes: [
            { id: 1, domain_name: 'node1', fqdn: 'node1.example' },
            { id: 2, domain_name: 'node2', fqdn: 'node2.example' },
          ],
        }),
        'GET nodes/public_status': () => [
          { id: 1, domain_name: 'node1', fqdn: 'node1.example', status: 'online', last_report: '2026-01-01T00:00:00Z' },
          { id: 2, domain_name: 'node2', fqdn: 'node2.example', status: 'online', last_report: '2026-01-01T00:00:00Z' },
        ],
      },
    });

    // Switching scopes lands on the matching list and lets the target list normalize
    // pagination to its stable first-page query params.
    await page.goto('/admin/vps?from_id=50&page=2');
    await expect(page.getByTestId('vps.list')).toBeVisible();

    await page.getByTestId('shell.user-menu-button').click();
    await page.getByTestId('shell.user-menu.scope.mine').click();

    await expectNormalizedVpsListUrl(page, '/app/vps');

    // When switching to Mine from an admin-only page, fall back to /app.
    await page.goto('/admin/nodes');
    await expect(page.getByTestId('admin.nodes.table')).toBeVisible();

    await page.getByTestId('shell.user-menu-button').click();
    await page.getByTestId('shell.user-menu.scope.mine').click();

    await expect(page).toHaveURL('/app');
  });

  test('shows a warning toast when switching to All objects view', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 42, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({
          vpses: [{ id: 1, hostname: 'vps1.example', object_state: 'active', is_running: true }],
          _meta: { total_count: 1 },
        }),
        'GET datasets': () => ({ datasets: [], _meta: { total_count: 0 } }),
        'GET dns_zones': () => ({ dns_zones: [], _meta: { total_count: 0 } }),
      },
    });

    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();

    await page.getByTestId('shell.user-menu-button').click();
    await page.getByTestId('shell.user-menu.scope.all').click();

    await expectNormalizedVpsListUrl(page, '/admin/vps');
    await expect(page.getByTestId('toast.scope.all.back')).toBeVisible();
  });
});
