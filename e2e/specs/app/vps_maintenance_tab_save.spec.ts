import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock } from '../../fixtures';

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
    const maintenanceWindows: Array<{ weekday: number; is_open: boolean; opens_at: number; closes_at: number }> = [];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'user', level: 1 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET ip_addresses': () => ({ ip_addresses: [] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET vpses/123/maintenance_windows': () => ({ maintenance_windows: [...maintenanceWindows] }),
        'PUT vpses/123/maintenance_windows/1': () => {
          const saved = { weekday: 1, is_open: true, opens_at: 0, closes_at: 1440 };
          maintenanceWindows.push(saved);
          return { maintenance_window: saved };
        },
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
    await expect(page.getByTestId('vps.maintenance.save_success')).toBeVisible();
    await expect(page.getByTestId('vps.maintenance.save')).toBeDisabled();
  });

  test('reconciles a partial save and retries only the remaining weekday', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const maintenanceWindows: Array<{ weekday: number; is_open: boolean; opens_at: number; closes_at: number }> = [];
    let mondayCalls = 0;
    let tuesdayCalls = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'user', level: 1 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET ip_addresses': () => ({ ip_addresses: [] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET vpses/123/maintenance_windows': () => ({ maintenance_windows: [...maintenanceWindows] }),
        'PUT vpses/123/maintenance_windows/1': () => {
          mondayCalls += 1;
          const saved = { weekday: 1, is_open: true, opens_at: 0, closes_at: 1440 };
          maintenanceWindows.push(saved);
          return { maintenance_window: saved };
        },
        'PUT vpses/123/maintenance_windows/2': () => {
          tuesdayCalls += 1;
          if (tuesdayCalls === 1) return failEnvelope('Temporary Tuesday failure');

          const saved = { weekday: 2, is_open: true, opens_at: 0, closes_at: 1440 };
          maintenanceWindows.push(saved);
          return { maintenance_window: saved };
        },
      },
    });

    await page.goto('/app/vps/123/maintenance');
    await page.getByTestId('vps.maintenance.day.1.open').check();
    await page.getByTestId('vps.maintenance.day.2.open').check();
    await expect(page.getByTestId('vps.maintenance.save')).toContainText('(2)');

    await page.getByTestId('vps.maintenance.save').click();

    const error = page.getByTestId('vps.maintenance.save_error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Temporary Tuesday failure');
    await expect(page.getByTestId('vps.maintenance.save')).toContainText('(1)');
    expect(mondayCalls).toBe(1);
    expect(tuesdayCalls).toBe(1);

    await page.getByTestId('vps.maintenance.save').click();
    await expect(page.getByTestId('vps.maintenance.save_success')).toBeVisible();
    await expect(page.getByTestId('vps.maintenance.save')).toBeDisabled();
    expect(mondayCalls).toBe(1);
    expect(tuesdayCalls).toBe(2);
  });
});
