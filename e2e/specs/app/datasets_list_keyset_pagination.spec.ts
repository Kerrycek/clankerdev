import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Datasets list keyset pagination', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    const makeDataset = (id: number) => ({
      id,
      full_name: `tank/vps/ds${id}`,
      name: `ds${id}`,
      used: id === 300 ? 9000 : id === 299 ? 3900 : 512 + (id % 8) * 128,
      refquota: id === 300 ? 4096 : id === 299 ? 4096 : 4096 + (id % 8) * 512,
      snapshots_count: id % 4,
      mount_count: id % 3,
      export_count: id % 2,
      object_state: 'active',
      vps: { id, hostname: `vps${id}.example` },
    });

    const page1 = Array.from({ length: 50 }, (_, i) => 300 - i).map(makeDataset);
    const page2 = Array.from({ length: 50 }, (_, i) => 250 - i).map(makeDataset);

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET datasets': ({ searchParams }) => {
          const fromId = searchParams.get('dataset[from_id]');
          return { datasets: fromId ? page2 : page1, _meta: { total_count: 100 } };
        },
      },
    });
  });

  test('navigates to next and previous pages via from_id', async ({ page }) => {
    await page.goto('/app/datasets');

    await expect(page.getByTestId('datasets.list')).toBeVisible();
    await expect(page.getByTestId('datasets.row.300')).toBeVisible();
    await expect(page.getByTestId('datasets.row.300')).toHaveAttribute('data-row-variant', 'danger');
    await expect(page.getByTestId('datasets.row.300.dot')).toBeVisible();
    await expect(page.getByTestId('datasets.row.299.dot')).toBeVisible();

    await page.getByTestId('datasets.pagination.desktop.next').click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('datasets.row.250')).toBeVisible();

    await page.getByTestId('datasets.pagination.desktop.prev').click();
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page).toHaveURL(/page=1/);
    await expect(page.getByTestId('datasets.row.300')).toBeVisible();
    await expect(page.getByTestId('datasets.row.300')).toHaveAttribute('data-row-variant', 'danger');
    await expect(page.getByTestId('datasets.row.300.dot')).toBeVisible();
    await expect(page.getByTestId('datasets.row.299.dot')).toBeVisible();
  });
});

test.describe('Datasets list optional columns', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET datasets': () => ({
          datasets: [
            {
              id: 8,
              full_name: 'tank/vps/12',
              name: '12',
              used: 269,
              refquota: 10240,
              vps: { id: 12, hostname: 'dopici' },
            },
            {
              id: 9,
              full_name: 'tank/vps/13',
              name: '13',
              used: 269,
              refquota: 10240,
              vps: { id: 13, hostname: 'hjjh' },
            },
          ],
        }),
      },
    });
  });

  test('hides related object columns when the API does not provide those values', async ({ page }) => {
    await page.goto('/app/datasets');

    await expect(page.getByTestId('datasets.list')).toBeVisible();
    await expect(page.getByTestId('datasets.row.8')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Snapshoty' })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Mounty' })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Exporty' })).toHaveCount(0);
  });
});
