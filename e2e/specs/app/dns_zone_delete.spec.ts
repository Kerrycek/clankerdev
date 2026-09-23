import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('DNS zone deletion', () => {
  test('delete zone confirms and navigates back to zones list', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET dns_zones': () => ({ dns_zones: [] }),
        'GET dns_zones/10': () => ({
          id: 10,
          name: 'example.com',
          enabled: true,
          dnssec_enabled: false,
          object_state: 'active',
        }),
        // Zone layout calls this for "recent tx" best-effort.
        'GET dns_record_logs': () => ({ dns_record_logs: [] }),
        'DELETE dns_zones/10': () => ({}),
      },
    });

    await page.goto('/app/dns/zones/10/settings');
    await expect(page.getByTestId('dns.settings.form')).toBeVisible();

    await page.getByTestId('dns.settings.delete.open').click();
    await expect(page.getByTestId('dns.settings.delete_confirm')).toBeVisible();
    await page.getByTestId('dns.settings.delete_confirm.confirm').click();

    await expect(page).toHaveURL('/app/dns');
    await expect(page.getByTestId('dns.zones.list')).toBeVisible();
  });

  test('@pr-smoke @pr-smoke-mobile rejected zone deletion stays in context and allows retry', async ({ page }) => {
    let deleteCalls = 0;
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET dns_zones': () => ({ dns_zones: [] }),
        'GET dns_zones/10': () => ({
          id: 10,
          name: 'example.com',
          enabled: true,
          dnssec_enabled: false,
          object_state: 'active',
        }),
        'GET dns_record_logs': () => ({ dns_record_logs: [] }),
        'DELETE dns_zones/10': () => {
          deleteCalls += 1;
          if (deleteCalls === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({ status: false, message: 'Zone still has protected records' }),
            };
          }
          return { _meta: { action_state_id: 801 } };
        },
      },
    });

    await page.goto('/app/dns/zones/10/settings');
    await page.getByTestId('dns.settings.delete.open').click();
    const dialog = page.getByTestId('dns.settings.delete_confirm');
    await dialog.getByTestId('dns.settings.delete_confirm.confirm').click();

    await expect(dialog.getByTestId('dns.settings.delete_confirm.error')).toContainText(
      'Zone still has protected records',
    );
    await expect(dialog).toContainText('example.com');
    await expect(dialog).toBeVisible();

    await dialog.getByTestId('dns.settings.delete_confirm.confirm').click();

    await expect(page).toHaveURL('/app/dns');
    expect(deleteCalls).toBe(2);
  });
});
