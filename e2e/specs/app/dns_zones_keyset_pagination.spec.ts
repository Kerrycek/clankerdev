import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('DNS zones keyset pagination', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    const makeZone = (id: number) => ({
      id,
      name: `zone${id}.example`,
      role: id % 3 === 0 ? 'secondary' : 'primary',
      enabled: id % 2 === 0,
      dnssec_enabled: id % 4 === 0,
      serial: 2026012600 + (300 - id),
      default_ttl: id % 2 === 0 ? 3600 : 600,
    });

    const page1 = Array.from({ length: 50 }, (_, i) => 300 - i).map(makeZone);
    const page2 = Array.from({ length: 50 }, (_, i) => 250 - i).map(makeZone);

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET dns_zones': ({ searchParams }) => {
          const fromId = searchParams.get('dns_zone[from_id]');
          return { dns_zones: fromId ? page2 : page1, _meta: { total_count: 100 } };
        },
      },
    });
  });

  test('navigates to next and previous pages via from_id', async ({ page }) => {
    await page.goto('/app/dns');

    await expect(page.getByTestId('dns.zones.list')).toBeVisible();
    await expect(page.getByTestId('dns.zones.row.300')).toBeVisible();
    await expect(page.getByTestId('dns.zones.row.300.dot')).toBeVisible();
    await expect(page.getByTestId('dns.zones.row.299')).toHaveAttribute('data-row-variant', 'warn');
    await expect(page.getByTestId('dns.zones.row.299.dot')).toBeVisible();

    await page.getByTestId('dns.zones.pagination.desktop.next').click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('dns.zones.row.250')).toBeVisible();

    const prev = page.getByTestId('dns.zones.pagination.desktop.prev');
    await expect(prev).toBeEnabled();
    await prev.click({ force: true });
    await expect(page).not.toHaveURL(/from_id=/, { timeout: 30_000 });
    await expect(page).toHaveURL(/page=1/);
    await expect(page.getByTestId('dns.zones.row.300')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('dns.zones.row.300.dot')).toBeVisible();
    await expect(page.getByTestId('dns.zones.row.299')).toHaveAttribute('data-row-variant', 'warn');
    await expect(page.getByTestId('dns.zones.row.299.dot')).toBeVisible();
  });

  test('canonicalizes zone name when creating a DNS zone', async ({ page }) => {
    let createPayload: any;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET dns_zones': () => ({ dns_zones: [], _meta: { total_count: 0 } }),
        'POST dns_zones': async ({ request }) => {
          createPayload = await request.postDataJSON();
          return {
            dns_zone: {
              id: 401,
              name: createPayload?.dns_zone?.name,
              enabled: true,
              default_ttl: 3600,
            },
          };
        },
      },
    });

    await page.goto('/app/dns');
    await page.getByTestId('dns.zones.create.open').click();
    await page.getByTestId('dns.zones.create.name').fill('example.test');
    await page.getByTestId('dns.zones.create.email').fill('hostmaster@example.test');
    await page.getByTestId('dns.zones.create.submit').click();

    await expect.poll(() => createPayload?.dns_zone?.name).toBe('example.test.');
    expect(createPayload?.dns_zone?.email).toBe('hostmaster@example.test');
    expect(createPayload?.dns_zone?.source).toBe('internal_source');
    expect(createPayload?.dns_zone?.default_ttl).toBe(3600);
    expect(createPayload?.dns_zone?.enabled).toBe(true);
    expect(createPayload?.dns_zone?.dnssec_enabled).toBe(false);
  });
});
