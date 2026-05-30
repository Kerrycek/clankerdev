import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock } from '../../fixtures';

function alphaFromComputedBg(bg: string): number {
  // Common forms:
  // - rgb(r, g, b)
  // - rgba(r, g, b, a)
  const m = bg.match(/rgba?\(([^)]+)\)/i);
  if (!m) return 1;
  const parts = m[1].split(',').map((s) => s.trim());
  if (parts.length < 4) return 1;
  const a = Number(parts[3]);
  return Number.isFinite(a) ? a : 1;
}

test.describe('@smoke Header popovers', () => {
  test('header, user menu and sync panel backgrounds are opaque', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    // Force one background failure so the sync indicator appears.
    let actionStatesCalls = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 90 },
      handlers: {
        'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
        'GET action_states': () => {
          actionStatesCalls += 1;
          if (actionStatesCalls === 1) return failEnvelope('temporary failure');
          return { action_states: [] };
        },
      },
    });

    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();

    // Sticky header and chrome controls must be fully opaque, and controls must not visually collapse into the header surface.
    const header = page.getByTestId('shell.header');
    await expect(header).toBeVisible();
    const headerBg = await header.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(alphaFromComputedBg(headerBg)).toBeGreaterThanOrEqual(0.999);

    const paletteButton = page.getByTestId('palette.open');
    await expect(paletteButton).toBeVisible();
    const paletteBg = await paletteButton.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(alphaFromComputedBg(paletteBg)).toBeGreaterThanOrEqual(0.999);

    const tasksButton = page.getByTestId('tasks.open-button');
    await expect(tasksButton).toBeVisible();
    const tasksBg = await tasksButton.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(alphaFromComputedBg(tasksBg)).toBeGreaterThanOrEqual(0.999);

    const userMenuButton = page.getByTestId('shell.user-menu-button');
    await expect(userMenuButton).toBeVisible();
    const userButtonBg = await userMenuButton.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(alphaFromComputedBg(userButtonBg)).toBeGreaterThanOrEqual(0.999);

    // User menu popover
    await page.getByTestId('shell.user-menu-button').click();
    const userMenu = page.getByTestId('shell.user-menu');
    await expect(userMenu).toBeVisible();
    const userMenuBg = await userMenu.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(alphaFromComputedBg(userMenuBg)).toBeGreaterThanOrEqual(0.999);

    // Sync indicator popover
    const indicator = page.getByTestId('shell.sync-indicator');
    await expect(indicator).toBeVisible();
    await indicator.click();
    const syncPanel = page.getByTestId('shell.sync-panel');
    await expect(syncPanel).toBeVisible();
    const syncBg = await syncPanel.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(alphaFromComputedBg(syncBg)).toBeGreaterThanOrEqual(0.999);
  });
});
