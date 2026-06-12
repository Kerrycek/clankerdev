import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, jsonFulfill } from '../../fixtures';

test.describe('NAS datasets alias', () => {
  test('renders NAS alias with primary-role datasets, owner rows, and no VPS advanced filter', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let requestedRole: string | null = null;
    let requestedIncludes: string | null = null;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: {
        'GET datasets': ({ searchParams }) => {
          const role = searchParams.get('dataset[role]');
          requestedRole = role;
          requestedIncludes = searchParams.get('_meta[includes]');
          if (role !== 'primary') return { datasets: [], _meta: { total_count: 0 } };
          return {
            datasets: [
              {
                id: 901,
                full_name: 'tank/nas/alice',
                name: 'alice',
                user: { id: 44, login: 'alice' },
                used: 1024,
                refquota: 4096,
                snapshots_count: 1,
                mount_count: 0,
                export_count: 0,
                object_state: 'active',
              },
            ],
            _meta: { total_count: 1 },
          };
        },
      },
    });
    await page.goto('/admin/nas');

    await expect(page.getByTestId('datasets.list.header')).toContainText('NAS');
    await expect(page.getByTestId('datasets.row.901')).toBeVisible();
    await expect(page.getByTestId('datasets.row.901')).toContainText('alice');
    expect(requestedRole).toBe('primary');
    expect(requestedIncludes).toBe('user');

    await page.getByTestId('datasets.filters.advanced.open').click();
    await expect(page.getByTestId('datasets.advanced.vps')).toHaveCount(0);
  });

  test('shows NAS-specific empty state and keeps filter clearing available', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'alice', level: 1 },
      handlers: {
        'GET datasets': () => ({ datasets: [], _meta: { total_count: 0 } }),
      },
    });

    await page.goto('/app/nas');

    await expect(page.getByTestId('datasets.list.empty')).toContainText('No NAS datasets found');

    await page.getByTestId('datasets.search.input').fill('missing-nas');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('datasets.active_filters')).toContainText('q:missing-nas');
    await expect(page.getByTestId('datasets.list.empty')).toContainText('No results');
    await page.getByTestId('datasets.filter.clear').click();
    await expect(page.getByTestId('datasets.active_filters')).toHaveCount(0);
  });

  test('shows NAS-specific load error state', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'alice', level: 1 },
      handlers: {
        'GET datasets': () => jsonFulfill({ status: false, message: 'storage node unavailable', response: null }, 503),
      },
    });

    await page.goto('/app/nas');

    await expect(page.getByTestId('datasets.list.error')).toContainText('Failed to load NAS datasets');
    await expect(page.getByTestId('datasets.list.error.retry')).toBeVisible();
  });
});
