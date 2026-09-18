import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile resource package detail actions stay reachable without horizontal scrolling', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'mobile-chrome') {
    await page.setViewportSize({ width: 320, height: 800 });
  }

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  const longValue = testInfo.project.name === 'mobile-chrome' ? 'a'.repeat(80) : 'Initial import';
  const environment = { id: 1, label: 'Production' };
  const user = { id: 7, login: 'alice' };
  const clusterResource = { id: 3, label: longValue, name: 'memory' };
  const pkg = { id: 21, label: 'Standard Production', environment, is_personal: false };

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET environments': () => ({ environments: [environment], _meta: { total_count: 1 } }),
      'GET users': () => ({ users: [user], _meta: { total_count: 1 } }),
      'GET cluster_resources': () => ({ cluster_resources: [clusterResource], _meta: { total_count: 1 } }),
      'GET cluster_resource_packages/21': () => ({ cluster_resource_package: pkg }),
      'GET cluster_resource_packages/21/items': () => ({
        items: [{ id: 31, cluster_resource: clusterResource, value: 4096 }],
        _meta: { total_count: 1 },
      }),
      'GET user_cluster_resource_packages': () => ({
        user_cluster_resource_packages: [
          {
            id: 41,
            environment,
            user,
            cluster_resource_package: pkg,
            comment: longValue,
            added_by: { id: 1, login: 'admin' },
            created_at: '2026-09-16T00:00:00Z',
          },
        ],
        _meta: { total_count: 1 },
      }),
    },
  });

  await page.goto('/admin/cluster/resource-packages/21');
  await expect(page.getByTestId('admin.cluster.resource_package_detail.assign.row.41')).toBeVisible();

  const itemScroller = page
    .getByTestId('admin.cluster.resource_package_detail.items.table')
    .locator(':scope > .overflow-x-auto');
  const assignmentScroller = page
    .getByTestId('admin.cluster.resource_package_detail.assign.table')
    .locator(':scope > .overflow-x-auto');

  for (const scroller of [itemScroller, assignmentScroller]) {
    const metrics = await scroller.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth,
    }));
    expect(metrics.scrollLeft).toBe(0);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  }

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const action of [
    page.getByTestId('admin.cluster.resource_package_detail.items.row.31.edit'),
    page.getByTestId('admin.cluster.resource_package_detail.items.row.31.delete'),
    page.getByTestId('admin.cluster.resource_package_detail.assign.row.41.edit'),
    page.getByTestId('admin.cluster.resource_package_detail.assign.row.41.delete'),
  ]) {
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  }

  await page.getByTestId('admin.cluster.resource_package_detail.items.row.31.edit').click();
  await expect(page.getByTestId('admin.cluster.resource_package_detail.item_editor')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('admin.cluster.resource_package_detail.item_editor')).toHaveCount(0);

  await page.getByTestId('admin.cluster.resource_package_detail.assign.row.41.delete').click();
  await expect(page.getByTestId('admin.cluster.resource_package_detail.assign_delete_confirm')).toBeVisible();
  await page.getByTestId('admin.cluster.resource_package_detail.assign_delete_confirm.cancel').click();
  await expect(page.getByTestId('admin.cluster.resource_package_detail.assign_delete_confirm')).toHaveCount(0);
});
