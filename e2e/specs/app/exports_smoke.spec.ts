import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke exports', () => {
  test('lists exports and opens detail with mount instructions', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const exportRow = {
      id: 10,
      dataset: { id: 20, name: 'data', full_name: 'tank/user/data' },
      snapshot: null,
      user: { id: 1, login: 'demo' },
      host_ip_address: { id: 5, addr: '198.51.100.10' },
      path: '/tank/user/data',
      all_vps: false,
      rw: true,
      sync: true,
      subtree_check: false,
      root_squash: false,
      threads: 8,
      enabled: true,
      updated_at: '2026-02-28T10:00:00Z',
      created_at: '2026-02-27T09:00:00Z',
    };

    await installHaveApiMock(page, {
      user: { id: 1, login: 'demo', level: 1 },
      handlers: {
        'GET exports': () => ({ exports: [exportRow], _meta: { total_count: 1 } }),
        'GET exports/10': () => exportRow,
        'GET exports/10/hosts': () => ({
          hosts: [
            {
              id: 11,
              ip_address: { id: 9, addr: '203.0.113.11' },
              rw: true,
              sync: true,
              subtree_check: false,
              root_squash: false,
            },
          ],
          _meta: { total_count: 1 },
        }),
      },
    });

    await page.goto('/app/exports');
    await expect(page.getByTestId('exports.page')).toBeVisible();
    await expect(page.getByTestId('exports.row.10')).toBeVisible();

    await page.getByTestId('exports.row.10').click();
    await expect(page).toHaveURL(/\/app\/exports\/10$/);
    await expect(page.getByTestId('exports.detail.page')).toBeVisible();
    await expect(page.getByTestId('exports.detail.instructions.command')).toContainText('198.51.100.10:/tank/user/data');
    await expect(page.getByTestId('exports.detail.hosts.row.11')).toBeVisible();
  });

  test('opens create export form as a centered modal', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'demo', level: 1 },
      handlers: {
        'GET exports': () => ({ exports: [], _meta: { total_count: 0 } }),
      },
    });

    await page.goto('/app/exports');
    await page.getByTestId('exports.create.open').click();

    await expect(page.getByTestId('exports.create')).toBeVisible();
    await expect(page.getByTestId('exports.create')).toHaveAttribute('data-overlay', 'modal');
    await expect(page.locator('[data-overlay="drawer"][data-testid="exports.create"]')).toHaveCount(0);
  });
});
