import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const vps = {
  id: 123,
  hostname: 'vps123.example',
  object_state: 'active',
  is_running: true,
  enable_network: true,
  cpus: 2,
  memory: 2048,
  swap: 0,
  diskspace: 20480,
  used_memory: 768,
  used_swap: 0,
  used_diskspace: 5120,
  uptime: 12345,
  loadavg1: 0.12,
  node: { id: 1, domain_name: 'node1.example' },
  os_template: { label: 'debian' },
  dns_resolver: 'inherit',
};

const dataset = {
  id: 10,
  name: 'tank/data',
};

test.describe('VPS storage tab mounts', () => {
  test('creates mount by finding dataset and posting', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let mounts = [
      {
        id: 1,
        mountpoint: '/mnt/old',
        type: 'nfs',
        mode: 'ro',
        enabled: true,
        on_start_fail: 'ignore',
        use_default_map: true,
        dataset: { id: 9, name: 'tank/old' },
        created_at: '2026-01-31T00:00:00Z',
      },
    ];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'user', level: 1 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET ip_addresses': () => ({ ip_addresses: [] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET vpses/123/mounts': () => ({ mounts }),
        'GET datasets/find_by_name': () => ({ dataset }),
        'POST vpses/123/mounts': () => {
          const created = {
            id: 2,
            mountpoint: '/mnt/data',
            type: 'nfs',
            mode: 'rw',
            enabled: true,
            on_start_fail: 'ignore',
            use_default_map: true,
            dataset: { ...dataset },
            created_at: '2026-01-31T01:00:00Z',
          };
          mounts = [...mounts, created];
          return { mount: created };
        },
      },
    });

    await page.goto('/app/vps/123/storage');

    await expect(page.getByTestId('vps.storage.page')).toBeVisible();
    await expect(page.getByTestId('vps.storage.mounts.table')).toBeVisible();

    await page.getByTestId('vps.storage.mounts.add').click();
    await expect(page.getByTestId('vps.storage.mounts.create')).toBeVisible();

    await page.getByTestId('vps.storage.mounts.create.dataset').fill('tank/data');
    await page.getByTestId('vps.storage.mounts.create.find_dataset').click();

    await page.getByTestId('vps.storage.mounts.create.mountpoint').fill('/mnt/data');

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/mounts')
    );

    await page.getByTestId('vps.storage.mounts.create.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      mount: {
        dataset: 10,
        mountpoint: '/mnt/data',
        type: 'nfs',
        mode: 'rw',
        on_start_fail: 'ignore',
        enabled: true,
        use_default_map: true,
      },
    });

    await expect(page.getByTestId('vps.storage.mounts.create')).toBeHidden();
    await expect(page.getByTestId('vps.storage.mounts.row.2')).toBeVisible();
  });

  test('deletes mount via confirm dialog', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let mounts = [
      {
        id: 1,
        mountpoint: '/mnt/old',
        type: 'nfs',
        mode: 'ro',
        enabled: true,
        on_start_fail: 'ignore',
        use_default_map: true,
        dataset: { id: 9, name: 'tank/old' },
        created_at: '2026-01-31T00:00:00Z',
      },
    ];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'user', level: 1 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET ip_addresses': () => ({ ip_addresses: [] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET vpses/123/mounts': () => ({ mounts }),
        'DELETE vpses/123/mounts/1': () => {
          mounts = mounts.filter((m) => m.id !== 1);
          return { status: true, response: null };
        },
      },
    });

    await page.goto('/app/vps/123/storage');

    await expect(page.getByTestId('vps.storage.mounts.row.1')).toBeVisible();

    await page.getByTestId('vps.storage.mounts.row.1.delete').click();
    await expect(page.getByTestId('vps.storage.mounts.delete_confirm')).toBeVisible();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'DELETE' && r.url().includes('/api/v7.0/vpses/123/mounts/1')
    );

    await page.getByTestId('vps.storage.mounts.delete_confirm.confirm').click();

    await reqPromise;

    await expect(page.getByTestId('vps.storage.mounts.delete_confirm')).toBeHidden();
  });
});
