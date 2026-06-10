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
  dataset: { id: 10, name: 'tank/data' },
  node: {
    id: 1,
    domain_name: 'node1.example',
    location: { id: 2, label: 'Praha', remote_console_server: '/_console' },
  },
  user: { id: 10, login: 'alice' },
  os_template: { id: 6, label: 'Debian 12' },
  dns_resolver: 'inherit',
};

const dataset = {
  id: 10,
  name: 'tank/data',
  full_name: 'tank/data',
  used: 5120,
  avail: 15360,
  referenced: 4096,
  refquota: 20480,
  quota: 0,
  snapshots_count: 1,
  mount_count: 1,
  export_count: 0,
  object_state: 'active',
};

test('@workflow-matrix @smoke VPS detail tabs expose storage, lifecycle, and console routes', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_USER_SESSION' });

  await page.route('**/_console/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body>console stub</body></html>',
    });
  });

  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET vpses': () => ({ vpses: [vps], _meta: { total_count: 1 } }),
      'GET vpses/123': () => ({ vps }),
      'GET datasets/10': () => ({ dataset }),
      'GET ip_addresses': () => ({ ip_addresses: [] }),
      'GET vpses/123/statuses': () => ({ statuses: [] }),
      'GET vpses/123/mounts': () => ({
        mounts: [
          {
            id: 1,
            mountpoint: '/mnt/data',
            type: 'nfs',
            mode: 'rw',
            enabled: true,
            on_start_fail: 'ignore',
            use_default_map: true,
            dataset: { id: 10, name: 'tank/data' },
          },
        ],
      }),
      'GET vpses/123/state_logs': () => ({ state_logs: [] }),
      'GET os_templates': () => ({
        os_templates: [{ id: 6, label: 'Debian 12', enabled: true, hypervisor_type: 'vpsadminos' }],
      }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'POST vpses/123/console_token': () => ({
        token: 'T1',
        expiration: '2027-01-31T00:00:00Z',
      }),
    },
  });

  await page.goto('/app/vps');
  await page.getByRole('link', { name: /vps123\.example/i }).click();

  await expect(page).toHaveURL(/\/app\/vps\/123$/);
  await expect(page.getByTestId('vps.header')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Storage$/ })).toHaveAttribute('href', '/app/vps/123/storage');
  await expect(page.getByRole('link', { name: /^Lifecycle$/ })).toHaveAttribute('href', '/app/vps/123/lifecycle');
  await expect(page.getByRole('link', { name: /^Console$/ }).first()).toHaveAttribute('href', '/app/vps/123/console');

  await page.getByRole('link', { name: /^Storage$/ }).click();
  await expect(page).toHaveURL(/\/app\/vps\/123\/storage$/);
  await expect(page.getByTestId('vps.storage.page')).toBeVisible();
  await expect(page.getByTestId('vps.storage.mounts.table')).toBeVisible();

  await page.getByRole('link', { name: /^Lifecycle$/ }).click();
  await expect(page).toHaveURL(/\/app\/vps\/123\/lifecycle$/);
  await expect(page.getByTestId('vps.lifecycle.page')).toBeVisible();
  await expect(page.getByTestId('vps.lifecycle.action_index')).toBeVisible();
  await expect(page.getByTestId('vps.lifecycle.action_link.clone')).toBeVisible();
  await page.getByTestId('vps.lifecycle.action_link.clone').click();
  await expect(page).toHaveURL(/\/app\/vps\/123\/lifecycle\/clone$/);
  await expect(page.getByTestId('vps.lifecycle.clone')).toBeVisible();
  await expect(page.getByTestId('vps.lifecycle.replace')).toHaveCount(0);

  await page.getByRole('link', { name: /^Console$/ }).first().click();
  await expect(page).toHaveURL(/\/app\/vps\/123\/console$/);
  await expect(page.getByTestId('vps.console.page')).toBeVisible();
  await expect(page.getByTestId('vps.console.iframe')).toBeVisible();
});
