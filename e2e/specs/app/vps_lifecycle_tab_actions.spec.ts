import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const vps = {
  id: 123,
  hostname: 'vps123.example',
  object_state: 'active',
  is_running: false,
  enable_network: true,
  cpus: 2,
  memory: 2048,
  swap: 0,
  diskspace: 20480,
  used_memory: 768,
  used_swap: 0,
  used_diskspace: 5120,
  uptime: 0,
  loadavg1: 0,
  node: { id: 1, domain_name: 'node1.example' },
  user: { id: 7, login: 'owner' },
  os_template: { id: 6, label: 'Debian latest' },
  dns_resolver: 'inherit',
};

const osTemplates = [
  { id: 6, label: 'Debian latest', enabled: true, hypervisor_type: 'vpsadminos' },
  { id: 7, label: 'AlmaLinux 9', enabled: true, hypervisor_type: 'vpsadminos' },
];

async function installLifecycleMock(page: Page) {
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 99 },
    handlers: {
      'GET vpses/123': () => ({ vps }),
      'GET ip_addresses': () => ({ ip_addresses: [] }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'GET os_templates': () => ({ os_templates: osTemplates }),
      'POST vpses/123/boot': () => ({ _meta: { action_state_id: 501 } }),
      'POST vpses/123/reinstall': () => ({ _meta: { action_state_id: 502 } }),
    },
  });
}

test.describe('@pr-smoke VPS lifecycle tab', () => {
  test('posts legacy rescue boot payload', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installLifecycleMock(page);

    await page.goto('/admin/vps/123/lifecycle');

    await expect(page.getByTestId('vps.lifecycle.page')).toBeVisible();
    await expect(page.getByTestId('vps.lifecycle.boot')).toBeVisible();

    await page.getByTestId('vps.lifecycle.boot.os_template').selectOption('7');
    await page.getByTestId('vps.lifecycle.boot.mountpoint').fill('/mnt/rescue-root');
    await page.getByTestId('vps.lifecycle.boot.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/boot')
    );

    await page.getByTestId('vps.lifecycle.boot.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        os_template: 7,
        mount_root_dataset: '/mnt/rescue-root',
      },
    });
  });

  test('can boot rescue template without mounting the original root dataset', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installLifecycleMock(page);

    await page.goto('/admin/vps/123/lifecycle');

    await page.getByTestId('vps.lifecycle.boot.mount_root_dataset').uncheck();
    await expect(page.getByTestId('vps.lifecycle.boot.mountpoint')).toBeDisabled();
    await page.getByTestId('vps.lifecycle.boot.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/boot')
    );

    await page.getByTestId('vps.lifecycle.boot.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        os_template: 6,
      },
    });
  });

  test('posts legacy reinstall payload from lifecycle tab', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installLifecycleMock(page);

    await page.goto('/admin/vps/123/lifecycle');

    await page.getByTestId('vps.lifecycle.reinstall.os_template').selectOption('7');
    await page.getByTestId('vps.lifecycle.reinstall.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/reinstall')
    );

    await page.getByTestId('vps.lifecycle.reinstall.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        os_template: 7,
      },
    });
  });
});
