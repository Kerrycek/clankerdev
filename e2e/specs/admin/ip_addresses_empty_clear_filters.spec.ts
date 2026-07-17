import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('admin ip addresses: empty state clears server-side filters', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET locations': () => ({ locations: [] }),
      'GET ip_addresses': (ctx) => {
        const addr = ctx.searchParams.get('ip_address[addr]');
        const limitStr = ctx.searchParams.get('ip_address[limit]');
        const limit = limitStr ? Number(limitStr) : 50;

        // When a server-side filter is active, return nothing.
        if (addr) return { ip_addresses: [] };

        const count = Number.isFinite(limit) && limit > 0 ? limit : 50;
        const startId = 125;
        const ip_addresses = Array.from({ length: count }, (_, i) => {
          const id = startId - i;
          const ip = `192.0.2.${(id % 200) + 1}`;
          return {
            id,
            addr: ip,
            prefix: 32,
            routed: id % 2 === 0,
            user: { id: 1000 + (id % 10), login: `u${id % 10}` },
            vps: { id: 2000 + (id % 10), hostname: `vps${id % 10}` },
            network: { id: 3000, address: '192.0.2.0', prefix: 24 },
            network_interface: { id: 4000, name: 'eth0' },
            created_at: '2025-01-01T00:00:00Z',
          };
        }).filter((it) => it.id > 0);

        return { ip_addresses };
      },
    },
  });

  await page.goto('/admin/ip-addresses?addr=10.0.0');

  await expect(page.getByTestId('admin.ip_addresses.empty')).toBeVisible();

  // Clear filters from the empty state.
  await page.getByTestId('admin.ip_addresses.empty.action').click();

  await expect(page.getByTestId('admin.ip_addresses.row.125')).toBeVisible();
});
