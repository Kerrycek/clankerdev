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

test.describe('VPS maintenance tab', () => {
  test('opens a weekday and saves it via PUT', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'user', level: 1 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET ip_addresses': () => ({ ip_addresses: [] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET vpses/123/maintenance_windows': () => ({ maintenance_windows: [] }),
        'PUT vpses/123/maintenance_windows/1': () => ({ maintenance_window: { weekday: 1, is_open: true, opens_at: 0, closes_at: 1440 } }),
      },
    });

    await page.goto('/app/vps/123/maintenance');

    await expect(page.getByTestId('vps.maintenance.page')).toBeVisible();

    // Monday is weekday 1.
    await page.getByTestId('vps.maintenance.day.1.open').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'PUT' && r.url().includes('/api/v7.0/vpses/123/maintenance_windows/1')
    );

    await page.getByTestId('vps.maintenance.save').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      maintenance_window: {
        is_open: true,
        opens_at: 0,
        closes_at: 24 * 60,
      },
    });
  });
});
