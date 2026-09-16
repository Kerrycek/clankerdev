import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke @pr-smoke-mobile @smoke-mobile DNS zone server actions stay reachable on mobile', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  if (mobile) await page.setViewportSize({ width: 320, height: 900 });

  let deleteRequests = 0;
  page.on('request', (request) => {
    if (request.method() === 'DELETE' && request.url().includes('/dns_server_zones/')) deleteRequests += 1;
  });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET dns_zones/42': () => ({
        dns_zone: {
          id: 42,
          name: 'very-long-mobile-zone.example.test',
          source: 'internal_source',
          enabled: true,
          dnssec_enabled: true,
          serial: 2026091601,
          user: { id: 1, login: 'admin' },
        },
      }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'GET dns_server_zones': () => ({
        dns_server_zones: [{
          id: 501,
          dns_server: { id: 5, name: 'ns1-with-a-long-name.example.test' },
          type: 'primary_type',
          serial: 2026091601,
          loaded_at: '2022-09-16T00:10:00Z',
          refresh_at: '2023-09-16T01:10:00Z',
          expires_at: '2024-09-23T00:10:00Z',
          last_check_at: '2025-09-16T00:40:00Z',
        }],
      }),
      'GET dns_servers': () => ({
        dns_servers: [{ id: 5, name: 'ns1-with-a-long-name.example.test' }],
      }),
    },
  });

  await page.goto('/admin/dns/zones/42/servers');

  const table = page.getByTestId('dns.servers.table');
  const cards = page.getByTestId('dns.servers.cards');
  const card = page.getByTestId('dns.servers.card.501');
  const desktopRow = page.getByTestId('dns.servers.row.501');
  const action = page.getByTestId(
    mobile ? 'dns.servers.card.501.delete' : 'dns.servers.row.501.delete',
  );
  const visiblePagination = page.getByTestId(
    `dns.servers.pagination.${mobile ? 'mobile' : 'desktop'}.page.1`,
  );
  const hiddenPagination = page.getByTestId(
    `dns.servers.pagination.${mobile ? 'desktop' : 'mobile'}.page.1`,
  );

  if (mobile) {
    await expect(cards).toBeVisible();
    await expect(card).toBeVisible();
    await expect(table).toBeHidden();
    await expect(card).toContainText('ns1-with-a-long-name.example.test');
    await expect(card).toContainText('Primary');
    await expect(card).toContainText('2026091601');
    await expect(card).toContainText('Loaded');
    await expect(card).toContainText('Refresh');
    await expect(card).toContainText('Expires');
    await expect(card).toContainText('Last check');
    for (const year of ['2022', '2023', '2024', '2025']) await expect(card).toContainText(year);

    await expectNoDocumentHorizontalOverflow(page);
    await expect.poll(() => card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport();
    await expect(action).toHaveAccessibleName(
      'Remove zone from server ns1-with-a-long-name.example.test?',
    );

    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewportWidth);
  } else {
    await expect(cards).toBeHidden();
    await expect(table).toBeVisible();
    await expect(desktopRow).toBeVisible();
    await expect(desktopRow).toContainText('ns1-with-a-long-name.example.test');
    await expect(action).toBeVisible();
  }

  await expect(visiblePagination).toBeVisible();
  await expect(hiddenPagination).toBeHidden();

  await action.click();
  const confirmation = page.getByTestId('dns.servers.delete');
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('ns1-with-a-long-name.example.test');
  await confirmation.getByTestId('dns.servers.delete.cancel').click();
  await expect(confirmation).toBeHidden();
  expect(deleteRequests).toBe(0);

  await page.goto('/app/dns/zones/42/servers');
  await expect(page.getByTestId(mobile ? 'dns.servers.card.501' : 'dns.servers.row.501')).toBeVisible();
  await expect(page.getByTestId('dns.servers.create.open')).toHaveCount(0);
  await expect(page.getByTestId('dns.servers.card.501.delete')).toHaveCount(0);
  await expect(page.getByTestId('dns.servers.row.501.delete')).toHaveCount(0);
});
