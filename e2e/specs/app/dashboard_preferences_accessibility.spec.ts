import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile dashboard preferences: preserves disclosure focus and responsive touch targets', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  const viewportWidth = mobile ? 320 : 1440;
  await page.setViewportSize({ width: viewportWidth, height: mobile ? 844 : 1000 });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'DASHBOARD_PREFERENCES_ACCESSIBILITY' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'test', level: 1 },
    handlers: {
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
      'GET datasets': () => ({ datasets: [], _meta: { total_count: 0 } }),
      'GET dns_zones': () => ({ dns_zones: [], _meta: { total_count: 0 } }),
      'GET nodes/public_status': () => ({ nodes: [] }),
      'GET outages': () => ({ outages: [] }),
      'GET news_logs': () => ({ news_logs: [] }),
      'GET security_advisories': () => ({ security_advisories: [], _meta: { total_count: 0 } }),
    },
  });

  await page.goto('/app');

  const card = page.getByTestId('app.dashboard.preferences.card');
  const trigger = page.getByTestId('app.dashboard.preferences.toggle');
  const panel = page.locator('#app-dashboard-preferences-panel');

  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveAttribute('aria-controls', 'app-dashboard-preferences-panel');
  await expect(panel).toBeHidden();

  await trigger.focus();
  await trigger.press('Enter');

  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();

  const assertControlGeometry = async (width: number, expectedButtonHeight: number, expectedSelectHeight: number) => {
    const buttons = card.getByRole('button');
    const buttonCount = await buttons.count();
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(buttonCount).toBeGreaterThan(1);
    for (let index = 0; index < buttonCount; index += 1) {
      const box = await buttons.nth(index).boundingBox();
      expect(box, `button ${index + 1} should be visible`).not.toBeNull();
      expect(box!.height, `button ${index + 1} should meet its target size`).toBe(expectedButtonHeight);
      expect(box!.x, `button ${index + 1} should stay inside the card`).toBeGreaterThanOrEqual(cardBox!.x - 0.5);
      expect(box!.x + box!.width, `button ${index + 1} should stay inside the card`).toBeLessThanOrEqual(
        cardBox!.x + cardBox!.width + 0.5,
      );
      expect(box!.x + box!.width, `button ${index + 1} should stay inside the viewport`).toBeLessThanOrEqual(width + 0.5);
    }

    const densityBox = await page.getByTestId('app.dashboard.preferences.density').boundingBox();
    expect(densityBox).not.toBeNull();
    expect(densityBox!.height).toBe(expectedSelectHeight);
    const widths = await card.evaluate((element) => ({
      client: element.clientWidth,
      scroll: element.scrollWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
    expect(widths.document).toBeLessThanOrEqual(width);
  };

  expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(mobile);
  expect(await page.evaluate(() => window.matchMedia('(any-pointer: coarse)').matches)).toBe(mobile);
  await assertControlGeometry(viewportWidth, mobile ? 44 : 32, mobile ? 44 : 36);

  if (mobile) {
    await page.setViewportSize({ width: 844, height: 390 });
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true);
    expect(await page.evaluate(() => window.matchMedia('(any-pointer: coarse)').matches)).toBe(true);
    await assertControlGeometry(844, 44, 44);
  }

  await trigger.press('Enter');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeHidden();
});
