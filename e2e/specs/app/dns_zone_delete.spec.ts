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
});
