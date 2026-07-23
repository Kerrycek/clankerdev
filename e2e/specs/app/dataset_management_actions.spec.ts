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
    await createModal.getByTestId('dataset.manage.create.refquota').fill('12');

    const createReq = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/api/v7.0/datasets'));
    await createModal.getByTestId('dataset.manage.create.submit').click();
    expect((await createReq).postDataJSON()).toEqual({
      dataset: {
        name: 'appdata',
        dataset: 10,
        automount: true,
        refquota: 12288,
      },
    });

    await expect(page).toHaveURL(/\/admin\/datasets\/11$/);
    await expect(page.getByTestId('dataset.header')).toContainText('tank/vps/ds10/appdata');

    await page.getByTestId('dataset.manage.quota').fill('20');
    await page.getByTestId('dataset.manage.advanced_properties.summary').click();
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
    await expect(page.getByTestId('dataset.manage.delete.confirm.confirm')).toBeEnabled();

    const deleteReq = page.waitForRequest((r) => r.method() === 'DELETE' && r.url().includes('/api/v7.0/datasets/11'));
    await page.getByTestId('dataset.manage.delete.confirm.confirm').click();
    await deleteReq;
    await expect(page).toHaveURL(/\/admin\/datasets$/);
  });

  test('lets a normal user create and safely delete an owned subdataset', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let deleteCalls = 0;
    const datasets: Record<number, any> = {
      10: {
        id: 10,
        full_name: 'tank/vps/ds10',
        name: 'ds10',
        user: { id: 2, login: 'member' },
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
      user: { id: 2, login: 'member', level: 1 },
      handlers: {
        'GET datasets': () => ({
          datasets: Object.values(datasets),
          _meta: { total_count: Object.keys(datasets).length },
        }),
        'GET datasets/10': () => datasets[10],
        'GET datasets/11': () => datasets[11],
        'GET transaction_chains': () => ({ transaction_chains: [], _meta: { total_count: 0 } }),
        'POST datasets': () => {
          datasets[11] = {
            ...datasets[10],
            id: 11,
            name: 'appdata',
            full_name: 'tank/vps/ds10/appdata',
            parent: { id: 10 },
          };
          return { dataset: datasets[11] };
        },
        'DELETE datasets/11': () => {
          deleteCalls += 1;
          delete datasets[11];
          return { status: true, response: null };
        },
      },
    });

    await page.goto('/app/datasets/10');
    await expect(page.getByTestId('dataset.manage')).toBeVisible();

    await expect(page.getByTestId('dataset.manage.create.open')).toBeVisible();
    await expect(page.getByTestId('dataset.manage.delete.open')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.sharenfs')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.admin_lock_type')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.admin_override')).toHaveCount(0);

    await page.getByTestId('dataset.manage.create.open').click();
    await page.getByTestId('dataset.manage.create.advanced_properties.summary').click();
    await expect(page.getByTestId('dataset.manage.create.recordsize')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('dataset.manage.create.modal')).toHaveCount(0);

    await page.getByTestId('dataset.manage.create.open').click();
    const createModal = page.getByTestId('dataset.manage.create.modal');
    await createModal.getByTestId('dataset.manage.create.name').fill('appdata');
    await expect(createModal.getByTestId('dataset.manage.create.advanced_properties')).not.toHaveAttribute('open');
    await expect(createModal.getByTestId('dataset.manage.create.recordsize')).not.toBeVisible();
    await expect(createModal.getByTestId('dataset.manage.create.sync')).not.toBeVisible();
    await expect(createModal.getByTestId('dataset.manage.create.atime')).not.toBeVisible();
    await expect(createModal.getByTestId('dataset.manage.create.relatime')).not.toBeVisible();
    await expect(createModal.getByTestId('dataset.manage.create.sharenfs')).toHaveCount(0);
    await expect(createModal.getByTestId('dataset.manage.create.admin_lock_type')).toHaveCount(0);
    await expect(createModal.getByTestId('dataset.manage.create.admin_override')).toHaveCount(0);

    const createReq = page.waitForRequest((request) =>
      request.method() === 'POST' && request.url().includes('/api/v7.0/datasets')
    );
    await createModal.getByTestId('dataset.manage.create.submit').click();
    expect((await createReq).postDataJSON()).toEqual({
      dataset: {
        name: 'appdata',
        dataset: 10,
        automount: true,
      },
    });

    await expect(page).toHaveURL(/\/app\/datasets\/11$/);
    await expect(page.getByTestId('dataset.manage.delete.open')).toBeVisible();
    await expect(page.getByTestId('dataset.manage.sharenfs')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.admin_lock_type')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.admin_override')).toHaveCount(0);

    await page.getByTestId('dataset.manage.delete.open').click();
    await expect(page.getByTestId('dataset.manage.delete.confirm')).toContainText(
      'tank/vps/ds10/appdata'
    );
    await page.getByTestId('dataset.manage.delete.confirm.cancel').click();
    await expect(page.getByTestId('dataset.manage.delete.confirm')).toBeHidden();
    expect(deleteCalls).toBe(0);

    await page.getByTestId('dataset.manage.delete.open').click();
    const deleteReq = page.waitForRequest((request) =>
      request.method() === 'DELETE' && request.url().includes('/api/v7.0/datasets/11')
    );
    await page.getByTestId('dataset.manage.delete.confirm.confirm').click();
    await deleteReq;
    expect(deleteCalls).toBe(1);
    await expect(page).toHaveURL(/\/app\/datasets$/);
  });

  test('denies dataset mutations without ownership', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const foreignDataset = {
      id: 21,
      full_name: 'tank/vps/foreign',
      name: 'foreign',
      user: { id: 99, login: 'someone-else' },
      parent: { id: 10 },
      object_state: 'active',
    };

    await installHaveApiMock(page, {
      user: { id: 2, login: 'member', level: 1 },
      handlers: {
        'GET datasets/21': () => foreignDataset,
        'GET transaction_chains': () => ({ transaction_chains: [], _meta: { total_count: 0 } }),
      },
    });

    await page.goto('/app/datasets/21');
    await expect(page.getByTestId('dataset.manage')).toBeVisible();
    await expect(page.getByTestId('dataset.manage.create.open')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.delete.open')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.edit.submit')).toBeDisabled();
    await expect(page.getByTestId('dataset.manage.sharenfs')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.admin_lock_type')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.admin_override')).toHaveCount(0);
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
          user: { id: 1, login: 'admin' },
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
    await expect(page.getByTestId('dataset.manage.create.open')).toBeVisible();
    await expect(page.getByTestId('dataset.manage.delete.open')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.sharenfs')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.admin_lock_type')).toHaveCount(0);
    await expect(page.getByTestId('dataset.manage.admin_override')).toHaveCount(0);
  });
});
