import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Dataset snapshot action gating (preflight)', () => {
  test('create snapshot is blocked when preflight detects an active transaction chain', async ({ page }) => {
    let datasetChainCalls = 0;
    let createCalls = 0;

    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET transaction_chains': ({ searchParams }) => {
          const cls = searchParams.get('transaction_chain[class_name]');
          const rowId = searchParams.get('transaction_chain[row_id]');

          // Dataset layout + preflight both call this with class_name=Dataset & row_id=10.
          if (cls === 'Dataset' && rowId === '10') {
            datasetChainCalls += 1;
            if (datasetChainCalls >= 2) {
              return {
                transaction_chains: [
                  {
                    id: 999,
                    state: 'running',
                    label: 'busy-chain',
                    created_at: '2026-01-26T00:00:00.000Z',
                  },
                ],
              };
            }
            return { transaction_chains: [] };
          }

          return { transaction_chains: [] };
        },

        'GET datasets/10': () => ({
          id: 10,
          full_name: 'tank/vps/ds10',
          name: 'ds10',
          used: 2048,
          refquota: 10240,
          snapshots_count: 2,
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

        'GET snapshot_downloads': () => ({ snapshot_downloads: [] }),

        'POST datasets/10/snapshots': () => {
          createCalls += 1;
          return { snapshot: { id: 201, dataset: 10, name: 'snap-201', label: 'snap-201' } };
        },
      },
    });

    await page.goto('/app/datasets/10/snapshots');

    await expect(page.getByTestId('dataset.snapshots.list')).toBeVisible();

    await page.getByTestId('dataset.snapshots.create.open').click();
    await expect(page.getByTestId('dataset.snapshots.create.modal')).toBeVisible();

    await page.getByTestId('dataset.snapshots.create.label').fill('preflight');
    await page.getByTestId('dataset.snapshots.create.submit').click();

    await expect(page.getByTestId('tasks.drawer')).toBeVisible();
    expect(createCalls).toBe(0);
  });
});
