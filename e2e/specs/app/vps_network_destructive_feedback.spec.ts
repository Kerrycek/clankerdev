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
  user: { id: 7, login: 'member' },
  node: { id: 3, location: { id: 10, label: 'Prague' } },
};

const networkInterface = { id: 501, name: 'eth0', vps: { id: 123 } };

test.describe('VPS network destructive failure feedback', () => {
  test('keeps rejected host and route removals in context for retry', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let ipAddresses: any[] = [
      {
        id: 1,
        addr: '198.51.100.10',
        network_interface: networkInterface,
        routed: true,
        network: {
          role: 'public_access',
          purpose: 'vps',
          ip_version: 4,
          location: { id: 10, label: 'Prague' },
          primary_location: { id: 10, label: 'Prague' },
        },
      },
    ];
    let hostAddresses: any[] = [
      {
        id: 50,
        addr: '198.51.100.20',
        assigned: true,
        user_created: true,
        ip_address: { id: 1, addr: '198.51.100.10', network_interface: networkInterface },
      },
      {
        id: 51,
        addr: '198.51.100.21',
        assigned: false,
        user_created: true,
        ip_address: { id: 1, addr: '198.51.100.10', network_interface: networkInterface },
      },
    ];
    let freeHostAttempts = 0;
    let deleteHostAttempts = 0;
    let freeRouteAttempts = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET network_interfaces': () => ({ network_interfaces: [networkInterface] }),
        'GET network_interface_accountings': () => ({ network_interface_accountings: [] }),
        'GET ip_addresses': () => ({ ip_addresses: [...ipAddresses] }),
        'GET host_ip_addresses': () => ({ host_ip_addresses: [...hostAddresses] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'POST host_ip_addresses/50/free': () => {
          freeHostAttempts += 1;
          if (freeHostAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({ status: false, message: 'Host address assignment changed on the server.', response: null }),
            };
          }
          hostAddresses = hostAddresses.map((row) => row.id === 50 ? { ...row, assigned: false } : row);
          return { host_ip_address: hostAddresses.find((row) => row.id === 50), _meta: { action_state_id: 901 } };
        },
        'DELETE host_ip_addresses/51': () => {
          deleteHostAttempts += 1;
          if (deleteHostAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({ status: false, message: 'Host address is still referenced.', response: null }),
            };
          }
          hostAddresses = hostAddresses.filter((row) => row.id !== 51);
          return { host_ip_address: null, _meta: { action_state_id: 902 } };
        },
        'POST ip_addresses/1/free': () => {
          freeRouteAttempts += 1;
          if (freeRouteAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({ status: false, message: 'Route changed on the server.', response: null }),
            };
          }
          ipAddresses = ipAddresses.map((row) => row.id === 1 ? { ...row, network_interface: null, routed: false } : row);
          return { ip_address: ipAddresses[0], _meta: { action_state_id: 903 } };
        },
        'GET action_states/901': () => ({ action_state: { id: 901, finished: true, status: true, current: 1, total: 1 } }),
        'GET action_states/902': () => ({ action_state: { id: 902, finished: true, status: true, current: 1, total: 1 } }),
        'GET action_states/903': () => ({ action_state: { id: 903, finished: true, status: true, current: 1, total: 1 } }),
      },
    });

    await page.goto('/admin/vps/123/network');

    await page.getByTestId('vps.network.host_addresses.row.50.free').click();
    const freeHostDialog = page.getByTestId('vps.network.host_addresses.free_confirm');
    await expect(freeHostDialog).toContainText('198.51.100.20');
    await page.getByTestId('vps.network.host_addresses.free_confirm.confirm').click();
    await expect(page.getByTestId('vps.network.host_addresses.free_confirm.error')).toContainText(
      'Host address assignment changed on the server.'
    );
    await page.getByTestId('vps.network.host_addresses.free_confirm.confirm').click();
    await expect(freeHostDialog).toBeHidden();

    await page.getByTestId('vps.network.host_addresses.row.51.delete').click();
    const deleteHostDialog = page.getByTestId('vps.network.host_addresses.delete_confirm');
    await expect(deleteHostDialog).toContainText('198.51.100.21');
    await page.getByTestId('vps.network.host_addresses.delete_confirm.confirm').click();
    await expect(page.getByTestId('vps.network.host_addresses.delete_confirm.error')).toContainText(
      'Host address is still referenced.'
    );
    await page.getByTestId('vps.network.host_addresses.delete_confirm.confirm').click();
    await expect(deleteHostDialog).toBeHidden();

    await page.getByTestId('vps.network.ip_addresses.item.1.free_route').click();
    const freeRouteDialog = page.getByTestId('vps.network.ip_addresses.free_route_confirm');
    await expect(freeRouteDialog).toContainText('198.51.100.10');
    await page.getByTestId('vps.network.ip_addresses.free_route_confirm.confirm').click();
    await expect(page.getByTestId('vps.network.ip_addresses.free_route_confirm.error')).toContainText(
      'Route changed on the server.'
    );
    await page.getByTestId('vps.network.ip_addresses.free_route_confirm.confirm').click();
    await expect(freeRouteDialog).toBeHidden();

    expect({ freeHostAttempts, deleteHostAttempts, freeRouteAttempts }).toEqual({
      freeHostAttempts: 2,
      deleteHostAttempts: 2,
      freeRouteAttempts: 2,
    });
  });
});
