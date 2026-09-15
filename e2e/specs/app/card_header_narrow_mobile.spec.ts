import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke-mobile stacks card actions below readable copy at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'test', level: 1 },
    handlers: {
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
      'GET datasets': () => ({ datasets: [], _meta: { total_count: 0 } }),
      'GET dns_zones': () => ({ dns_zones: [], _meta: { total_count: 0 } }),
      'GET nodes/public_status': () => ({ nodes: [] }),
      'GET outages': () => ({ outages: [] }),
      'GET news_logs': () => ({ news_logs: [] }),
      'GET security_advisories': () => ({
        security_advisories: [
          {
            id: 77,
            name: 'OpenSSL advisory',
            state: 'published',
            published_at: new Date().toISOString(),
            affected: true,
            affected_node_count: 2,
            affected_user_count: 1,
            affected_vps_count: 3,
            en_summary: 'Patch OpenSSL on affected hosts',
            cs_summary: 'Aktualizujte OpenSSL na dotčených hostech',
            security_advisory_cves: [{ id: 7701, cve_id: 'CVE-2026-0001' }],
          },
        ],
        _meta: { total_count: 1 },
      }),
    },
  });

  await page.goto('/app');

  const card = page.getByTestId('app.dashboard.security.card');
  await expect(card).toBeVisible();
  const header = card.locator(':scope > div').first();
  await header.scrollIntoViewIfNeeded();
  const copy = header.locator(':scope > div').first();
  const actions = header.locator(':scope > div').nth(1);
  const [cardBox, copyBox, actionsBox] = await Promise.all([
    card.boundingBox(),
    copy.boundingBox(),
    actions.boundingBox(),
  ]);

  expect(cardBox).not.toBeNull();
  expect(copyBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(copyBox!.width).toBeGreaterThan(cardBox!.width * 0.75);
  expect(actionsBox!.y).toBeGreaterThanOrEqual(copyBox!.y + copyBox!.height);
  const interactiveActions = actions.locator('a, button');
  await expect(interactiveActions).toHaveCount(2);
  for (const action of await interactiveActions.all()) {
    await expect(action).toBeInViewport({ ratio: 1 });
  }
  await expectNoDocumentHorizontalOverflow(page);
});
