import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, setUiSettingsLocalStorage } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile host IP actions stay reachable without horizontal scrolling', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  await page.setViewportSize({ width: mobile ? 320 : 1280, height: 900 });
  await setUiSettingsLocalStorage(page, { language: 'en' });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'HOST_IP_RESPONSIVE_ACTIONS' });

  const longValue = mobile ? 'x'.repeat(80) : 'ptr.example.test.';
  const rows = [
    {
      id: 501,
      addr: mobile ? `${'2'.repeat(80)}::1` : '203.0.113.10',
      assigned: true,
      reverse_record_value: longValue,
      ip_address: {
        id: 301,
        ip_addr: '192.0.2.10',
        user: { id: 7, login: mobile ? 'u'.repeat(80) : 'alice' },
        network_interface: {
          id: 99,
          name: mobile ? 'i'.repeat(80) : 'eth0',
          vps: { id: 42, hostname: mobile ? 'v'.repeat(80) : 'vps-42' },
        },
      },
    },
    {
      id: 502,
      addr: '198.51.100.20',
      assigned: false,
      user_created: true,
      reverse_record_value: '',
      ip_address: { id: 302, ip_addr: '198.51.100.20' },
    },
  ];
  const mutationRequests: string[] = [];
  page.on('request', (request) => {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
      && new URL(request.url()).pathname.includes('/host_ip_addresses')
    ) {
      mutationRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET host_ip_addresses': () => ({ host_ip_addresses: rows, _meta: { total_count: rows.length } }),
    },
  });

  await page.goto('/admin/networking/host-ip-addresses');
  const tableCard = page.getByTestId('admin.host_ip_addresses.table');
  const assignedRow = page.getByTestId('admin.host_ip_addresses.row.501');
  const unassignedRow = page.getByTestId('admin.host_ip_addresses.row.502');
  await expect(assignedRow).toBeVisible();
  await expect(unassignedRow).toBeVisible();
  await expect(assignedRow).toContainText(longValue);

  const scroller = tableCard.locator(':scope > div.overflow-x-auto');
  const metrics = await scroller.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
  }));
  expect(metrics.scrollLeft).toBe(0);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  const tableDisplay = await tableCard.locator('table').evaluate((element) => getComputedStyle(element).display);
  expect(tableDisplay).toBe(mobile ? 'block' : 'table');

  const actions = [
    { control: page.getByTestId('admin.host_ip_addresses.row.501.ptr'), label: 'PTR' },
    { control: page.getByTestId('admin.host_ip_addresses.row.501.free'), label: 'Remove' },
    { control: page.getByTestId('admin.host_ip_addresses.row.502.ptr'), label: 'PTR' },
    { control: page.getByTestId('admin.host_ip_addresses.row.502.assign'), label: 'Assign' },
    { control: page.getByTestId('admin.host_ip_addresses.row.502.delete'), label: 'Delete' },
  ];

  if (mobile) {
    for (const label of ['Host IP', 'Route IP', 'Interface', 'VPS', 'User', 'PTR', 'Flags', 'Actions']) {
      await expect(assignedRow.getByText(label, { exact: true })).toBeVisible();
    }

    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    for (const { control, label } of actions) {
      await expect(control).toHaveCount(1);
      await expect(control).toBeVisible();
      const generatedLabel = await control.evaluate((element) => getComputedStyle(element, '::after').content);
      expect(generatedLabel).toContain(label);
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewportWidth);
    }
  } else {
    await expect(tableCard.getByRole('columnheader', { name: 'Host IP' })).toBeVisible();
    for (const { control } of actions) await expect(control).toHaveText('');
  }

  await page.getByTestId('admin.host_ip_addresses.row.501.ptr').click();
  const ptrDialog = page.getByRole('dialog', { name: 'Set reverse record' });
  await expect(ptrDialog).toBeVisible();
  await ptrDialog.getByRole('button', { name: 'Cancel' }).click();

  await page.getByTestId('admin.host_ip_addresses.row.502.assign').click();
  const assignDialog = page.getByRole('dialog', { name: 'Assign host IP address' });
  await expect(assignDialog).toBeVisible();
  await assignDialog.getByRole('button', { name: 'Cancel' }).click();

  await page.getByTestId('admin.host_ip_addresses.row.502.delete').click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete host IP address?' });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Cancel' }).click();

  expect(mutationRequests).toEqual([]);
});

test('@pr-smoke @pr-smoke-mobile rejected host IP deletion stays in context and supports retry', async ({ page }) => {
  await setUiSettingsLocalStorage(page, { language: 'en' });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'HOST_IP_DELETE_RETRY' });

  let deleteAttempts = 0;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET host_ip_addresses': () => ({
        host_ip_addresses: [{
          id: 502,
          addr: '198.51.100.20',
          assigned: false,
          user_created: true,
          ip_address: { id: 302, ip_addr: '198.51.100.20' },
        }],
        _meta: { total_count: 1 },
      }),
      'DELETE host_ip_addresses/502': () => {
        deleteAttempts += 1;
        if (deleteAttempts === 1) {
          return {
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ status: false, message: 'Host address is still assigned', response: null }),
          };
        }
        return { _meta: { action_state_id: 703 } };
      },
    },
  });

  await page.goto('/admin/networking/host-ip-addresses');
  await page.getByTestId('admin.host_ip_addresses.row.502.delete').click();

  const dialog = page.getByTestId('admin.host_ip_addresses.delete_confirm');
  await dialog.getByTestId('admin.host_ip_addresses.delete_confirm.confirm').click();
  await expect(page.getByTestId('admin.host_ip_addresses.delete_confirm.error')).toContainText('Host address is still assigned');
  await expect(dialog).toContainText('198.51.100.20');

  await dialog.getByTestId('admin.host_ip_addresses.delete_confirm.confirm').click();
  await expect(dialog).toBeHidden();
  expect(deleteAttempts).toBe(2);
});
