import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import {
  expectNoDocumentHorizontalOverflow,
  expectTableHorizontalScrollUsable,
} from '../../helpers/horizontalOverflow';

test('@pr-smoke @pr-smoke-mobile admin ip address detail: shows header and links to user/vps', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET ip_addresses/100': () => ({
        ip_address: {
          id: 100,
          addr: '203.0.113.10',
          prefix: 32,
          routed: true,
          created_at: '2026-02-01T00:00:00.000Z',
          network: { id: 3, address: '203.0.113.0', prefix: 24 },
          vps: { id: 5 },
          user: { id: 42 },
        },
      }),
      'GET host_ip_addresses': () => ({
        host_ip_addresses: [
          { id: 601, addr: '203.0.113.11', assigned: true, reverse_record_value: 'host.example.test.' },
          { id: 602, addr: '203.0.113.12', assigned: false, user_created: true },
        ],
      }),
    },
  });

  await page.goto('/admin/ip-addresses/100');

  await expect(page.getByTestId('admin.ip_address.page')).toBeVisible();
  await expect(page.getByTestId('admin.ip_address.header')).toBeVisible();

  await expect(page.getByTestId('admin.ip.action.vps')).toHaveAttribute('href', '/admin/vps/5');
  await expect(page.getByTestId('admin.ip.action.user')).toHaveAttribute('href', '/admin/users/42');

  await expect(page.getByTestId('admin.ip_address.refresh')).toBeVisible();
  await expect(page.getByTestId('admin.ip.hosts.row.601.ptr')).toHaveAttribute('aria-label', 'PTR');
  await expect(page.getByTestId('admin.ip.hosts.row.601.free')).toHaveAttribute('aria-label', 'Remove');
  await expect(page.getByTestId('admin.ip.hosts.row.602.assign')).toHaveAttribute('aria-label', 'Assign');
  await expect(page.getByTestId('admin.ip.hosts.row.602.delete')).toHaveAttribute('aria-label', 'Delete');
  await expect(page.getByTestId('admin.ip.hosts.row.602.ptr')).toHaveText('');

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoDocumentHorizontalOverflow(page);
  await expectTableHorizontalScrollUsable(page, 'admin.ip.hosts.table');

  const proofScreenshot = process.env.E2E_IP_DETAIL_ACTIONS_PROOF_SCREENSHOT?.trim();
  if (proofScreenshot) await page.screenshot({ path: proofScreenshot, fullPage: true });
});

test('@pr-smoke @pr-smoke-mobile admin ip address destructive confirmations keep rejected actions retryable', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  let freeRouteAttempts = 0;
  let deleteHostAttempts = 0;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET ip_addresses/100': () => ({
        ip_address: {
          id: 100,
          addr: '203.0.113.10',
          prefix: 32,
          routed: true,
          network_interface: { id: 501 },
          network: { id: 3, address: '203.0.113.0', prefix: 24 },
        },
      }),
      'GET host_ip_addresses': () => ({
        host_ip_addresses: [
          { id: 602, addr: '203.0.113.12', assigned: false, user_created: true },
        ],
      }),
      'POST ip_addresses/100/free': () => {
        freeRouteAttempts += 1;
        if (freeRouteAttempts === 1) {
          return {
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ status: false, message: 'Route changed on the server', response: null }),
          };
        }
        return { ip_address: { id: 100 }, _meta: { action_state_id: 701 } };
      },
      'DELETE host_ip_addresses/602': () => {
        deleteHostAttempts += 1;
        if (deleteHostAttempts === 1) {
          return {
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ status: false, message: 'Host address is still assigned', response: null }),
          };
        }
        return { _meta: { action_state_id: 702 } };
      },
    },
  });

  await page.goto('/admin/ip-addresses/100');

  await page.getByTestId('admin.ip.route.free').click();
  const freeRouteDialog = page.getByTestId('admin.ip.route.free_confirm');
  await freeRouteDialog.getByTestId('admin.ip.route.free_confirm.confirm').click();
  await expect(page.getByTestId('admin.ip.route.free_confirm.error')).toContainText('Route changed on the server');
  await expect(freeRouteDialog).toContainText('203.0.113.10/32');
  await freeRouteDialog.getByTestId('admin.ip.route.free_confirm.confirm').click();
  await expect(freeRouteDialog).toBeHidden();
  expect(freeRouteAttempts).toBe(2);

  await page.getByTestId('admin.ip.hosts.row.602.delete').click();
  const deleteHostDialog = page.getByTestId('admin.ip.hosts.delete_confirm');
  await deleteHostDialog.getByTestId('admin.ip.hosts.delete_confirm.confirm').click();
  await expect(page.getByTestId('admin.ip.hosts.delete_confirm.error')).toContainText('Host address is still assigned');
  await expect(deleteHostDialog).toContainText('203.0.113.12');
  await deleteHostDialog.getByTestId('admin.ip.hosts.delete_confirm.confirm').click();
  await expect(deleteHostDialog).toBeHidden();
  expect(deleteHostAttempts).toBe(2);
});
