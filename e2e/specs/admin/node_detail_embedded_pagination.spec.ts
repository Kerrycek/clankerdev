import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Admin node detail: embedded keyset pagination', () => {
  test('paginates statuses and transactions independently (namespaced query params)', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET nodes/public_status': () => [
          {
            id: 5,
            name: 'node5',
            fqdn: 'node5.example',
            status: 'online',
            updated_at: '2025-01-01T00:00:00Z',
          },
        ],
        'GET nodes': () => ({
          nodes: [
            { id: 5, domain_name: 'node5', fqdn: 'node5.example', location: { label: 'DC1' } },
            { id: 6, domain_name: 'node6', fqdn: 'node6.example', location: { label: 'DC1' } },
          ],
        }),
        'GET nodes/5': () => ({
          node: {
            id: 5,
            domain_name: 'node5',
            fqdn: 'node5.example',
            status: 'online',
            version: 'v1.2.3',
            location: { label: 'DC1' },
            total_memory: 262144,
            total_swap: 131072,
            total_space: 1048576,
            total_vps: 120,
            total_cpu: 64,
            maintenance_lock: false,
            maintenance_lock_reason: null,
          },
        }),
        'GET nodes/5/statuses': (ctx) => {
          const fromId = ctx.searchParams.get('status[from_id]');
          const limitStr = ctx.searchParams.get('status[limit]');
          const limit = limitStr ? Number(limitStr) : 50;

          const startId = fromId ? Number(fromId) - 1 : 125;
          const count = Number.isFinite(limit) && limit > 0 ? limit : 50;

          const statuses = Array.from({ length: count }, (_, i) => {
            const id = startId - i;
            return {
              id,
              created_at: `2025-01-01T00:${String(id % 60).padStart(2, '0')}:00Z`,
              loadavg1: 0.42,
              cpu_idle: 92.5,
              used_memory: 65536,
              arc_hitpercent: 99.1,
            };
          });

          return { statuses };
        },
        'GET transactions': (ctx) => {
          const fromId = ctx.searchParams.get('transaction[from_id]');
          const limitStr = ctx.searchParams.get('transaction[limit]');
          const limit = limitStr ? Number(limitStr) : 50;

          const startId = fromId ? Number(fromId) - 1 : 240;
          const count = Number.isFinite(limit) && limit > 0 ? limit : 50;

          const transactions = Array.from({ length: count }, (_, i) => {
            const id = startId - i;
            return {
              id,
              state: 0,
              name: 'vps.start',
              message: null,
              created_at: `2025-01-01T01:${String(id % 60).padStart(2, '0')}:00Z`,
              node: { id: 5, domain_name: 'node5' },
              vps: { id: 1000 + id, hostname: `vps${1000 + id}` },
              user: { id: 1, login: 'admin' },
            };
          });

          return { transactions };
        },
      },
    });

    await page.goto('/admin/nodes/5');

    await expect(page.getByTestId('admin.node.page')).toBeVisible();
    await expect(page.getByTestId('admin.node.header')).toBeVisible();

    // Metrics panel renders charts and supports a time-window selector.
    await expect(page.getByTestId('admin.node.metrics.card')).toBeVisible();
    await expect(page.getByTestId('admin.node.metrics.chart.load1')).toBeVisible();

    await page.getByTestId('admin.node.metrics.window.24h').click();
    await expect(page).toHaveURL(/metrics_window=24h/);

    // Page 1 rows.
    await expect(page.getByTestId('admin.node.statuses.row.125')).toBeVisible();
    await expect(page.getByTestId('admin.node.transactions.row.240')).toBeVisible();

    // Next statuses: uses status_* query params.
    await page.getByTestId('admin.node.statuses.pagination.next').click();
    await expect(page).toHaveURL(/status_from_id=76/);
    await expect(page).toHaveURL(/status_page=2/);
    await expect(page.getByTestId('admin.node.statuses.row.75')).toBeVisible();

    // Transactions untouched.
    await expect(page).not.toHaveURL(/tx_from_id=/);

    // Next transactions: uses tx_* query params.
    await page.getByTestId('admin.node.transactions.pagination.next').click();
    await expect(page).toHaveURL(/tx_from_id=191/);
    await expect(page).toHaveURL(/tx_page=2/);
    await expect(page.getByTestId('admin.node.transactions.row.190')).toBeVisible();

    // Status params still present.
    await expect(page).toHaveURL(/status_from_id=76/);

    // Prev statuses back to page 1.
    await page.getByTestId('admin.node.statuses.pagination.prev').click();
    await expect(page).not.toHaveURL(/status_from_id=/);
    await expect(page).toHaveURL(/status_page=1/);
    await expect(page.getByTestId('admin.node.statuses.row.125')).toBeVisible();
  });
});
