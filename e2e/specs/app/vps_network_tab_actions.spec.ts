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

const netifs = [
  {
    id: 1,
    name: 'eth0',
    type: 'virtio',
    enable: false,
    max_tx: 100 * 1024 * 1024,
    max_rx: 200 * 1024 * 1024,
  },
];

const ips = [
  {
    id: 1,
    addr: '198.51.100.10',
    network_interface: { id: 1 },
    network: { role: 'public', purpose: 'public' },
  },
];

const acct = [{ id: 1, bytes_in: 1024, bytes_out: 2048 }];

test.describe('VPS network tab', () => {
  test('edits interface and sends PUT', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET ip_addresses': () => ({ ip_addresses: ips }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET network_interfaces': () => ({ network_interfaces: netifs }),
        'GET network_interface_accountings': () => ({ network_interface_accountings: acct }),
        'PUT network_interfaces/1': () => ({
          network_interface: { ...netifs[0] },
        }),
      },
    });

    await page.goto('/app/vps/123/network');

    await expect(page.getByTestId('vps.network.page')).toBeVisible();
    await expect(page.getByTestId('vps.network.interfaces.table')).toBeVisible();
    await expect(page.getByTestId('vps.network.interfaces.row.1')).toHaveAttribute('data-row-variant', 'warn');
    await expect(page.getByTestId('vps.network.interfaces.row.1.dot')).toBeVisible();

    await page.getByTestId('vps.network.interfaces.row.1.edit').click();
    await expect(page.getByTestId('vps.network.edit')).toBeVisible();

    await page.getByTestId('vps.network.edit.name').fill('eth0-renamed');
    await page.getByTestId('vps.network.edit.max_tx').fill('500');
    await page.getByTestId('vps.network.edit.max_rx').fill('600');

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'PUT' && r.url().includes('/api/v7.0/network_interfaces/1')
    );

    await page.getByTestId('vps.network.edit.save').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      network_interface: {
        name: 'eth0-renamed',
        enable: false,
        max_tx: 500 * 1024 * 1024,
        max_rx: 600 * 1024 * 1024,
      },
    });

    await expect(page.getByTestId('vps.network.edit')).toBeHidden();
  });

  test('disables VPS networking with a change reason', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let enabled = true;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET vpses/123': () => ({ vps: { ...vps, enable_network: enabled } }),
        'GET ip_addresses': () => ({ ip_addresses: ips }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET network_interfaces': () => ({ network_interfaces: netifs }),
        'GET network_interface_accountings': () => ({ network_interface_accountings: acct }),
        'PUT vpses/123': async () => {
          enabled = false;
          return { vps: { ...vps, enable_network: enabled } };
        },
      },
    });

    await page.goto('/app/vps/123/network');

    await expect(page.getByTestId('vps.network.disable')).toBeVisible();
    await page.getByTestId('vps.network.disable').click();

    await expect(page.getByTestId('vps.network.disable_confirm')).toBeVisible();

    await page.getByTestId('vps.network.disable.reason').fill('Testing');

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'PUT' && r.url().includes('/api/v7.0/vpses/123')
    );

    await page.getByTestId('vps.network.disable_confirm.confirm').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        enable_network: false,
        change_reason: 'Testing',
      },
    });

    await expect(page.getByTestId('vps.network.disable_confirm')).toBeHidden();
  });
});
