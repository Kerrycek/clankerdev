import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke @pr-smoke-mobile @smoke-mobile DNS transfer actions stay reachable on mobile', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  if (mobile) await page.setViewportSize({ width: 320, height: 900 });

  let deleteRequests = 0;
  page.on('request', (request) => {
    if (request.method() === 'DELETE' && request.url().includes('dns_zone_transfers')) deleteRequests += 1;
  });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: mobile
      ? { id: 10, login: 'alice', level: 1 }
      : { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET dns_zones/42': () => ({
        dns_zone: {
          id: 42,
          name: 'very-long-mobile-zone.example.test',
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
          host_ip_address: {
            id: 11,
            ip_address: { ip_addr: '2001:db8:1234:5678:90ab:cdef:1234:5678' },
          },
          peer_type: 'primary_type',
          dns_tsig_key: { id: 21, name: 'very-long-mobile-tsig-key-name.example.test' },
          created_at: '2026-09-16T00:00:00Z',
        }],
      }),
      'GET dns_tsig_keys': () => ({ dns_tsig_keys: [] }),
      'GET dns_record_logs': () => ({ dns_record_logs: [] }),
    },
  });

  await page.goto(`${mobile ? '/app' : '/admin'}/dns/zones/42/transfers`);

  const table = page.getByTestId('dns.transfers.table');
  const cards = page.getByTestId('dns.transfers.cards');
  const card = page.getByTestId('dns.transfers.card.501');
  const desktopRow = page.getByTestId('dns.transfers.row.501');
  const action = page.getByTestId(
    mobile ? 'dns.transfers.card.501.delete' : 'dns.transfers.row.501.delete',
  );

  if (mobile) {
    await expect(cards).toBeVisible();
    await expect(card).toBeVisible();
    await expect(table).toBeHidden();
    await expect(card).toContainText('2001:db8:1234:5678:90ab:cdef:1234:5678');
    await expect(card).toContainText('Primary');
    await expect(card).toContainText('very-long-mobile-tsig-key-name.example.test');
    await expect(card).toContainText('2026');

    await card.locator('summary').click();
    const config = page.getByTestId('dns.transfers.card.501.config');
    await expect(config).toBeVisible();
    await expect(config).toContainText('server 2001:db8:1234:5678:90ab:cdef:1234:5678');
    await expect(config).toContainText('keys { very-long-mobile-tsig-key-name.example.test; };');
    await expect(page.getByTestId('dns.transfers.card.501.copy')).toBeVisible();

    await expectNoDocumentHorizontalOverflow(page);
    const cardMetrics = await card.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(cardMetrics.scrollWidth).toBeLessThanOrEqual(cardMetrics.clientWidth);

    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport();
    await expect(action).toHaveAccessibleName(
      'Delete transfer peer 2001:db8:1234:5678:90ab:cdef:1234:5678?',
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
    await expect(desktopRow).toContainText('2001:db8:1234:5678:90ab:cdef:1234:5678');
    await expect(action).toBeVisible();
  }

  await action.click();
  await expect(page.getByTestId('dns.transfers.delete')).toBeVisible();
  await expect(page.getByTestId('dns.transfers.delete')).toContainText(
    '2001:db8:1234:5678:90ab:cdef:1234:5678',
  );
  await page.getByTestId('dns.transfers.delete.cancel').click();
  await expect(page.getByTestId('dns.transfers.delete')).toBeHidden();
  expect(deleteRequests).toBe(0);
});
