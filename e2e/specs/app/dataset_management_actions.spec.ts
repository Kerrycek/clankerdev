import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Dataset management actions', () => {
  test('creates, edits, and deletes a dataset from the overview', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const datasets: Record<number, any> = {
      10: {
        id: 10,
        full_name: 'tank/vps/ds10',
        name: 'ds10',
        used: 2048,
        avail: 10240,
        quota: 0,
        refquota: 10240,
        recordsize: 131072,
        compression: true,
        atime: false,
        relatime: false,
        sync: 'standard',
        snapshots_count: 2,
        mount_count: 0,
        export_count: 0,
        object_state: 'active',
        vps: { id: 300, hostname: 'alpha.example' },
      },
    };

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: {
        'GET datasets': () => ({ datasets: Object.values(datasets), _meta: { total_count: Object.keys(datasets).length } }),
        'GET datasets/10': () => datasets[10],
        'GET datasets/11': () => datasets[11],
        'GET transaction_chains': () => ({ transaction_chains: [], _meta: { total_count: 0 } }),
        'POST datasets': () => {
          datasets[11] = {
            ...datasets[10],
            id: 11,
            name: 'appdata',
            full_name: 'tank/vps/ds10/appdata',
            refquota: 12288,
            quota: 0,
            recordsize: 131072,
          };
          return { dataset: datasets[11] };
        },
        'PUT datasets/11': () => {
          datasets[11] = { ...datasets[11], quota: 20480, sync: 'disabled' };
          return { status: true, response: null };
        },
        'DELETE datasets/11': () => {
          delete datasets[11];
          return { status: true, response: null };
        },
      },
    });

    await page.goto('/admin/datasets/10');
    await expect(page.getByTestId('dataset.manage')).toBeVisible();

    await page.getByTestId('dataset.manage.create.open').click();
    const createModal = page.getByTestId('dataset.manage.create.modal');
    await createModal.getByTestId('dataset.manage.create.name').fill('appdata');
    await createModal.getByTestId('dataset.manage.refquota').fill('12');

    const createReq = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/api/v7.0/datasets'));
    await createModal.getByTestId('dataset.manage.create.submit').click();
    expect((await createReq).postDataJSON()).toEqual({
      dataset: {
        name: 'appdata',
        dataset: 10,
        automount: true,
        refquota: 12288,
        compression: true,
        atime: false,
        relatime: false,
        recordsize: 131072,
        sync: 'standard',
        sharenfs: '',
        admin_override: false,
        admin_lock_type: 'no_lock',
      },
    });

    await expect(page).toHaveURL(/\/admin\/datasets\/11$/);
    await expect(page.getByTestId('dataset.header')).toContainText('tank/vps/ds10/appdata');

    await page.getByTestId('dataset.manage.quota').fill('20');
    await page.getByTestId('dataset.manage.sync').selectOption('disabled');
    await page.getByTestId('dataset.manage.admin_override').click();

    const editReq = page.waitForRequest((r) => r.method() === 'PUT' && r.url().includes('/api/v7.0/datasets/11'));
    await page.getByTestId('dataset.manage.edit.submit').click();
    expect((await editReq).postDataJSON()).toMatchObject({
      dataset: {
        quota: 20480,
        refquota: 12288,
        sync: 'disabled',
        admin_override: true,
      },
    });

    await page.getByTestId('dataset.manage.delete.open').click();
    await expect(page.getByTestId('dataset.manage.delete.confirm')).toBeVisible();
    await expect(page.getByTestId('dataset.manage.delete.confirm.confirm')).toBeDisabled();
    await page.getByTestId('dataset.manage.delete.confirm.input').fill('wrong dataset');
    await expect(page.getByTestId('dataset.manage.delete.confirm.confirm')).toBeDisabled();
    await page.getByTestId('dataset.manage.delete.confirm.input').fill('tank/vps/ds10/appdata');
    await expect(page.getByTestId('dataset.manage.delete.confirm.confirm')).toBeEnabled();

    const deleteReq = page.waitForRequest((r) => r.method() === 'DELETE' && r.url().includes('/api/v7.0/datasets/11'));
    await page.getByTestId('dataset.manage.delete.confirm.confirm').click();
    await deleteReq;
    await expect(page).toHaveURL(/\/admin\/datasets$/);
  });

  test('lets normal users update size but hides admin-only dataset actions', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let updatePayload: any = null;

    await installHaveApiMock(page, {
      user: { id: 2, login: 'member', level: 1 },
      handlers: {
        'GET datasets/10': () => ({
          id: 10,
          full_name: 'tank/vps/ds10',
          name: 'ds10',
        used: 2048,
        avail: 10240,
        quota: 0,
        refquota: 10240,
        recordsize: 131072,
        compression: true,
        atime: false,
        relatime: false,
        sync: 'standard',
        snapshots_count: 2,
        mount_count: 0,
          export_count: 0,
          object_state: 'active',
          vps: { id: 300, hostname: 'alpha.example' },
        }),
        'GET transaction_chains': () => ({ transaction_chains: [], _meta: { total_count: 0 } }),
        'PUT datasets/10': ({ reqJson }) => {
          updatePayload = reqJson;
          return { status: true, response: null };
        },
      },
    });

    await page.goto('/app/datasets/10');
    await expect(page.getByTestId('dataset.manage')).toBeVisible();

    await expect(page.getByTestId('dataset.manage.create.open')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.delete.open')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.sharenfs')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.admin_lock_type')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.admin_override')).toHaveCount(0);

    await page.getByTestId('dataset.manage.refquota').fill('12');
    const editReq = page.waitForRequest((r) => r.method() === 'PUT' && r.url().includes('/api/v7.0/datasets/10'));
    await page.getByTestId('dataset.manage.edit.submit').click();
    expect((await editReq).postDataJSON()).toMatchObject({
      dataset: {
        refquota: 12288,
      },
    });
    expect(updatePayload).toMatchObject({
      dataset: {
        refquota: 12288,
      },
    });
  });

  test('hides admin-only dataset controls for admins in my view', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: {
        'GET datasets/10': () => ({
          id: 10,
          full_name: 'tank/vps/ds10',
          name: 'ds10',
          used: 2048,
          avail: 10240,
          quota: 0,
          refquota: 10240,
          recordsize: 131072,
          compression: true,
          atime: false,
          relatime: false,
          sync: 'standard',
          snapshots_count: 2,
          mount_count: 0,
          export_count: 0,
          object_state: 'active',
          vps: { id: 300, hostname: 'alpha.example' },
        }),
        'GET transaction_chains': () => ({ transaction_chains: [], _meta: { total_count: 0 } }),
      },
    });

    await page.goto('/app/datasets/10');
    await expect(page.getByTestId('dataset.manage')).toBeVisible();

    await expect(page.getByTestId('dataset.overview.actions')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.create.open')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.delete.open')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.sharenfs')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.admin_lock_type')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.admin_override')).toHaveCount(0);
  });
});
