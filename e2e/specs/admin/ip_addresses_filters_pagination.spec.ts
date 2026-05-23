import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('admin ip addresses: filters + keyset pagination (from_id)', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  let seenFilterAddr: string | null = null;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET ip_addresses': (ctx) => {
        const fromId = ctx.searchParams.get('ip_address[from_id]');
        const limitStr = ctx.searchParams.get('ip_address[limit]');
        const limit = limitStr ? Number(limitStr) : 50;

        const addr = ctx.searchParams.get('ip_address[addr]');
        const vps = ctx.searchParams.get('ip_address[vps]');
        const version = ctx.searchParams.get('ip_address[version]');

        if (addr) seenFilterAddr = addr;

        const startId = fromId ? Number(fromId) - 1 : 125;
        const count = Number.isFinite(limit) && limit > 0 ? limit : 50;

        const base = addr && addr.includes('.') ? addr.split('.').slice(0, 3).join('.') : '192.0.2';

        const ip_addresses = Array.from({ length: count }, (_, i) => {
          const id = startId - i;
          const ip = `${base}.${(id % 200) + 1}`;
          return {
            id,
            addr: ip,
            prefix: 32,
            routed: id % 2 === 0,
            user: { id: 1000 + (id % 10), login: `u${id % 10}` },
            vps: { id: 2000 + (id % 10), hostname: `vps${id % 10}` },
            network: { id: 3000, address: '192.0.2.0', prefix: 24 },
            network_interface: id % 2 === 0 ? { id: 4000, name: 'eth0' } : null,
            created_at: '2025-01-01T00:00:00Z',
            _filters: { addr, vps, version },
          };
        }).filter((it) => it.id > 0);

        return { ip_addresses };
      },
    },
  });

  await page.goto('/admin/ip-addresses');

  await expect(page.getByTestId('admin.ip_addresses.row.125')).toBeVisible();
  await expect(page.getByTestId('admin.ip_addresses.row.125')).toHaveAttribute('data-row-variant', 'warn');
  await expect(page.getByTestId('admin.ip_addresses.row.125.dot')).toBeVisible();

  // Apply a server-side filter.
  const filteredReq = page.waitForRequest((req) => {
    const u = req.url();
    return u.includes('/api/v7.0/ip_addresses') && u.includes('ip_address%5Baddr%5D=10.0.0');
  });
  const sfi = page.getByTestId('admin.ip_addresses.smart_filter.input');
  await sfi.fill('addr:10.0.0');
  await sfi.press('Enter');
  await filteredReq;
  expect(seenFilterAddr).toBe('10.0.0');

  // Next page uses from_id.
  await page.getByTestId('admin.ip_addresses.pagination.desktop.next').click();
  await expect(page.getByTestId('admin.ip_addresses.row.75')).toBeVisible();
  await expect(page.getByTestId('admin.ip_addresses.row.75')).toHaveAttribute('data-row-variant', 'warn');
});
