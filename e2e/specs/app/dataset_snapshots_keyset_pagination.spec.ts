import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Dataset snapshots keyset pagination', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    const dataset = {
      id: 10,
      full_name: 'tank/vps/ds10',
      name: 'ds10',
      used: 2048,
      refquota: 10240,
      snapshots_count: 123,
      mount_count: 0,
      export_count: 0,
      object_state: 'active',
      vps: { id: 300, hostname: 'alpha.example' },
    };

    const makeSnap = (id: number) => ({
      id,
      name: `snap-${id}`,
      label: `Snapshot ${id}`,
      created_at: '2026-01-26T00:00:00.000Z',
    });

    const page1 = Array.from({ length: 50 }, (_, i) => 300 - i).map(makeSnap);
    const page2 = Array.from({ length: 50 }, (_, i) => 250 - i).map(makeSnap);

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET datasets/10': () => dataset,
        'GET datasets/10/snapshots': ({ searchParams }) => {
          const fromId = searchParams.get('snapshot[from_id]');
          const q = (searchParams.get('snapshot[q]') || '').trim();
          if (q) {
            return {
              snapshots: page1.filter((s) => String(s.id) === q || s.name.includes(q) || String(s.label).includes(q)),
              _meta: { total_count: 1 },
            };
          }
          return { snapshots: fromId ? page2 : page1, _meta: { total_count: 100 } };
        },
      },
    });
  });

  test('next/prev updates URL and rows', async ({ page }) => {
    await page.goto('/app/datasets/10/snapshots');

    await expect(page.getByTestId('dataset.snapshots.list')).toBeVisible();
    await expect(page.getByTestId('dataset.snapshots.row.300')).toBeVisible();

    await page.getByTestId('dataset.snapshots.pagination.desktop.next').click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('dataset.snapshots.row.250')).toBeVisible();

    await page.getByTestId('dataset.snapshots.pagination.desktop.prev').click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId('dataset.snapshots.row.300')).toBeVisible();
  });

  test('search uses server-side q and persists in URL', async ({ page }) => {
    await page.goto('/app/datasets/10/snapshots');

    await page.getByTestId('dataset.snapshots.search.input').fill('snap-300');
    await expect(page).toHaveURL(/q=snap-300/);
    await expect(page.getByTestId('dataset.snapshots.row.300')).toBeVisible();
  });
});
