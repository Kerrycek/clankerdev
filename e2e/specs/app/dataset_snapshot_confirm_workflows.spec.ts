import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Dataset snapshots', () => {
  test('create snapshot deep link opens the create workflow', async ({ page }) => {
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
          snapshots_count: 0,
          mount_count: 0,
          export_count: 0,
          object_state: 'active',
          vps: { id: 300, hostname: 'alpha.example' },
        }),

        'GET datasets/10/snapshots': () => ({ snapshots: [] }),
      },
    });

    await page.goto('/app/datasets/10/snapshots?action=create');

    await expect(page.getByTestId('dataset.snapshots.list')).toBeVisible();
    await expect(page.getByTestId('dataset.snapshots.create.modal')).toBeVisible();
    await expect(page).toHaveURL(/\/app\/datasets\/10\/snapshots$/);
  });

  test('creates snapshot and opens the returned action state progress', async ({ page }) => {
    let created = false;

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
          snapshots_count: created ? 1 : 0,
          mount_count: 0,
          export_count: 0,
          object_state: 'active',
          vps: { id: 300, hostname: 'alpha.example' },
        }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET datasets/10/snapshots': () => ({
          snapshots: created
            ? [
                {
                  id: 201,
                  dataset: 10,
                  name: 'snap-201',
                  label: 'before-upgrade',
                  created_at: '2026-01-26T00:00:00.000Z',
                },
              ]
            : [],
        }),
        'POST datasets/10/snapshots': () => {
          created = true;
          return {
            snapshot: { id: 201, dataset: 10, name: 'snap-201', label: 'before-upgrade' },
            _meta: { action_state_id: 701 },
          };
        },
        'GET action_states/701': () => ({
          action_state: {
            id: 701,
            label: 'Create snapshot',
            status: true,
            finished: false,
            current: 1,
            total: 2,
          },
        }),
      },
    });

    await page.goto('/app/datasets/10/snapshots');

    await page.getByTestId('dataset.snapshots.create.open').click();
    await page.getByTestId('dataset.snapshots.create.label').fill('before-upgrade');

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/datasets/10/snapshots')
    );
    await page.getByTestId('dataset.snapshots.create.submit').click();

    expect((await reqPromise).postDataJSON()).toEqual({ snapshot: { label: 'before-upgrade' } });
    await expect(page.getByTestId('modal.action_progress')).toBeVisible();
    await expect(page.getByTestId('modal.action_progress')).toContainText('#701');
    await page.getByTestId('modal.action_progress.continue').click();
    await expect(page.getByTestId('dataset.snapshots.row.201')).toBeVisible();
  });

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
    await expect(page.getByTestId('dataset.snapshots.rollback_confirm.confirm')).toBeDisabled();
    await page.getByTestId('dataset.snapshots.rollback_confirm.input').fill('snap-201');
    await expect(page.getByTestId('dataset.snapshots.rollback_confirm.confirm')).toBeDisabled();
    await page.getByTestId('dataset.snapshots.rollback_confirm.input').fill('snap-200');
    await expect(page.getByTestId('dataset.snapshots.rollback_confirm.confirm')).toBeEnabled();
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
    await expect(page.getByTestId('dataset.snapshots.delete_confirm.confirm')).toBeDisabled();
    await page.getByTestId('dataset.snapshots.delete_confirm.input').fill('snap-200');
    await expect(page.getByTestId('dataset.snapshots.delete_confirm.confirm')).toBeEnabled();
    await page.getByTestId('dataset.snapshots.delete_confirm.confirm').click();
    await expect(page.getByTestId('dataset.snapshots.delete_confirm')).toBeHidden();

    await expect(page.getByTestId('dataset.snapshots.row.200')).toHaveCount(0);
    expect(deleteCalls).toBe(1);
  });
});
