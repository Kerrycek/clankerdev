import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('NAS datasets alias', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'alice', level: 1 },
      handlers: {
        'GET datasets': ({ searchParams }) => {
          const role = searchParams.get('dataset[role]');
          if (role !== 'primary') return { datasets: [], _meta: { total_count: 0 } };
          return {
            datasets: [
              {
                id: 901,
                full_name: 'tank/nas/alice',
                name: 'alice',
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
  });

  test('renders NAS alias with primary-role datasets and hides VPS advanced filter', async ({ page }) => {
    await page.goto('/app/nas');

    await expect(page.getByTestId('datasets.list.header')).toContainText('NAS');
    await expect(page.getByTestId('datasets.row.901')).toBeVisible();

    await page.getByTestId('datasets.filters.advanced.open').click();
    await expect(page.getByTestId('datasets.advanced.vps')).toHaveCount(0);
  });
});
