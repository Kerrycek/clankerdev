import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Dataset snapshots', () => {
  test('rollback snapshot uses a confirm dialog', async ({ page }) => {
    let rollbackCalls = 0;

    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET datasets/10': () => ({
          id: 10,
          full_name: 'tank/vps/ds10',
          name: 'ds10',
          used: 2048,
          refquota: 10240,
          snapshots_count: 1,
          mount_count: 0,
          export_count: 0,
          object_state: 'active',
          vps: { id: 300, hostname: 'alpha.example' },
        }),

        'GET datasets/10/snapshots': () => ({
          snapshots: [
            {
              id: 200,
              dataset: 10,
              name: 'snap-200',
              label: 'snap-200',
              created_at: '2026-01-26T00:00:00.000Z',
            },
          ],
        }),

        'POST datasets/10/snapshots/200/rollback': () => {
          rollbackCalls += 1;
          return { ok: true };
        },
      },
    });

    await page.goto('/app/datasets/10/snapshots');

    await expect(page.getByTestId('dataset.snapshots.list')).toBeVisible();
    await expect(page.getByTestId('dataset.snapshots.row.200')).toBeVisible();

    await page.getByTestId('dataset.snapshots.row.200.rollback').click();
    await expect(page.getByTestId('dataset.snapshots.rollback_confirm')).toBeVisible();
    await page.getByTestId('dataset.snapshots.rollback_confirm.confirm').click();
    await expect(page.getByTestId('dataset.snapshots.rollback_confirm')).toBeHidden();

    expect(rollbackCalls).toBe(1);
  });

  test('delete snapshot uses a confirm dialog and removes the row', async ({ page }) => {
    let deleted = false;
    let deleteCalls = 0;

    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET datasets/10': () => ({
          id: 10,
          full_name: 'tank/vps/ds10',
          name: 'ds10',
          used: 2048,
          refquota: 10240,
          snapshots_count: 1,
          mount_count: 0,
          export_count: 0,
          object_state: 'active',
          vps: { id: 300, hostname: 'alpha.example' },
        }),

        'GET datasets/10/snapshots': () => {
          if (deleted) {
            return { snapshots: [] };
          }
          return {
            snapshots: [
              {
                id: 200,
                dataset: 10,
                name: 'snap-200',
                label: 'snap-200',
                created_at: '2026-01-26T00:00:00.000Z',
              },
            ],
          };
        },

        'DELETE datasets/10/snapshots/200': () => {
          deleteCalls += 1;
          deleted = true;
          return { ok: true };
        },
      },
    });

    await page.goto('/app/datasets/10/snapshots');

    await expect(page.getByTestId('dataset.snapshots.list')).toBeVisible();
    await expect(page.getByTestId('dataset.snapshots.row.200')).toBeVisible();

    await page.getByTestId('dataset.snapshots.row.200.delete').click();
    await expect(page.getByTestId('dataset.snapshots.delete_confirm')).toBeVisible();
    await page.getByTestId('dataset.snapshots.delete_confirm.confirm').click();
    await expect(page.getByTestId('dataset.snapshots.delete_confirm')).toBeHidden();

    await expect(page.getByTestId('dataset.snapshots.row.200')).toHaveCount(0);
    expect(deleteCalls).toBe(1);
  });
});
