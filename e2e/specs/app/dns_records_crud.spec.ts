import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke DNS records CRUD', () => {
  test('can create, edit, and delete a record', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    let createPayload: any;

    let records = [
      {
        id: 100,
        dns_zone: 10,
        name: 'www',
        type: 'A',
        content: '1.2.3.4',
        ttl: 3600,
        priority: null,
        enabled: true,
        dynamic_update_enabled: false,
        dynamic_update_url: null,
        comment: '',
      },
    ];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET dns_zones/10': () => ({
          id: 10,
          name: 'example.com',
          enabled: true,
          dnssec_enabled: false,
          default_ttl: 600,
          object_state: 'active',
        }),
        'GET dns_records': () => ({ dns_records: records }),
        // Zone layout calls this for "recent tx" best-effort.
        'GET dns_record_logs': () => ({ dns_record_logs: [] }),

        'POST dns_records': async ({ request }) => {
          createPayload = await request.postDataJSON();
          const created = {
            id: 101,
            dns_zone: 10,
            name: 'api',
            type: 'A',
            content: '5.6.7.8',
            ttl: createPayload?.dns_record?.ttl,
            priority: null,
            enabled: true,
            dynamic_update_enabled: false,
            dynamic_update_url: null,
            comment: '',
          };
          records = [created, ...records];
          return { dns_record: created };
        },

        'PUT dns_records/101': () => {
          records = records.map((r) => (r.id === 101 ? { ...r, content: '5.6.7.9' } : r));
          const updated = records.find((r) => r.id === 101);
          return { dns_record: updated };
        },

        'DELETE dns_records/101': () => {
          records = records.filter((r) => r.id !== 101);
          return {};
        },
      },
    });

    await page.goto('/app/dns/zones/10');
    await expect(page.getByTestId('dns.records.list')).toBeVisible();

    // Create
    await page.getByTestId('dns.records.create.open').click();
    await expect(page.getByTestId('dns.records.create.modal')).toBeVisible();
    await expect(page.getByTestId('dns.records.create.ttl')).toHaveValue('');
    await page.getByTestId('dns.records.create.name').fill('api');
    await page.getByTestId('dns.records.create.content').fill('5.6.7.8');
    await page.getByTestId('dns.records.create.submit').click();

    await expect.poll(() => createPayload?.dns_record?.ttl).toBeUndefined();
    await expect(page.getByTestId('dns.records.create.modal')).toHaveCount(0);
    await expect(page.getByTestId('dns.record.row.101')).toBeVisible();
    await expect(page.getByTestId('dns.record.row.101')).toContainText('5.6.7.8');

    // Edit
    await page.getByTestId('dns.record.row.101.edit').click();
    await expect(page.getByTestId('dns.records.edit.modal')).toBeVisible();
    await page.getByTestId('dns.records.edit.content').fill('5.6.7.9');
    await page.getByTestId('dns.records.edit.submit').click();

    await expect(page.getByTestId('dns.records.edit.modal')).toHaveCount(0);
    await expect(page.getByTestId('dns.record.row.101')).toContainText('5.6.7.9');

    // Delete
    await page.getByTestId('dns.record.row.101.delete').click();
    await expect(page.getByTestId('dns.records.delete_confirm')).toBeVisible();
    await page.getByTestId('dns.records.delete_confirm.confirm').click();

    await expect(page.getByTestId('dns.record.row.101')).toHaveCount(0);
  });
});
