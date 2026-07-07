import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

async function openCommandPalette(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
  });
  await expect(page.getByTestId('palette.modal')).toBeVisible();
}

test.describe('Command palette', () => {
  test('opens and searches VPSes in user view', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'user', level: 1 },
      handlers: {
        'GET vpses': (ctx) => {
          // Both the list page and command palette search use this endpoint.
          const q = String(ctx.searchParams.get('vps[hostname_any]') ?? '').trim();
          const list = q
            ? [
                {
                  id: 3,
                  hostname: 'vps3.example',
                  object_state: 'active',
                  is_running: true,
                  cpus: 2,
                  memory: 2048,
                  diskspace: 20480,
                  used_memory: 512,
                  used_diskspace: 4096,
                  node: { id: 1, domain_name: 'node1' },
                },
              ]
            : [
                {
                  id: 3,
                  hostname: 'vps3.example',
                  object_state: 'active',
                  is_running: true,
                  cpus: 2,
                  memory: 2048,
                  diskspace: 20480,
                  used_memory: 512,
                  used_diskspace: 4096,
                  node: { id: 1, domain_name: 'node1' },
                },
              ];

          return { vpses: list };
        },
        'GET vpses/3': () => ({
          vps: {
            id: 3,
            hostname: 'vps3.example',
            object_state: 'active',
            is_running: true,
            cpus: 2,
            memory: 2048,
            diskspace: 20480,
            used_memory: 512,
            used_diskspace: 4096,
            node: { id: 1, domain_name: 'node1', location: { id: 1, label: 'DC1' } },
            user: { id: 1, login: 'user' },
          },
        }),
        'GET vpses/3/statuses': () => [],
        'GET ip_addresses': (ctx) => {
          const vpsId = ctx.searchParams.get('ip_address[vps]');
          if (vpsId !== '3') return [];
          return [
            {
              id: 10,
              addr: '203.0.113.10',
              prefix: 32,
              routed: true,
              network: { id: 1, address: '203.0.113.0', prefix: 24, role: 'public', purpose: 'public' },
            },
          ];
        },
      },
    });

    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();

    await openCommandPalette(page);

    await page.getByTestId('palette.input').fill('vps3');
    await expect(page.getByTestId('palette.result.0')).toBeVisible();
    await page.getByTestId('palette.result.0').click();

    await expect(page).toHaveURL(/\/app\/vps\/3$/);
    await expect(page.getByTestId('vps.header')).toBeVisible();
  });

  test('supports quick-jump by VPS numeric ID in user view', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'user', level: 1 },
      handlers: {
        'GET vpses': (ctx) => {
          // When searching by ID we intentionally do not rely on hostname_any.
          // Returning empty list ensures the palette uses the show action.
          const q = String(ctx.searchParams.get('vps[hostname_any]') ?? '').trim();
          if (q === '3') return { vpses: [] };
          return {
            vpses: [
              {
                id: 3,
                hostname: 'vps3.example',
                object_state: 'active',
                is_running: true,
                cpus: 2,
                memory: 2048,
                diskspace: 20480,
                used_memory: 512,
                used_diskspace: 4096,
                node: { id: 1, domain_name: 'node1' },
              },
            ],
          };
        },
        'GET vpses/3': () => ({
          vps: {
            id: 3,
            hostname: 'vps3.example',
            object_state: 'active',
            is_running: true,
            cpus: 2,
            memory: 2048,
            diskspace: 20480,
            used_memory: 512,
            used_diskspace: 4096,
            node: { id: 1, domain_name: 'node1', location: { id: 1, label: 'DC1' } },
            user: { id: 1, login: 'user' },
          },
        }),
        'GET vpses/3/statuses': () => [],
      },
    });

    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();

    await openCommandPalette(page);

    await page.getByTestId('palette.input').fill('3');
    await expect(page.getByTestId('palette.result.0')).toBeVisible();
    await page.getByTestId('palette.result.0').click();

    await expect(page).toHaveURL(/\/app\/vps\/3$/);
    await expect(page.getByTestId('vps.header')).toBeVisible();
  });

  test('searches cluster objects in admin view', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': () => ({
          cluster_search: [{ resource: 'User', id: 5, value: 'alice', attribute: 'login' }],
        }),
        'GET users/5': () => ({ user: { id: 5, login: 'alice', full_name: 'Alice A.', email: 'alice@example', level: 1 } }),
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    await openCommandPalette(page);

    await page.getByTestId('palette.input').fill('alice');
    await expect(page.getByTestId('palette.result.0')).toBeVisible();
    await page.getByTestId('palette.result.0').click();

    await expect(page).toHaveURL(/\/admin\/users\/5$/);
    await expect(page.getByTestId('admin.user.page')).toBeVisible();
  });

  test('navigates to IP address detail from cluster search (admin view)', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': () => ({
          cluster_search: [{ resource: 'IpAddress', id: 7, value: '203.0.113.10', attribute: 'addr' }],
        }),
        'GET ip_addresses/7': () => ({
          ip_address: {
            id: 7,
            addr: '203.0.113.10',
            prefix: 32,
            routed: true,
            network: { id: 1, address: '203.0.113.0', prefix: 24, role: 'public', purpose: 'public' },
            user: { id: 5, login: 'alice', level: 1 },
            vps: { id: 3, hostname: 'vps3.example' },
          },
        }),
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    await openCommandPalette(page);

    await page.getByTestId('palette.input').fill('203.0.113.10');
    await expect(page.getByTestId('palette.result.0')).toBeVisible();
    await page.getByTestId('palette.result.0').click();

    await expect(page).toHaveURL(/\/admin\/ip-addresses\/7$/);
    await expect(page.getByTestId('admin.ip_address.page')).toBeVisible();
  });

  test('shows help when query is "?" and does not issue search requests', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let called = false;

    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': () => {
          called = true;
          return { cluster_search: [] };
        },
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    await openCommandPalette(page);

    await page.getByTestId('palette.input').fill('?');
    await expect(page.getByTestId('palette.help')).toBeVisible();

    expect(called).toBeFalsy();
  });
});
