import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('IP address environment filter', () => {
  test('defaults to free addresses in the first active location', async ({ page }) => {
    let locationParam: string | null = null;
    let assignedParam: string | null = null;

    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 42, login: 'admin', level: 100 },
      handlers: {
        'GET locations': () => ({
          locations: [
            { id: 8, label: 'Praha', environment: { id: 3, label: 'Production' } },
            { id: 9, label: 'Playground', environment: { id: 4, label: 'Staging' } },
          ],
        }),
        'GET ip_addresses': (ctx) => {
          locationParam = ctx.searchParams.get('ip_address[location]');
          assignedParam = ctx.searchParams.get('ip_address[assigned_to_interface]');
          return {
            ip_addresses: [{
              id: 501,
              addr: '198.51.100.20',
              prefix: 32,
              network: {
                id: 22,
                address: '198.51.100.0',
                prefix: 24,
                primary_location: {
                  label: 'Praha',
                  environment: { label: 'Production' },
                },
              },
            }],
          };
        },
      },
    });

    await page.goto('/admin/ip-addresses');

    await expect(page.getByTestId('admin.ip_addresses.page')).toBeVisible();
    await expect(page.getByTestId('admin.ip_addresses.quick.environment')).toHaveValue('8');
    await expect(page.getByTestId('admin.ip_addresses.quick.occupancy.unassigned')).toHaveClass(/bg-surface/);
    await expect(page.getByTestId('admin.ip_addresses.row.501')).toContainText('Praha · Production');

    expect(locationParam).toBe('8');
    expect(assignedParam).toBe('false');
  });
});
