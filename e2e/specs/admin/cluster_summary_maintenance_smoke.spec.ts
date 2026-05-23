import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Admin cluster summary maintenance', () => {
  test('shows current maintenance state and can lock/unlock cluster', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const cluster = {
      maintenance_lock: false,
      maintenance_lock_reason: '',
    };

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET cluster/full_stats': () => ({
          nodes_online: 9,
          node_count: 10,
          vps_running: 120,
          vps_stopped: 4,
          vps_suspended: 2,
          vps_deleted: 1,
          vps_count: 127,
          user_active: 80,
          user_suspended: 2,
          user_deleted: 1,
          user_count: 83,
          ipv4_used: 120,
          ipv4_count: 160,
        }),
        'GET cluster': () => ({ cluster }),
        'POST cluster/set_maintenance': () => ({ _meta: {} }),
      },
    });

    page.on('request', (req) => {
      const url = new URL(req.url());
      if (req.method() !== 'POST') return;
      if (!url.pathname.endsWith('/cluster/set_maintenance')) return;
      const body = req.postDataJSON() as { cluster?: { lock?: boolean; reason?: string } };
      cluster.maintenance_lock = Boolean(body?.cluster?.lock);
      cluster.maintenance_lock_reason = cluster.maintenance_lock ? String(body?.cluster?.reason ?? '') : '';
    });

    await page.goto('/admin/cluster/summary');
    await expect(page.getByTestId('admin.cluster.summary.page')).toBeVisible();
    await expect(page.getByTestId('admin.cluster.summary.maintenance.badge')).toContainText(/off|vypnuta/i);

    await page.getByTestId('admin.cluster.summary.maintenance.lock').click();
    await expect(page.getByTestId('admin.cluster.summary.maintenance.dialog.lock')).toBeVisible();
    await page.getByTestId('admin.cluster.summary.maintenance.dialog.lock.reason').fill('Network maintenance');
    await page.getByTestId('admin.cluster.summary.maintenance.dialog.lock.confirm').click();

    await expect(page.getByTestId('admin.cluster.summary.maintenance.badge')).toContainText(/on|zapnuta/i);
    await expect(page.getByTestId('admin.cluster.summary.maintenance.body')).toContainText('Network maintenance');
    await expect(page.getByTestId('admin.cluster.summary.maintenance.unlock')).toBeVisible();

    await page.getByTestId('admin.cluster.summary.maintenance.unlock').click();
    await expect(page.getByTestId('admin.cluster.summary.maintenance.dialog.unlock')).toBeVisible();
    await page.getByTestId('admin.cluster.summary.maintenance.dialog.unlock.confirm').click();

    await expect(page.getByTestId('admin.cluster.summary.maintenance.badge')).toContainText(/off|vypnuta/i);
  });
});
