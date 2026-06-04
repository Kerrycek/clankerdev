import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Dataset downloads', () => {
  test('create backup deep link opens the create workflow and loads snapshots', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

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

        'GET snapshot_downloads': () => ({ snapshot_downloads: [] }),

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
      },
    });

    await page.goto('/app/datasets/10/downloads?action=create');

    await expect(page.getByTestId('dataset.downloads.list')).toBeVisible();
    await expect(page.getByTestId('dataset.downloads.create.modal')).toBeVisible();
    await expect(page.getByTestId('dataset.downloads.create.snapshot')).toContainText('snap-200');
    await expect(page).toHaveURL(/\/app\/datasets\/10\/downloads$/);
  });

  test('creates download, tracks action state, and shows details from the API', async ({ page }) => {
    let created = false;

    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
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
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET datasets/10/snapshots': () => ({
          snapshots: [
            { id: 200, dataset: 10, name: 'snap-200', label: 'base', created_at: '2026-01-25T00:00:00.000Z' },
            { id: 201, dataset: 10, name: 'snap-201', label: 'target', created_at: '2026-01-26T00:00:00.000Z' },
          ],
        }),
        'GET snapshot_downloads': () => ({
          snapshot_downloads: created
            ? [
                {
                  id: 501,
                  dataset: 10,
                  snapshot: { id: 201, label: 'target' },
                  from_snapshot: { id: 200, label: 'base' },
                  format: 'incremental_stream',
                  ready: true,
                  url: 'https://example.test/incremental.zfs',
                  file_name: 'incremental.zfs',
                  size: 128,
                  sha256sum: 'b'.repeat(64),
                  expires_at: '2026-02-10T00:00:00.000Z',
                },
              ]
            : [],
        }),
        'POST snapshot_downloads': () => {
          created = true;
          return {
            snapshot_download: { id: 501 },
            _meta: { action_state_id: 702 },
          };
        },
        'GET action_states/702': () => ({
          action_state: {
            id: 702,
            label: 'Create snapshot download',
            status: true,
            finished: false,
            current: 1,
            total: 3,
          },
        }),
      },
    });

    await page.goto('/app/datasets/10/downloads?action=create');

    await page.getByTestId('dataset.downloads.create.snapshot').selectOption('201');
    await page.getByTestId('dataset.downloads.create.format').selectOption('incremental_stream');
    await page.getByTestId('dataset.downloads.create.from_snapshot').selectOption('200');
    await page.getByTestId('dataset.downloads.create.send_mail').uncheck();

    const reqPromise = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/api/v7.0/snapshot_downloads'));
    await page.getByTestId('dataset.downloads.create.submit').click();

    expect((await reqPromise).postDataJSON()).toEqual({
      snapshot_download: {
        snapshot: 201,
        from_snapshot: 200,
        format: 'incremental_stream',
        send_mail: false,
      },
    });
    await expect(page.getByTestId('modal.action_progress')).toBeVisible();
    await expect(page.getByTestId('modal.action_progress')).toContainText('#702');
    await page.getByTestId('modal.action_progress.continue').click();
    await expect(page.getByTestId('dataset.downloads.row.501')).toContainText('From base');
    await expect(page.getByTestId('dataset.downloads.row.501')).toContainText('2026');
  });

  test('delete download uses a confirm dialog and removes the row', async ({ page }) => {
    let deleted = false;
    let deleteCalls = 0;

    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

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

        'GET snapshot_downloads': () => {
          if (deleted) {
            return { snapshot_downloads: [] };
          }
          return {
            snapshot_downloads: [
              {
                id: 501,
                dataset: 10,
                snapshot: { id: 200, label: 'snap-200' },
                format: 'archive',
                ready: true,
                url: 'https://example.test/dl.tar.gz',
                file_name: 'dl.tar.gz',
                size: 128,
                sha256: 'a'.repeat(64),
                expires_at: '2026-02-10T00:00:00.000Z',
              },
            ],
          };
        },

        'DELETE snapshot_downloads/501': () => {
          deleteCalls += 1;
          deleted = true;
          return { ok: true };
        },
      },
    });

    await page.goto('/app/datasets/10/downloads');

    await expect(page.getByTestId('dataset.downloads.list')).toBeVisible();
    await expect(page.getByTestId('dataset.downloads.row.501')).toBeVisible();

    await page.getByTestId('dataset.downloads.row.501.delete').click();
    await expect(page.getByTestId('dataset.downloads.delete_confirm')).toBeVisible();
    await expect(page.getByTestId('dataset.downloads.delete_confirm.confirm')).toBeDisabled();
    await page.getByTestId('dataset.downloads.delete_confirm.input').fill('500');
    await expect(page.getByTestId('dataset.downloads.delete_confirm.confirm')).toBeDisabled();
    await page.getByTestId('dataset.downloads.delete_confirm.input').fill('501');
    await expect(page.getByTestId('dataset.downloads.delete_confirm.confirm')).toBeEnabled();

    await page.getByTestId('dataset.downloads.delete_confirm.confirm').click();
    await expect(page.getByTestId('dataset.downloads.delete_confirm')).toBeHidden();

    await expect(page.getByTestId('dataset.downloads.row.501')).toHaveCount(0);
    expect(deleteCalls).toBe(1);
  });
});
