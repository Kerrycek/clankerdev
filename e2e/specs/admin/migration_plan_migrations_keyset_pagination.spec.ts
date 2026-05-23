import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('admin migration plan detail: migrations list keyset pagination (from_id)', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET migration_plans/777': () => ({
        migration_plan: {
          id: 777,
          state: 'staged',
          concurrency: 10,
          stop_on_error: true,
          send_mail: true,
          user: { id: 42, login: 'root' },
          created_at: '2025-01-01T00:00:00Z',
          finished_at: null,
          reason: null,
        },
      }),
      'GET nodes': () => ({
        nodes: [
          { id: 1, domain_name: 'node1.example.test', location: { label: 'DC1' } },
          { id: 2, domain_name: 'node2.example.test', location: { label: 'DC1' } },
        ],
      }),
      'GET migration_plans/777/vps_migrations': (ctx) => {
        const fromId = ctx.searchParams.get('vps_migration[from_id]');
        const limitStr = ctx.searchParams.get('vps_migration[limit]');
        const limit = limitStr ? Number(limitStr) : 50;

        const startId = fromId ? Number(fromId) - 1 : 1000;
        const count = Number.isFinite(limit) && limit > 0 ? limit : 50;

        const vps_migrations = Array.from({ length: count }, (_, i) => {
          const id = startId - i;
          return {
            id,
            state: id % 3 === 0 ? 'done' : id % 3 === 1 ? 'running' : 'staged',
            vps: { id: 10_000 + id },
            src_node: { id: 1, domain_name: 'node1.example.test' },
            dst_node: { id: 2, domain_name: 'node2.example.test' },
            transaction_chain: { id: 9_000 + id },
            created_at: '2025-01-01T00:00:00Z',
            started_at: null,
            finished_at: null,
          };
        });

        return { vps_migrations };
      },
    },
  });

  await page.goto('/admin/migration-plans/777');

  await expect(page.getByTestId('admin.migration_plan.migrations.row.1000')).toBeVisible();

  await page.getByTestId('admin.migration_plan.migrations.pagination.next').click();
  await expect(page.getByTestId('admin.migration_plan.migrations.row.950')).toBeVisible();

  await page.getByTestId('admin.migration_plan.migrations.pagination.prev').click();
  await expect(page.getByTestId('admin.migration_plan.migrations.row.1000')).toBeVisible();
});
