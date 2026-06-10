import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('DNS zone action gating (busy transaction)', () => {
  test('disables record create and settings save while a transaction chain is active', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET dns_zones/10': () => ({
          dns_zone: { id: 10, name: 'example.com', object_state: 'active' },
        }),
        'GET dns_records': () => ({ dns_records: [] }),
        'GET dns_record_logs': () => ({ dns_record_logs: [] }),
        'GET transaction_chains': (ctx) => {
          const cls = ctx.searchParams.get('transaction_chain[class_name]');
          const rowId = ctx.searchParams.get('transaction_chain[row_id]');
          if (cls === 'DnsZone' && rowId === '10') {
            return {
              transaction_chains: [
                {
                  id: 999,
                  state: 'staged',
                  name: 'DnsZone#10 update',
                  progress: 0,
                  size: 1,
                },
              ],
            };
          }
          return { transaction_chains: [] };
        },
        'GET transaction_chains/999': () => ({
          transaction_chain: { id: 999, state: 'staged', name: 'DnsZone#10 update', progress: 0, size: 1 },
        }),
      },
    });

    await page.goto('/app/dns/zones/10');
    await expect(page.getByTestId('dns.records.list')).toBeVisible();

    // Attempt to open "Add record" while the zone is busy.
    await expect(page.getByTestId('dns.records.create.open')).toBeVisible();
    await page.getByTestId('dns.records.create.open').click({ force: true });

    // We should get the generic disabled-reason modal, not the create form.
    await expect(page.getByTestId('dns.records.create.open.reason')).toBeVisible();
    await expect(page.getByTestId('dns.records.create.modal')).toBeHidden();

    // Settings save should also be blocked.
    await page.goto('/app/dns/zones/10/settings');
    await expect(page.getByTestId('dns.settings.save')).toBeVisible();

    await page.getByTestId('dns.settings.save').click({ force: true });
    await expect(page.getByTestId('dns.settings.save.reason')).toBeVisible();
  });
});
