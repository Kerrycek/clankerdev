import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('IP address environment filter', () => {
  test('offers free addresses from each active location by default', async ({ page }) => {
    const requestedLocations: string[] = [];
    const requestedAssigned: string[] = [];

    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 42, login: 'admin', level: 100 },
      handlers: {
        'GET locations': () => ({
          locations: [
            { id: 8, label: 'Praha', environment: { id: 3, label: 'Production' } },
            { id: 7, label: 'Brno', environment: { id: 3, label: 'Production' } },
            { id: 9, label: 'Playground', environment: { id: 4, label: 'Staging' } },
          ],
        }),
        'GET ip_addresses': (ctx) => {
          const location = ctx.searchParams.get('ip_address[location]');
          if (location) requestedLocations.push(location);
          requestedAssigned.push(ctx.searchParams.get('ip_address[assigned_to_interface]') ?? '');

          const locations = {
            '7': { id: 601, addr: '198.51.100.7', location: { id: 7, label: 'Brno', environment: { id: 3, label: 'Production' } } },
            '8': { id: 501, addr: '198.51.100.20', location: { id: 8, label: 'Praha', environment: { id: 3, label: 'Production' } } },
            '9': { id: 701, addr: '198.51.100.90', location: { id: 9, label: 'Playground', environment: { id: 4, label: 'Staging' } } },
          } as const;
          const selected = locations[location as keyof typeof locations];
          return {
            ip_addresses: selected ? [{
              ...selected,
              prefix: 32,
              network: {
                id: selected.id + 100,
                address: selected.addr.replace(/\d+$/, '0'),
                prefix: 24,
                primary_location: selected.location,
              },
            }] : [],
          };
        },
      },
    });

    await page.goto('/admin/ip-addresses');

    await expect(page.getByTestId('admin.ip_addresses.page')).toBeVisible();
    await expect(page.getByTestId('admin.ip_addresses.quick.environment')).toHaveValue('');
    await expect(page.getByTestId('admin.ip_addresses.quick.occupancy.unassigned')).toHaveClass(/bg-surface/);
    await expect(page.getByTestId('admin.ip_addresses.row.501')).toContainText('P');
    await expect(page.getByTestId('admin.ip_addresses.row.501').locator('[title="Praha · Production"]')).toBeVisible();
    await expect(page.getByTestId('admin.ip_addresses.row.601').locator('[title="Brno · Production"]')).toBeVisible();
    await expect(page.getByTestId('admin.ip_addresses.row.701').locator('[title="Playground · Staging"]')).toBeVisible();

    expect(requestedLocations.sort()).toEqual(['7', '8', '9']);
    expect(requestedAssigned).toEqual(['false', 'false', 'false']);
  });

  test('shows a deliberately selected legacy subnet', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 42, login: 'admin', level: 100 },
      handlers: {
        'GET locations': () => ({ locations: [{ id: 8, label: 'Praha', environment: { id: 3, label: 'Production' } }] }),
        'GET ip_addresses': () => ({
          ip_addresses: [{
            id: 503,
            addr: '2a01:430:17::10',
            prefix: 128,
            network: { id: 24, address: '2a01:430:17::', prefix: 48 },
          }],
        }),
      },
    });

    await page.goto('/admin/ip-addresses?network=24');

    await expect(page.getByTestId('admin.ip_addresses.row.503')).toBeVisible();
  });
});
