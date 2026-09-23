import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const exportItem = {
  id: 10,
  dataset: { id: 20, name: 'data', full_name: 'tank/user/data' },
  snapshot: null,
  user: { id: 1, login: 'demo' },
  host_ip_address: { id: 5, addr: '198.51.100.10' },
  path: '/tank/user/data',
  all_vps: false,
  rw: true,
  sync: true,
  subtree_check: false,
  root_squash: false,
  threads: 8,
  enabled: true,
};

const host = {
  id: 11,
  ip_address: { id: 9, addr: '203.0.113.11' },
  rw: true,
  sync: true,
  subtree_check: false,
  root_squash: false,
};

function rejected(message: string) {
  return {
    status: 409,
    contentType: 'application/json',
    body: JSON.stringify({ status: false, message }),
  };
}

test('@pr-smoke @pr-smoke-mobile rejected export deletion stays in context and allows retry', async ({ page }) => {
  let deleteCalls = 0;
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'demo', level: 1 },
    handlers: {
      'GET exports': () => ({ exports: [] }),
      'GET exports/10': () => exportItem,
      'GET exports/10/hosts': () => ({ hosts: [host], _meta: { total_count: 1 } }),
      'GET ip_addresses': () => ({ ip_addresses: [host.ip_address], _meta: { total_count: 1 } }),
      'DELETE exports/10': () => {
        deleteCalls += 1;
        return deleteCalls === 1
          ? rejected('Export is still mounted')
          : { _meta: { action_state_id: 901 } };
      },
    },
  });

  await page.goto('/app/exports/10');
  await page.getByTestId('exports.detail.delete.open').click();
  const dialog = page.getByTestId('exports.detail.delete.dialog');
  await dialog.getByTestId('exports.detail.delete.dialog.confirm').click();

  await expect(dialog.getByTestId('exports.detail.delete.dialog.error')).toContainText('Export is still mounted');
  await expect(dialog).toContainText('tank/user/data');
  await expect(dialog).toBeVisible();

  await dialog.getByTestId('exports.detail.delete.dialog.confirm').click();

  await expect(page).toHaveURL('/app/exports');
  expect(deleteCalls).toBe(2);
});

test('@pr-smoke @pr-smoke-mobile rejected export host deletion stays in context and allows retry', async ({ page }) => {
  let deleteCalls = 0;
  const hosts = [host];
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'demo', level: 1 },
    handlers: {
      'GET exports/10': () => exportItem,
      'GET exports/10/hosts': () => ({ hosts, _meta: { total_count: hosts.length } }),
      'GET ip_addresses': () => ({ ip_addresses: [host.ip_address], _meta: { total_count: 1 } }),
      'DELETE exports/10/hosts/11': () => {
        deleteCalls += 1;
        if (deleteCalls === 1) return rejected('Host access changed on the server');
        hosts.length = 0;
        return { _meta: { action_state_id: 902 } };
      },
    },
  });

  await page.goto('/app/exports/10');
  await page.getByTestId('exports.detail.hosts.row.11.delete').click();
  const dialog = page.getByTestId('exports.detail.host.delete.dialog');
  await dialog.getByTestId('exports.detail.host.delete.dialog.confirm').click();

  await expect(dialog.getByTestId('exports.detail.host.delete.dialog.error')).toContainText(
    'Host access changed on the server',
  );
  await expect(dialog).toContainText('203.0.113.11');
  await expect(dialog).toBeVisible();

  await dialog.getByTestId('exports.detail.host.delete.dialog.confirm').click();

  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('exports.detail.hosts.row.11')).toHaveCount(0);
  expect(deleteCalls).toBe(2);
});
