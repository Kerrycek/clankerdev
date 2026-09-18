import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test.describe('Backup center', () => {
  test('@pr-smoke @pr-smoke-mobile filters the complete loaded backup set without unsupported q params', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    let datasetRequests = 0;
    let downloadRequests = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'backup-user', level: 1 },
      handlers: {
        'GET datasets': ({ searchParams }) => {
          datasetRequests += 1;
          expect(searchParams.get('dataset[q]')).toBeNull();
          return {
            datasets: [
              { id: 10, name: 'root', full_name: 'mail.example/root', vps: { id: 20, hostname: 'mail.example' } },
              { id: 11, name: 'archive', full_name: 'nas/archive' },
            ],
            _meta: { total_count: 2 },
          };
        },
        'GET snapshot_downloads': ({ searchParams }) => {
          downloadRequests += 1;
          expect(searchParams.get('snapshot_download[q]')).toBeNull();
          return {
            snapshot_downloads: [
              {
                id: 41,
                state: 'ready',
                format: 'archive',
                url: '/download/41',
                snapshot: { id: 31, name: 'before-upgrade', dataset: { id: 10 } },
              },
              {
                id: 42,
                state: 'ready',
                format: 'archive',
                url: '/download/42',
                snapshot: { id: 32, name: 'monthly-archive', dataset: { id: 11 } },
              },
            ],
            _meta: { total_count: 2 },
          };
        },
      },
    });

    await page.goto('/app/backups?tab=snapshots');
    await expect(page.getByTestId('backups.snapshots.row.10')).toBeVisible();
    await expect(page.getByTestId('backups.snapshots.row.11')).toBeVisible();
    await page.getByTestId('backups.filter').fill('archive');
    await expect(page.getByTestId('backups.snapshots.row.10')).toHaveCount(0);
    await expect(page.getByTestId('backups.snapshots.row.11')).toBeVisible();
    expect(datasetRequests).toBe(1);
    expect(downloadRequests).toBe(0);

    await page.getByTestId('backups.tab.downloads').click();
    await page.getByTestId('backups.filter').fill('monthly');
    const resultTestId = testInfo.project.name === 'mobile-chrome'
      ? 'backups.downloads.card.42'
      : 'backups.downloads.row.42';
    await expect(page.getByTestId(resultTestId)).toBeVisible();
    await expect(page.getByTestId(
      testInfo.project.name === 'mobile-chrome'
        ? 'backups.downloads.card.41'
        : 'backups.downloads.row.41',
    )).toHaveCount(0);
    expect(datasetRequests).toBe(1);
    expect(downloadRequests).toBe(1);
    await expect(page.getByText(/A limited quick overview is loaded/)).toHaveCount(0);
  });

  test('@pr-smoke @pr-smoke-mobile keeps backup download actions visible without horizontal scrolling', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'backup-user', level: 1 },
      handlers: {
        'GET datasets': () => ({
          datasets: [
            {
              id: 10,
              name: 'root-volume-with-a-long-mobile-friendly-name',
              full_name: 'mail.example/root-volume-with-a-long-mobile-friendly-name',
              vps: { id: 20, hostname: 'mail.example' },
              user: { id: 1, login: 'backup-user' },
            },
          ],
          _meta: { total_count: 1 },
        }),
        'GET snapshot_downloads': () => ({
          snapshot_downloads: [
            {
              id: 41,
              state: 'ready',
              format: 'archive',
              size: 128,
              expiration_date: '2099-12-01T12:00:00Z',
              url: '/download/41',
              snapshot: {
                id: 31,
                name: 'before-upgrade-with-a-long-name',
                dataset: { id: 10, vps: { id: 20 } },
              },
            },
          ],
          _meta: { total_count: 1 },
        }),
      },
    });

    const mobile = testInfo.project.name === 'mobile-chrome';

    async function expectResponsiveDownload(
      sectionTestId: 'backups.overview' | 'backups.downloads',
      layout: 'card' | 'row',
    ) {
      const entryTestId = `backups.downloads.${layout}.41`;
      const actionPrefix = entryTestId;
      const section = page.getByTestId(sectionTestId);
      await expect(section).toBeVisible();
      const entry = section.getByTestId(entryTestId);
      await expect(entry).toBeVisible();
      await entry.scrollIntoViewIfNeeded();
      await expect(entry.getByTestId(`${actionPrefix}.detail`)).toBeInViewport();
      await expect(entry.getByTestId(`${actionPrefix}.download`)).toBeInViewport();
      await expectNoDocumentHorizontalOverflow(page);

      if (layout === 'card') {
        await expect(section.getByTestId('backups.downloads.cards')).toBeVisible();
        await expect(section.getByTestId('backups.downloads.table')).toBeHidden();
        await expect(entry.getByTestId(`${entryTestId}.status`)).toContainText('Ready');
        await expect(entry.getByTestId(`${entryTestId}.expiration`)).toContainText('2099');
        await expect(entry.getByTestId(`${entryTestId}.detail`)).toHaveAccessibleName(
          'Open downloads for mail.example/root-volume-with-a-long-mobile-friendly-name',
        );
        await expect(entry.getByTestId(`${entryTestId}.download`)).toHaveAccessibleName(
          'Download snapshot before-upgrade-with-a-long-name',
        );
      } else {
        await expect(section.getByTestId('backups.downloads.cards')).toBeHidden();
        await expect(section.getByTestId('backups.downloads.table')).toBeVisible();
      }
    }

    await page.goto('/app/backups');
    await expectResponsiveDownload('backups.overview', mobile ? 'card' : 'row');

    if (!mobile) {
      await page.setViewportSize({ width: 1024, height: 720 });
      await expectResponsiveDownload('backups.overview', 'card');
    }

    await page.getByTestId('backups.tab.downloads').click();
    await expect(page).toHaveURL(/tab=downloads/);
    await expectResponsiveDownload('backups.downloads', 'card');
  });

  test('@smoke shows the bounded overview and opens dataset backup tools', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    const requests: string[] = [];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'backup-user', level: 1 },
      handlers: {
        'GET datasets': (ctx) => {
          requests.push(ctx.relPath ?? 'datasets');
          return {
            datasets: [
              {
                id: 10,
                name: 'root',
                full_name: 'mail.example/root',
                vps: { id: 20, hostname: 'mail.example' },
                environment: { id: 7, label: 'Production' },
                user: { id: 1, login: 'backup-user' },
              },
              { id: 11, name: 'archive', full_name: 'nas/archive' },
            ],
            _meta: { total_count: 2 },
          };
        },
        'GET snapshot_downloads': (ctx) => {
          requests.push(ctx.relPath ?? 'snapshot_downloads');
          return {
            snapshot_downloads: [
              {
                id: 41,
                state: 'ready',
                format: 'archive',
                url: '/download/41',
                snapshot: {
                  id: 31,
                  name: 'before-upgrade',
                  dataset: { id: 10, name: 'root', vps: { id: 20, hostname: 'mail.example' } },
                },
              },
            ],
            _meta: { total_count: 1 },
          };
        },
        'GET transaction_chains': (ctx) => {
          const className = ctx.searchParams?.get('transaction_chain[class_name]');
          const rowId = ctx.searchParams?.get('transaction_chain[row_id]');
          if (className === 'Dataset' && rowId === '10') {
            requests.push('transaction_chains?class_name=Dataset&row_id=10');
          }
          return { transaction_chains: [], _meta: { total_count: 0 } };
        },
        'GET datasets/10/snapshots': (ctx) => {
          requests.push(ctx.relPath ?? 'datasets/10/snapshots');
          return {
            snapshots: [
              {
                id: 31,
                name: 'before-upgrade',
                label: 'Before upgrade',
                created_at: '2026-08-10T09:00:00Z',
              },
            ],
            _meta: { total_count: 1 },
          };
        },
        'GET datasets/10/plans': (ctx) => {
          requests.push(ctx.relPath ?? 'datasets/10/plans');
          return {
            plans: [
              {
                id: 2,
                environment_dataset_plan: {
                  id: 12,
                  label: 'Daily backup',
                  dataset_plan: { id: 3, label: 'daily_backup' },
                  user_add: true,
                  user_remove: true,
                },
              },
            ],
          };
        },
        'GET environments/7/dataset_plans': (ctx) => {
          requests.push(ctx.relPath ?? 'environments/7/dataset_plans');
          return {
            dataset_plans: [
              {
                id: 12,
                label: 'Daily backup',
                dataset_plan: { id: 3, label: 'daily_backup' },
                user_add: true,
                user_remove: true,
              },
              {
                id: 13,
                label: 'Weekly backup',
                dataset_plan: { id: 4, label: 'weekly_backup' },
                user_add: true,
                user_remove: false,
              },
            ],
          };
        },
        'POST datasets/10/plans': () => ({
          plan: {
            id: 3,
            environment_dataset_plan: {
              id: 13,
              label: 'Weekly backup',
              user_add: true,
              user_remove: false,
            },
          },
        }),
      },
    });

    await page.goto('/app/backups');

    await expect(page.getByTestId('backups.page')).toBeVisible();
    await expect(page.getByTestId('nav.sidebar.backups')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('backups.stats.datasets')).toContainText('2');
    await expect(page.getByTestId('backups.stats.downloads')).toContainText('1');
    const downloadLayout = testInfo.project.name === 'mobile-chrome' ? 'card' : 'row';
    await expect(page.getByTestId(`backups.downloads.${downloadLayout}.41`)).toContainText('root');
    expect(requests).toHaveLength(2);

    await page.getByTestId('backups.tab.snapshots').click();
    await expect(page.getByTestId('backups.snapshots')).toBeVisible();
    await expect(page.getByTestId('backups.snapshots.row.10')).toContainText('mail.example/root');
    await expect(page.getByTestId('backups.snapshots.row.11')).toContainText('nas/archive');
    await expect(page.getByTestId('backups.workspace.empty')).toBeVisible();
    expect(requests).toHaveLength(2);

    await page.getByTestId('backups.snapshots.row.10').click();
    await expect(page.getByTestId('backups.snapshots.row.10')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('dataset.snapshots.row.31')).toContainText('Before upgrade');
    await expect(page.getByTestId('dataset.snapshots.row.31.rollback')).toBeEnabled();
    await expect(page.getByTestId('dataset.snapshots.row.31.delete')).toBeEnabled();
    await expect(page).toHaveURL(/tab=snapshots.*dataset=10|dataset=10.*tab=snapshots/);
    expect(requests.filter((request) => request === 'datasets/10/snapshots')).toHaveLength(1);
    expect(
      requests.filter((request) => request === 'transaction_chains?class_name=Dataset&row_id=10')
    ).not.toHaveLength(0);

    const proofPath = process.env['E2E_BACKUP_CENTER_PROOF_SCREENSHOT']?.trim();
    if (proofPath) await page.screenshot({ path: proofPath, fullPage: true });

    await page.getByTestId('backups.tab.plans').click();
    await expect(page.getByTestId('dataset.plans.summary')).toBeVisible();
    await expect(page.getByTestId('dataset.plans.row.2')).toContainText('Daily backup');
    await expect(page).toHaveURL(/tab=plans.*dataset=10|dataset=10.*tab=plans/);
    expect(requests.filter((request) => request === 'datasets/10/plans')).toHaveLength(1);
    expect(requests.filter((request) => request === 'environments/7/dataset_plans')).toHaveLength(1);

    await page.getByTestId('dataset.plans.assign.open').click();
    await page.getByTestId('dataset.plans.assign.select').selectOption('13');
    const assignRequest = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/datasets/10/plans')
    );
    await page.getByTestId('dataset.plans.assign.submit').click();
    expect((await assignRequest).postDataJSON()).toEqual({
      plan: { environment_dataset_plan: 13 },
    });
    await expect(page.getByTestId('dataset.plans.assign.modal')).toBeHidden();
  });

  test('@pr-smoke @pr-smoke-mobile explains dataset backup plans on direct entry and preserves exact API contracts', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    const assignedIncludes: Array<string | null> = [];
    const availableIncludes: Array<string | null> = [];
    const mutationPayloads: unknown[] = [];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'backup-user', level: 1 },
      handlers: {
        'GET datasets': () => ({
          datasets: [
            {
              id: 10,
              name: 'root',
              full_name: 'mail.example/root',
              object_state: 'active',
              vps: { id: 20, hostname: 'mail.example' },
              environment: { id: 7, label: 'Production' },
              user: { id: 1, login: 'backup-user' },
            },
          ],
          _meta: { total_count: 1 },
        }),
        'GET transaction_chains': () => ({
          transaction_chains: [],
          _meta: { total_count: 0 },
        }),
        'GET datasets/10/plans': ({ searchParams }) => {
          assignedIncludes.push(searchParams.get('_meta[includes]'));
          return {
            plans: [
              {
                id: 21,
                environment_dataset_plan: {
                  id: 12,
                  label: 'Daily backup',
                  dataset_plan: {
                    id: 101,
                    label: 'daily_backup',
                    description: 'Takes a snapshot every night and keeps seven restore points.',
                  },
                  user_add: true,
                  user_remove: true,
                },
              },
              {
                id: 22,
                environment_dataset_plan: {
                  id: 15,
                  label: 'Operator-managed archive',
                  user_add: true,
                  user_remove: false,
                },
              },
            ],
            _meta: { total_count: 2 },
          };
        },
        'GET environments/7/dataset_plans': ({ searchParams }) => {
          availableIncludes.push(searchParams.get('_meta[includes]'));
          return {
            dataset_plans: [
              {
                id: 12,
                label: 'Daily backup',
                dataset_plan: {
                  id: 101,
                  label: 'daily_backup',
                  description: 'Takes a snapshot every night and keeps seven restore points.',
                },
                user_add: true,
                user_remove: true,
              },
              {
                id: 13,
                label: 'Remote copy',
                dataset_plan: {
                  id: 103,
                  label: 'remote_copy',
                  description: 'Copies the dataset to backup storage every six hours.',
                },
                user_add: true,
                user_remove: true,
              },
            ],
            _meta: { total_count: 2 },
          };
        },
        'POST datasets/10/plans': ({ reqJson }) => {
          mutationPayloads.push(reqJson);
          return {
            plan: {
              id: 23,
              environment_dataset_plan: {
                id: 13,
                label: 'Remote copy',
                user_add: true,
                user_remove: true,
              },
            },
          };
        },
      },
    });

    await page.goto('/app/backups?tab=plans&dataset=10');

    await expect(page).toHaveURL(/(?=.*[?&]tab=plans)(?=.*[?&]dataset=10)/);
    await expect(page.getByTestId('backups.plans')).toContainText(
      'Plans are administrator-defined automatic rules'
    );
    await expect(page.getByTestId('dataset.plans.row.21.description')).toHaveText(
      'Takes a snapshot every night and keeps seven restore points.'
    );
    await expect(page.getByTestId('dataset.plans.row.21.source')).toContainText('daily_backup');
    await expect(page.getByTestId('dataset.plans.row.22.description')).toHaveText(
      'No description is available for this plan.'
    );
    await expect.poll(() => assignedIncludes).toEqual([
      'environment_dataset_plan__dataset_plan',
    ]);
    await expect.poll(() => availableIncludes).toEqual(['dataset_plan']);
    await expectNoDocumentHorizontalOverflow(page);

    await page.getByTestId('dataset.plans.assign.open').click();
    await page.getByTestId('dataset.plans.assign.select').selectOption('13');
    await expect(page.getByTestId('dataset.plans.assign.preview.description')).toHaveText(
      'Copies the dataset to backup storage every six hours.'
    );
    await expect(page.getByTestId('dataset.plans.assign.preview.source')).toContainText(
      'remote_copy'
    );
    await expectNoDocumentHorizontalOverflow(page);

    await page.getByTestId('dataset.plans.assign.submit').click();
    await expect.poll(() => mutationPayloads).toEqual([
      { plan: { environment_dataset_plan: 13 } },
    ]);
    await expect(page.getByTestId('dataset.plans.assign.modal')).toBeHidden();
  });

  test('@pr-smoke @pr-smoke-mobile guides an owner through a guarded restore workflow', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    let rollbackCalls = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'backup-user', level: 1 },
      handlers: {
        'GET datasets': () => ({
          datasets: [
            {
              id: 10,
              name: 'root',
              full_name: 'mail.example/root',
              object_state: 'active',
              vps: { id: 20, hostname: 'mail.example' },
              environment: { id: 7, label: 'Production' },
              user: { id: 1, login: 'backup-user' },
            },
          ],
          _meta: { total_count: 1 },
        }),
        'GET snapshot_downloads': () => ({
          snapshot_downloads: [],
          _meta: { total_count: 0 },
        }),
        'GET transaction_chains': () => ({
          transaction_chains: [],
          _meta: { total_count: 0 },
        }),
        'GET datasets/10/snapshots': () => ({
          snapshots: [
            {
              id: 31,
              name: 'before-upgrade',
              label: 'Before upgrade',
              created_at: '2026-08-10T09:00:00Z',
            },
          ],
          _meta: { total_count: 1 },
        }),
        'POST datasets/10/snapshots/31/rollback': () => {
          rollbackCalls += 1;
          return { _meta: { action_state_id: 731 } };
        },
        'GET action_states/731': () => ({
          action_state: { id: 731, finished: true, status: true, current: 1, total: 1 },
        }),
      },
    });

    await page.goto('/app/backups');
    await page.getByTestId('backups.quick.restore').click();

    await expect(page).toHaveURL(/(?=.*[?&]tab=snapshots)(?=.*[?&]intent=restore)/);
    await expect(page.getByTestId('backups.restore.guide')).toBeVisible();
    await expect(page.getByTestId('backups.restore.warning')).toBeVisible();
    await page.getByTestId('backups.snapshots.row.10').click();
    const layout = testInfo.project.name === 'mobile-chrome' ? 'card' : 'row';
    const rollback = page.getByTestId(`dataset.snapshots.${layout}.31.rollback`);
    await expect(rollback).toBeVisible();
    await expect(rollback).toBeEnabled();
    await rollback.click();

    const confirm = page.getByTestId('dataset.snapshots.rollback_confirm.confirm');
    const input = page.getByTestId('dataset.snapshots.rollback_confirm.input');
    await expect(confirm).toBeDisabled();
    await input.fill('before upgrade');
    await expect(confirm).toBeDisabled();
    await input.fill('Before upgrade');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByTestId('dataset.snapshots.rollback_confirm')).toBeHidden();
    expect(rollbackCalls).toBe(1);
  });

  test('@pr-smoke @pr-smoke-mobile requires exact manual unlock after an ambiguous rollback', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    let rollbackApplied = false;
    let rollbackCalls = 0;
    let datasetReadbacks = 0;
    let snapshotReadbacks = 0;
    const activeStateReadbacks: string[] = [];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'backup-user', level: 1 },
      handlers: {
        'GET datasets': () => {
          if (rollbackApplied) datasetReadbacks += 1;
          return {
            datasets: [{
              id: 10,
              name: 'root',
              full_name: 'mail.example/root',
              object_state: 'active',
              vps: { id: 20, hostname: 'mail.example' },
              environment: { id: 7, label: 'Production' },
              user: { id: 1, login: 'backup-user' },
            }],
            _meta: { total_count: 1 },
          };
        },
        'GET transaction_chains': ({ searchParams }) => {
          const state = searchParams.get('transaction_chain[state]');
          if (state) {
            if (rollbackApplied) activeStateReadbacks.push(state);
            return { transaction_chains: [] };
          }
          const limit = Number(searchParams.get('transaction_chain[limit]') ?? 10);
          const oldChains = Array.from({ length: limit }, (_, index) => ({
            id: 700 - index,
            state: 'done',
          }));
          return {
            // This newer terminal rollback targeted another snapshot. The UI
            // must never treat it as exact proof for snapshot 31.
            transaction_chains: rollbackApplied
              ? [{ id: 701, name: 'rollback', state: 'done', snapshot_id: 32 }, ...oldChains]
              : oldChains,
          };
        },
        'GET datasets/10/snapshots': () => {
          if (rollbackApplied) snapshotReadbacks += 1;
          return {
            snapshots: [{
              id: 31,
              name: 'before-upgrade',
              label: 'Before upgrade',
              created_at: '2026-08-10T09:00:00Z',
            }],
            _meta: { total_count: 1 },
          };
        },
        'POST datasets/10/snapshots/31/rollback': () => {
          rollbackApplied = true;
          rollbackCalls += 1;
          return { ok: true };
        },
      },
    });

    await page.goto('/app/backups?tab=snapshots&intent=restore&dataset=10');
    const layout = testInfo.project.name === 'mobile-chrome' ? 'card' : 'row';
    await page.getByTestId(`dataset.snapshots.${layout}.31.rollback`).click();
    await page.getByTestId('dataset.snapshots.rollback_confirm.input').fill('Before upgrade');
    await page.getByTestId('dataset.snapshots.rollback_confirm.confirm').click();

    const confirm = page.getByTestId('dataset.snapshots.rollback_confirm.confirm');
    await expect(page.getByTestId('dataset.snapshots.rollback_confirm')).toBeVisible();
    await expect(confirm).toBeDisabled();
    await expect(page.getByTestId('dataset.snapshots.rollback_uncertain')).toBeVisible();
    await expect.poll(() => datasetReadbacks).toBeGreaterThan(0);
    await expect.poll(() => snapshotReadbacks).toBeGreaterThan(0);
    await expect.poll(() => activeStateReadbacks.includes('rollbacking')).toBe(true);

    await confirm.evaluate((button) => {
      button.removeAttribute('disabled');
      button.click();
    });
    await expect.poll(() => rollbackCalls).toBe(1);

    await page.getByTestId('dataset.snapshots.rollback_confirm.cancel').click();
    const persistedIntent = await page.evaluate(() => {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key?.includes('.uncertain.Dataset%3A10.')) continue;
        const raw = window.localStorage.getItem(key);
        if (raw) return JSON.parse(raw).intent;
      }
      return null;
    });
    expect(persistedIntent).toEqual({
      type: 'dataset-snapshot-rollback',
      snapshotId: 31,
      snapshotLabel: 'Before upgrade',
    });

    await page.reload();
    await expect(page.getByTestId('dataset.snapshots.rollback_uncertain')).toBeVisible();
    await page.getByTestId('dataset.snapshots.rollback_uncertain.open_tasks').click();
    await expect(page.getByTestId('tasks.drawer')).toBeVisible();
    await page.getByTestId('tasks.close-button').click();
    await page.getByTestId('dataset.snapshots.rollback_uncertain.acknowledge').click();
    const guardConfirm = page.getByTestId('dataset.snapshots.rollback_guard.confirm');
    await expect(guardConfirm).toBeVisible();
    await expect(guardConfirm).toContainText('Before upgrade');
    await expect(guardConfirm).toContainText('ID 31');
    await expect(page.getByTestId('dataset.snapshots.rollback_uncertain')).toBeVisible();
    await expect(page.getByTestId(`dataset.snapshots.${layout}.31.rollback`)).toBeDisabled();

    const guardInput = page.getByTestId('dataset.snapshots.rollback_guard.input');
    const guardUnlock = page.getByTestId('dataset.snapshots.rollback_guard.unlock');
    await guardInput.fill('32');
    await expect(guardUnlock).toBeDisabled();
    await guardInput.fill('31');
    await expect(guardUnlock).toBeEnabled();
    await guardUnlock.click();
    await expect(page.getByTestId('dataset.snapshots.rollback_uncertain')).toBeHidden();
    await expect(page.getByTestId(`dataset.snapshots.${layout}.31.rollback`)).toBeEnabled();
    expect(rollbackCalls).toBe(1);
  });

  test('keeps an administrator My view on explicit owned dataset requests', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    const requestedDatasetIds: Array<string | null> = [];

    await installHaveApiMock(page, {
      user: { id: 42, login: 'admin', level: 100 },
      handlers: {
        'GET datasets': ({ searchParams }) => {
          expect(searchParams.get('dataset[user]')).toBe('42');
          return {
            datasets: [
              {
                id: 10,
                name: 'root',
                full_name: 'mail.example/root',
                vps: { id: 20, hostname: 'mail.example' },
              },
              { id: 11, name: 'archive', full_name: 'nas/archive' },
            ],
            _meta: { total_count: 2 },
          };
        },
        'GET snapshot_downloads': ({ searchParams }) => {
          const datasetId = searchParams.get('snapshot_download[dataset]');
          requestedDatasetIds.push(datasetId);
          if (datasetId === '10') {
            return {
              snapshot_downloads: [
                {
                  id: 51,
                  state: 'ready',
                  format: 'archive',
                  url: '/download/51',
                  snapshot: { id: 31, name: 'owned', dataset: { id: 10 } },
                },
                {
                  id: 999,
                  state: 'ready',
                  url: '/download/999',
                  snapshot: { id: 999, name: 'foreign', dataset: { id: 999 } },
                },
              ],
              _meta: { total_count: 1 },
            };
          }
          return { snapshot_downloads: [], _meta: { total_count: 0 } };
        },
      },
    });

    await page.goto('/app/backups');

    const layout = testInfo.project.name === 'mobile-chrome' ? 'card' : 'row';
    await expect(page.getByTestId(`backups.downloads.${layout}.51`)).toContainText('mail.example/root');
    await expect(page.getByTestId(`backups.downloads.${layout}.999`)).toHaveCount(0);
    await expect(page.getByTestId(`backups.downloads.${layout}.51.detail`)).toHaveAttribute(
      'href',
      '/app/datasets/10/downloads',
    );
    expect(requestedDatasetIds.sort()).toEqual(['10', '11']);
    expect(requestedDatasetIds).not.toContain(null);
  });

  test('keeps backend-authorized user downloads available without dataset metadata', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'backup-user', level: 1 },
      handlers: {
        'GET datasets': () => failEnvelope('Dataset metadata temporarily unavailable'),
        'GET snapshot_downloads': ({ searchParams }) => {
          expect(searchParams.get('snapshot_download[dataset]')).toBeNull();
          return {
            snapshot_downloads: [
              {
                id: 61,
                state: 'ready',
                format: 'archive',
                url: '/download/61',
                snapshot: { id: 32, name: 'authorized download', dataset: { id: 10 } },
              },
            ],
            _meta: { total_count: 1 },
          };
        },
      },
    });

    await page.goto('/app/backups?tab=downloads');

    const layout = testInfo.project.name === 'mobile-chrome' ? 'card' : 'row';
    await expect(page.getByTestId(`backups.downloads.${layout}.61`)).toBeVisible();
    await expect(page.getByTestId('backups.error')).toHaveCount(0);
    await expect(page.getByTestId('backups.datasets.metadata_partial')).toBeVisible();
  });
});
