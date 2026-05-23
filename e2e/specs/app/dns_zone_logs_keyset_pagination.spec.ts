import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('DNS zone logs keyset pagination', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    const zone = {
      id: 10,
      name: 'zone10.example',
      role: 'primary',
      enabled: true,
      dnssec_enabled: false,
      serial: 2026012601,
      default_ttl: 3600,
    };

    const makeLog = (id: number) => ({
      id,
      created_at: '2026-01-26T00:00:00.000Z',
      change_type: id % 2 === 0 ? 'update' : 'create',
      name: `host${id}`,
      type: id % 3 === 0 ? 'A' : id % 3 === 1 ? 'AAAA' : 'TXT',
      attr_changes: { content: { old: null, new: '...' } },
      transaction_chain: { id: 9000 + id },
    });

    const page1 = Array.from({ length: 50 }, (_, i) => 300 - i).map(makeLog);
    const page2 = Array.from({ length: 50 }, (_, i) => 250 - i).map(makeLog);
    const cardLogs = Array.from({ length: 5 }, (_, i) => 500 - i).map(makeLog);

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET dns_zones/10': () => zone,
        'GET dns_record_logs': ({ searchParams }) => {
          const fromId = searchParams.get('dns_record_log[from_id]');
          const zoneId = searchParams.get('dns_record_log[dns_zone]');
          const limit = Number(searchParams.get('dns_record_log[limit]') || '0');
          const q = (searchParams.get('dns_record_log[q]') || '').trim();

          if (zoneId !== '10') return { dns_record_logs: [], _meta: { total_count: 0 } };

          // The zone overview card queries a small limit (5). Give it deterministic data.
          if (limit === 5) {
            return { dns_record_logs: cardLogs, _meta: { total_count: 5 } };
          }
          if (q) {
            return {
              dns_record_logs: page1.filter((l) => String(l.id) === q || String(l.name).includes(q) || String(l.change_type).includes(q)),
              _meta: { total_count: 1 },
            };
          }

          return { dns_record_logs: fromId ? page2 : page1, _meta: { total_count: 100 } };
        },
      },
    });
  });

  test('next/prev updates URL and rows', async ({ page }) => {
    await page.goto('/app/dns/zones/10/logs');

    await expect(page.getByTestId('dns.logs.list')).toBeVisible();
    await expect(page.getByTestId('dns.logs.row.300')).toBeVisible();

    await page.getByTestId('dns.logs.pagination.desktop.next').click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('dns.logs.row.250')).toBeVisible();

    await page.getByTestId('dns.logs.pagination.desktop.prev').click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId('dns.logs.row.300')).toBeVisible();
  });

  test('search uses server-side q and persists in URL', async ({ page }) => {
    await page.goto('/app/dns/zones/10/logs');

    await page.getByTestId('dns.logs.search.input').fill('host300');
    await expect(page).toHaveURL(/q=host300/);
    await expect(page.getByTestId('dns.logs.row.300')).toBeVisible();
  });
});
