import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('ListShell primitives', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET transactions': () => ({
          transactions: [
            {
              id: 301,
              name: 'vps.start',
              done: 'done',
              success: 1,
              created_at: '2026-01-01T00:00:00Z',
              finished_at: '2026-01-01T00:00:01Z',
              transaction_chain: { id: 10 },
              node: { id: 1, domain_name: 'node1' },
              vps: { id: 101 },
              type: 1,
            },
          ],
        }),
        'GET vpses': () => ({
          vpses: [
            {
              id: 101,
              hostname: 'vps101.example',
              object_state: 'active',
              is_running: true,
              node: { id: 1, domain_name: 'node1' },
              cpu: 2,
              memory: 2048,
              diskspace: 10240,
              used_memory: 512,
              used_diskspace: 2048,
              uptime: 123,
              loadavg1: 0.1,
            },
          ],
        }),
        'GET datasets': () => ({
          datasets: [
            {
              id: 201,
              full_name: 'tank/vps/ds201',
              name: 'ds201',
              used: 512,
              refquota: 4096,
              snapshots_count: 0,
              mount_count: 0,
              export_count: 0,
              object_state: 'active',
              vps: { id: 101, hostname: 'vps101.example' },
            },
          ],
        }),
        'GET dns_zones': () => ({
          dns_zones: [
            {
              id: 301,
              name: 'zone301.example',
              role: 'primary',
              enabled: true,
              dnssec_enabled: false,
              serial: 2026013101,
              default_ttl: 3600,
            },
          ],
        }),
      },
    });
  });

  test('list pages expose header + filters testids', async ({ page }) => {
    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.list.header')).toBeVisible();
    await expect(page.getByTestId('vps.list.filters')).toBeVisible();

    await page.goto('/app/datasets');
    await expect(page.getByTestId('datasets.list.header')).toBeVisible();
    await expect(page.getByTestId('datasets.list.filters')).toBeVisible();

    await page.goto('/app/dns');
    await expect(page.getByTestId('dns.zones.list.header')).toBeVisible();
    await expect(page.getByTestId('dns.zones.list.filters')).toBeVisible();

    await page.goto('/app/transactions');
    await expect(page.getByTestId('transactions.list.header')).toBeVisible();
    await expect(page.getByTestId('transactions.list.filters')).toBeVisible();

    await page.goto('/app/action-states');
    await expect(page.getByTestId('action_states.list.header')).toBeVisible();
    await expect(page.getByTestId('action_states.list.filters')).toBeVisible();

    await page.goto('/app/transactions/items');
    await expect(page.getByTestId('transactions.items.list.header')).toBeVisible();
    await expect(page.getByTestId('transactions.items.list.filters')).toBeVisible();
    await expect(page.getByTestId('transactions.items.pagination')).toBeVisible();
  });
});
