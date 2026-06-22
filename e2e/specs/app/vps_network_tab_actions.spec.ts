import { expect, test, type Page } from '@playwright/test';

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
    network: { role: 'public', purpose: 'public', ip_version: 4, location: { id: 10, label: 'Prague' } },
    user: { id: 20, login: 'old-owner' },
    routed: true,
  },
  {
    id: 2,
    addr: '198.51.100.20',
    network_interface: null,
    network: { role: 'public', purpose: 'public', ip_version: 4, location: { id: 10, label: 'Prague' } },
    user: { id: 20, login: 'old-owner' },
  },
];

const acct = [{ id: 1, bytes_in: 1024, bytes_out: 2048 }];

async function openAdvancedNetworkOptions(page: Page) {
  await page.getByTestId('vps.network.advanced.toggle').click();
}

test.describe('@pr-smoke VPS network tab', () => {
  test('edits interface and sends PUT', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET ip_addresses': () => ({ ip_addresses: ips }),
        'GET host_ip_addresses': () => ({ host_ip_addresses: [] }),
        'GET environments': () => ({ environments: [] }),
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
        'GET host_ip_addresses': () => ({ host_ip_addresses: [] }),
        'GET environments': () => ({ environments: [] }),
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

    await openAdvancedNetworkOptions(page);
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

  test('assigns unassigned route with host address and manages host PTR/create payloads', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let currentIps = [...ips];
    let hostAddresses = [
      {
        id: 50,
        addr: '198.51.100.10',
        assigned: true,
        reverse_record_value: 'old.example.test.',
        user_created: true,
        ip_address: { id: 1, addr: '198.51.100.10' },
      },
      {
        id: 51,
        addr: '198.51.100.11',
        assigned: false,
        user_created: true,
        ip_address: { id: 1, addr: '198.51.100.10' },
      },
    ];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET ip_addresses': () => ({ ip_addresses: currentIps }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET network_interfaces': () => ({ network_interfaces: netifs }),
        'GET network_interface_accountings': () => ({ network_interface_accountings: acct }),
        'GET host_ip_addresses': () => ({ host_ip_addresses: hostAddresses }),
        'GET environments': () => ({ environments: [{ id: 3, label: 'env-test' }] }),
        'POST ip_addresses/2/assign_with_host_address': () => {
          currentIps = currentIps.map((ip) => (ip.id === 2 ? { ...ip, network_interface: { id: 1 }, routed: true } : ip));
          return { ip_address: currentIps.find((ip) => ip.id === 2) };
        },
        'POST ip_addresses/1/free': () => {
          currentIps = currentIps.map((ip) => (ip.id === 1 ? { ...ip, network_interface: null, routed: false } : ip));
          return { ip_address: currentIps.find((ip) => ip.id === 1) };
        },
        'PUT ip_addresses/1': () => {
          currentIps = currentIps.map((ip) => (ip.id === 1 ? { ...ip, user: { id: 77, login: 'new-owner' } } : ip));
          return { ip_address: currentIps.find((ip) => ip.id === 1) };
        },
        'POST host_ip_addresses': () => {
          hostAddresses = [
            ...hostAddresses,
            {
              id: 52,
              addr: '198.51.100.12',
              assigned: false,
              user_created: true,
              ip_address: { id: 1, addr: '198.51.100.10' },
            },
          ];
          return { host_ip_address: hostAddresses[hostAddresses.length - 1] };
        },
        'POST host_ip_addresses/51/assign': () => {
          hostAddresses = hostAddresses.map((h) => (h.id === 51 ? { ...h, assigned: true } : h));
          return { host_ip_address: hostAddresses.find((h) => h.id === 51) };
        },
        'POST host_ip_addresses/50/free': () => {
          hostAddresses = hostAddresses.map((h) => (h.id === 50 ? { ...h, assigned: false } : h));
          return { host_ip_address: hostAddresses.find((h) => h.id === 50) };
        },
        'PUT host_ip_addresses/50': () => {
          hostAddresses = hostAddresses.map((h) =>
            h.id === 50 ? { ...h, reverse_record_value: 'new.example.test.' } : h
          );
          return { host_ip_address: hostAddresses[0] };
        },
      },
    });

    await page.goto('/admin/vps/123/network');
    await expect(page.getByTestId('vps.network.page')).toBeVisible();
    await openAdvancedNetworkOptions(page);

    await page.getByTestId('vps.network.ip_addresses.unassigned.2.assign').click();
    await expect(page.getByTestId('vps.network.ip_addresses.assign_route')).toBeVisible();
    await page.getByTestId('vps.network.ip_addresses.assign_route.interface').selectOption('1');
    await page.getByTestId('vps.network.ip_addresses.assign_route.with_host').check();

    const assignReq = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/ip_addresses/2/assign_with_host_address')
    );
    await page.getByTestId('vps.network.ip_addresses.assign_route.submit').click();
    expect((await assignReq).postDataJSON()).toEqual({
      ip_address: {
        network_interface: 1,
      },
    });
    await expect(page.getByTestId('vps.network.ip_addresses.assign_route')).toBeHidden();

    await page.getByTestId('vps.network.ip_addresses.item.1.host_create').click();
    await page.getByTestId('vps.network.host_addresses.create.addresses').fill('198.51.100.12');

    const createHostReq = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/host_ip_addresses')
    );
    await page.getByTestId('vps.network.host_addresses.create.submit').click();
    expect((await createHostReq).postDataJSON()).toEqual({
      host_ip_address: {
        ip_address: 1,
        addr: '198.51.100.12',
      },
    });

    await page.getByTestId('vps.network.host_addresses.row.51.assign').click();
    await page.getByTestId('vps.network.host_addresses.assign.interface').selectOption('1');

    const assignHostReq = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/host_ip_addresses/51/assign')
    );
    await page.getByTestId('vps.network.host_addresses.assign.submit').click();
    expect((await assignHostReq).postDataJSON()).toEqual({
      host_ip_address: {
        network_interface: 1,
      },
    });
    await expect(page.getByTestId('vps.network.host_addresses.assign')).toBeHidden();

    await page.getByTestId('vps.network.host_addresses.row.50.ptr').click();
    await page.getByTestId('vps.network.host_addresses.ptr.value').fill('new.example.test.');

    const ptrReq = page.waitForRequest(
      (r) => r.method() === 'PUT' && r.url().includes('/api/v7.0/host_ip_addresses/50')
    );
    await page.getByTestId('vps.network.host_addresses.ptr.submit').click();
    expect((await ptrReq).postDataJSON()).toEqual({
      host_ip_address: {
        reverse_record_value: 'new.example.test.',
      },
    });

    await page.getByTestId('vps.network.host_addresses.row.50.free').click();
    await expect(page.getByTestId('vps.network.host_addresses.free_confirm')).toBeVisible();
    const freeHostReq = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/host_ip_addresses/50/free')
    );
    await page.getByTestId('vps.network.host_addresses.free_confirm.confirm').click();
    expect((await freeHostReq).postData()).toBe('{}');

    await page.getByTestId('vps.network.ip_addresses.item.1.owner').click();
    await page.getByTestId('vps.network.ip_addresses.owner.user').fill('77');
    await page.getByTestId('vps.network.ip_addresses.owner.environment').selectOption('3');
    const ownerReq = page.waitForRequest(
      (r) => r.method() === 'PUT' && r.url().includes('/api/v7.0/ip_addresses/1')
    );
    await page.getByTestId('vps.network.ip_addresses.owner.submit').click();
    expect((await ownerReq).postDataJSON()).toEqual({
      ip_address: {
        user: 77,
        environment: 3,
      },
    });

    await page.getByTestId('vps.network.ip_addresses.item.1.free_route').click();
    await expect(page.getByTestId('vps.network.ip_addresses.free_route_confirm')).toBeVisible();
    const freeRouteReq = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/ip_addresses/1/free')
    );
    await page.getByTestId('vps.network.ip_addresses.free_route_confirm.confirm').click();
    expect((await freeRouteReq).postData()).toBe('{}');
  });

  test('keeps admin-only networking actions hidden for normal users', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 2, login: 'user', level: 1 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET ip_addresses': () => ({ ip_addresses: ips }),
        'GET host_ip_addresses': () => ({
          host_ip_addresses: [
            {
              id: 50,
              addr: '198.51.100.10',
              assigned: true,
              reverse_record_value: 'old.example.test.',
              user_created: true,
              ip_address: { id: 1, addr: '198.51.100.10' },
            },
          ],
        }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET network_interfaces': () => ({ network_interfaces: netifs }),
        'GET network_interface_accountings': () => ({ network_interface_accountings: acct }),
      },
    });

    await page.goto('/app/vps/123/network');
    await expect(page.getByTestId('vps.network.page')).toBeVisible();
    await openAdvancedNetworkOptions(page);
    await expect(page.getByTestId('vps.network.host_addresses')).toBeVisible();
    await expect(page.getByTestId('vps.network.host_addresses.row.50.ptr')).toBeVisible();
    await expect(page.getByTestId('vps.network.ip_addresses.item.1.host_create')).toBeVisible();
    await expect(page.getByTestId('vps.network.ip_addresses.item.1.owner')).toHaveCount(0);
    await expect(page.getByTestId('vps.network.ip_addresses.item.1.free_route')).toHaveCount(0);
    await expect(page.getByTestId('vps.network.ip_addresses.unassigned.2.assign')).toHaveCount(0);
    await expect(page.getByTestId('vps.network.disable')).toHaveCount(0);
  });
});
