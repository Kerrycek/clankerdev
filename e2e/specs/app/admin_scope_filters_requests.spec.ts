import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Admin My view filtering', () => {
  test('Mine scope adds user filter; admin scope does not', async ({ page }) => {
    const ADMIN_USER_ID = 42;

    let phase: 'app' | 'admin' = 'app';

    let lastVpsUserParam: string | null = null;
    let lastDatasetsUserParam: string | null = null;
    let lastZonesUserParam: string | null = null;

    // Capture a second set for /admin.
    let lastVpsUserParamAdmin: string | null = null;
    let lastDatasetsUserParamAdmin: string | null = null;
    let lastZonesUserParamAdmin: string | null = null;

    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: ADMIN_USER_ID, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': (ctx) => {
          const user = ctx.searchParams.get('vps[user]');
          if (phase === 'app') lastVpsUserParam = user;
          if (phase === 'admin') lastVpsUserParamAdmin = user;
          return {
            vpses: [
              {
                id: 1,
                hostname: 'vps1.example',
                object_state: 'active',
                is_running: true,
                node: { id: 1, domain_name: 'node1' },
                cpus: 2,
                memory: 1024,
                diskspace: 10240,
                used_memory: 512,
                used_diskspace: 2048,
                uptime: 123,
                loadavg1: 0.1,
              },
            ],
          };
        },
        'GET datasets': (ctx) => {
          const user = ctx.searchParams.get('dataset[user]');
          if (phase === 'app') lastDatasetsUserParam = user;
          if (phase === 'admin') lastDatasetsUserParamAdmin = user;
          return {
            datasets: [
              {
                id: 10,
                name: 'data',
                full_name: 'data',
                object_state: 'active',
              },
            ],
          };
        },
        'GET dns_zones': (ctx) => {
          const user = ctx.searchParams.get('dns_zone[user]');
          if (phase === 'app') lastZonesUserParam = user;
          if (phase === 'admin') lastZonesUserParamAdmin = user;
          return {
            dns_zones: [
              {
                id: 7,
                name: 'example.com',
                object_state: 'active',
              },
            ],
          };
        },
      },
    });

    // Mine scope (/app)
    phase = 'app';
    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    expect(lastVpsUserParam).toBe(String(ADMIN_USER_ID));

    phase = 'app';
    await page.goto('/app/datasets');
    await expect(page.getByTestId('datasets.list')).toBeVisible();
    expect(lastDatasetsUserParam).toBe(String(ADMIN_USER_ID));

    phase = 'app';
    await page.goto('/app/dns');
    await expect(page.getByTestId('dns.zones.list')).toBeVisible();
    expect(lastZonesUserParam).toBe(String(ADMIN_USER_ID));

    // Admin scope (/admin)
    phase = 'admin';
    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    expect(lastVpsUserParamAdmin).toBeNull();

    phase = 'admin';
    await page.goto('/admin/datasets');
    await expect(page.getByTestId('datasets.list')).toBeVisible();
    expect(lastDatasetsUserParamAdmin).toBeNull();

    phase = 'admin';
    await page.goto('/admin/dns');
    await expect(page.getByTestId('dns.zones.list')).toBeVisible();
    expect(lastZonesUserParamAdmin).toBeNull();
  });
});
