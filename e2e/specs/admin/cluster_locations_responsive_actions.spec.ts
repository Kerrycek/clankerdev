import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, setUiSettingsLocalStorage } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile location actions stay reachable without horizontal scrolling', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  await page.setViewportSize({ width: mobile ? 320 : 1280, height: 900 });
  await setUiSettingsLocalStorage(page, { language: 'en' });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'LOCATION_RESPONSIVE_ACTIONS' });

  const location = {
    id: 7,
    label: mobile ? 'l'.repeat(80) : 'Prague production',
    description: mobile ? 'd'.repeat(80) : 'Primary location for production workloads',
    domain: mobile ? `${'x'.repeat(80)}.example.test` : 'prague-production.example.test',
    has_ipv6: true,
    remote_console_server: 'https://console.example.test/prague',
    environment: { id: 1, label: 'Production' },
    maintenance_lock: 'no',
    maintenance_lock_reason: '',
  };
  let maintenanceRequests = 0;
  let locationUpdates = 0;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET environments': () => ({
        environments: [location.environment],
        _meta: { total_count: 1 },
      }),
      'GET locations': () => ({ locations: [location], _meta: { total_count: 1 } }),
      'PUT locations/7': () => {
        locationUpdates += 1;
        return { location };
      },
      'POST locations/7/set_maintenance': () => {
        maintenanceRequests += 1;
        return {};
      },
    },
  });

  await page.goto('/admin/cluster/locations');

  const tableCard = page.getByTestId('admin.cluster.locations.table');
  const row = page.getByTestId('admin.cluster.locations.row.7');
  const edit = page.getByTestId('admin.cluster.locations.row.7.edit');
  const maintenance = page.getByTestId('admin.cluster.locations.row.7.maintenance.lock');
  await expect(row).toBeVisible();
  await expect(row).toContainText(location.label);
  await expect(row).toContainText(location.description);
  await expect(row).toContainText(location.domain);

  const scroller = tableCard.locator(':scope > div.overflow-x-auto');
  const metrics = await scroller.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
  }));
  expect(metrics.scrollLeft).toBe(0);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

  if (mobile) {
    await expect(row.getByText('Name', { exact: true })).toBeVisible();
    await expect(row.getByText('Environment', { exact: true })).toBeVisible();
    await expect(row.getByText('Domain', { exact: true })).toBeVisible();
    await expect(row.getByText('IPv6', { exact: true })).toBeVisible();
    await expect(row.getByText('Remote console', { exact: true })).toBeVisible();
    await expect(row.getByText('Actions', { exact: true })).toBeVisible();

    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    for (const [name, action] of [['maintenance', maintenance], ['edit', edit]] as const) {
      const box = await action.boundingBox();
      expect(box, `${name} action has a bounding box`).not.toBeNull();
      expect(box?.height ?? 0, `${name} action is at least 44px tall`).toBeGreaterThanOrEqual(44);
      expect(box?.x ?? -1, `${name} action starts inside the viewport`).toBeGreaterThanOrEqual(0);
      expect(
        (box?.x ?? 0) + (box?.width ?? 0),
        `${name} action ends inside the viewport`,
      ).toBeLessThanOrEqual(viewportWidth);
    }

  }

  await edit.click();
  const editor = page.getByTestId('admin.cluster.locations.editor');
  await expect(editor).toBeVisible();
  await expect(page.getByTestId('admin.cluster.locations.editor.label')).toHaveValue(location.label);
  await editor.getByRole('button', { name: 'Cancel' }).click();
  await expect(editor).toHaveCount(0);
  expect(locationUpdates).toBe(0);

  await maintenance.click();
  const maintenanceDialog = page.getByTestId('admin.cluster.locations.row.7.maintenance.lock_dialog');
  await expect(maintenanceDialog).toBeVisible();
  await maintenanceDialog
    .getByTestId('admin.cluster.locations.row.7.maintenance.lock_dialog.cancel')
    .click();
  await expect(maintenanceDialog).toHaveCount(0);
  expect(maintenanceRequests).toBe(0);
});
