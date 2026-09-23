import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

function rejected(message: string) {
  return {
    status: 409,
    contentType: 'application/json',
    body: JSON.stringify({ status: false, message }),
  };
}

test('@pr-smoke @pr-smoke-mobile DNS transfer deletion failure stays in context and allows retry', async ({ page }) => {
  let deleteCalls = 0;
  await bootstrapVpsAdminWindow(page);
  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET dns_zones/42': () => ({
        dns_zone: {
          id: 42,
          name: 'example.test',
          source: 'internal_source',
          enabled: true,
          user: { id: 10, login: 'alice' },
        },
      }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'GET dns_zone_transfers': () => ({
        dns_zone_transfers: [{
          id: 501,
          dns_zone: { id: 42 },
          host_ip_address: { id: 11, ip_address: { ip_addr: '203.0.113.10' } },
          peer_type: 'primary_type',
          dns_tsig_key: null,
        }],
      }),
      'GET dns_tsig_keys': () => ({ dns_tsig_keys: [] }),
      'GET dns_record_logs': () => ({ dns_record_logs: [] }),
      'DELETE dns_zone_transfers/501': () => {
        deleteCalls += 1;
        return deleteCalls === 1
          ? rejected('Transfer peer is still in use')
          : { _meta: { action_state_id: 701 } };
      },
    },
  });

  await page.goto('/app/dns/zones/42/transfers');

  const deleteAction = page.locator(
    '[data-testid="dns.transfers.row.501.delete"]:visible, [data-testid="dns.transfers.card.501.delete"]:visible',
  );
  await deleteAction.click();
  const dialog = page.getByTestId('dns.transfers.delete');
  await dialog.getByTestId('dns.transfers.delete.confirm').click();

  await expect(dialog.getByTestId('dns.transfers.delete.error')).toContainText('Transfer peer is still in use');
  await expect(dialog).toContainText('203.0.113.10');
  await expect(dialog).toBeVisible();

  await dialog.getByTestId('dns.transfers.delete.confirm').click();

  await expect(dialog).toBeHidden();
  expect(deleteCalls).toBe(2);
});

test('@pr-smoke @pr-smoke-mobile DNS server relation deletion failure stays in context and allows retry', async ({ page }) => {
  let deleteCalls = 0;
  await bootstrapVpsAdminWindow(page);
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET dns_zones/42': () => ({
        dns_zone: {
          id: 42,
          name: 'example.test',
          source: 'internal_source',
          enabled: true,
          user: { id: 10, login: 'alice' },
        },
      }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'GET dns_record_logs': () => ({ dns_record_logs: [] }),
      'GET dns_server_zones': () => ({
        dns_server_zones: [{
          id: 601,
          dns_server: { id: 5, name: 'ns1.example.test' },
          type: 'primary_type',
          serial: 1234,
        }],
      }),
      'GET dns_servers': () => ({ dns_servers: [{ id: 5, name: 'ns1.example.test' }] }),
      'DELETE dns_server_zones/601': () => {
        deleteCalls += 1;
        return deleteCalls === 1
          ? rejected('DNS server relation changed on the server')
          : { _meta: { action_state_id: 702 } };
      },
    },
  });

  await page.goto('/admin/dns/zones/42/servers');

  const deleteAction = page.getByTestId('dns.servers.row.601.delete');
  await deleteAction.scrollIntoViewIfNeeded();
  await deleteAction.click();
  const dialog = page.getByTestId('dns.servers.delete');
  await dialog.getByTestId('dns.servers.delete.confirm').click();

  await expect(dialog.getByTestId('dns.servers.delete.error')).toContainText(
    'DNS server relation changed on the server',
  );
  await expect(dialog).toContainText('ns1.example.test');
  await expect(dialog).toBeVisible();

  await dialog.getByTestId('dns.servers.delete.confirm').click();

  await expect(dialog).toBeHidden();
  expect(deleteCalls).toBe(2);
});
