import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile network location actions stay reachable without table scrolling', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  if (mobile) await page.setViewportSize({ width: 320, height: 800 });

  const locationLabel = 'AVeryLongLocationNameWithoutNaturalBreakOpportunitiesForNarrowScreens';
  const mutatingRequests: string[] = [];

  page.on('request', (request) => {
    if (
      request.url().includes('location_networks')
      && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())
    ) {
      mutatingRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET locations': () => ({
        locations: [{ id: 1, label: locationLabel }],
      }),
      'GET networks/101': () => ({
        network: {
          id: 101,
          label: 'Public IPv4',
          ip_version: 4,
          address: '192.0.2.0',
          prefix: 24,
          role: 'public_access',
          managed: true,
          split_access: 'no_access',
          split_prefix: 24,
          purpose: 'vps',
          size: 254,
          used: 120,
          assigned: 24,
          owned: 12,
          taken: 30,
          primary_location: { id: 1, label: locationLabel },
        },
      }),
      'GET location_networks': () => ({
        location_networks: [{
          id: 1001,
          location: { id: 1, label: locationLabel },
          network: { id: 101 },
          primary: true,
          priority: 10,
          autopick: true,
          userpick: false,
        }],
      }),
    },
  });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'test-admin-session' });

  await page.goto('/admin/cluster/networks/101');

  const card = page.getByTestId('admin.cluster.network_detail.availability.table');
  const row = page.getByTestId('admin.cluster.network_detail.ln.1001');
  const edit = page.getByTestId('admin.cluster.network_detail.ln.1001.edit');
  const remove = page.getByTestId('admin.cluster.network_detail.ln.1001.remove');
  await expect(row).toBeVisible();

  const geometry = await card.evaluate((element) => {
    const scroller = element.firstElementChild as HTMLElement | null;
    const table = scroller?.querySelector('table');
    return {
      clientWidth: scroller?.clientWidth ?? 0,
      scrollWidth: scroller?.scrollWidth ?? 0,
      scrollLeft: scroller?.scrollLeft ?? -1,
      tableDisplay: table ? getComputedStyle(table).display : '',
      tableMinWidth: table ? Number.parseFloat(getComputedStyle(table).minWidth) : 0,
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  const actionGeometries = await Promise.all([edit, remove].map((action) => (
    action.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        height: rect.height,
        viewportWidth: document.documentElement.clientWidth,
      };
    })
  )));

  if (mobile) {
    for (const actionGeometry of actionGeometries) {
      expect(actionGeometry.left).toBeGreaterThanOrEqual(0);
      expect(actionGeometry.right).toBeLessThanOrEqual(actionGeometry.viewportWidth);
      expect(actionGeometry.height).toBeGreaterThanOrEqual(44);
    }
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.scrollLeft).toBe(0);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.tableDisplay).toBe('block');
    await expect(row.getByText('Location', { exact: true })).toBeVisible();
    await expect(row.getByText('Actions', { exact: true })).toBeVisible();
  } else {
    expect(geometry.tableDisplay).toBe('table');
    expect(geometry.tableMinWidth).toBeGreaterThanOrEqual(840);
    await expect(card.getByRole('table')).toBeVisible();
    await expect(card.locator('thead')).toBeVisible();
    await expect(edit).toHaveCSS('height', '32px');
    await expect(remove).toHaveCSS('height', '32px');
  }

  await edit.click();
  const editor = page.getByTestId('admin.cluster.network_detail.editor');
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Cancel' }).click();
  await expect(editor).toHaveCount(0);

  await remove.click();
  const confirmation = page.getByTestId('admin.cluster.network_detail.remove.confirm');
  await expect(confirmation).toBeVisible();
  await page.getByTestId('admin.cluster.network_detail.remove.confirm.cancel').click();
  await expect(confirmation).toHaveCount(0);
  expect(mutatingRequests).toEqual([]);
});
