import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test.describe('@smoke @smoke-mobile @pr-smoke @pr-smoke-mobile Header controls', () => {
  test('exposes search, tasks and account controls (touch targets on mobile)', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
      },
    });

    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();

    await expect(page.getByTestId('shell.header')).toBeVisible();

    const inlineSearch = page.getByTestId('shell.inline-search');
    const mobileSearch = page.getByTestId('palette.open');
    const tasks = page.getByTestId('tasks.open-button');
    const account = page.getByTestId('shell.user-menu-button');
    const nav = page.getByTestId('shell.mobile-nav-button');

    await expect(tasks).toBeVisible();
    await expect(account).toBeVisible();

    if (testInfo.project.name === 'mobile-chrome') {
      await expect(nav).toBeVisible();
      await expect(mobileSearch).toBeVisible();
      await expect(inlineSearch).toBeHidden();

      for (const loc of [mobileSearch, tasks, account]) {
        const box = await loc.boundingBox();
        expect(box).not.toBeNull();
        // Minimum 44x44 CSS px touch target.
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }

      await mobileSearch.click();
      const palette = page.getByTestId('palette.modal');
      const paletteInput = page.getByTestId('palette.input');
      await expect(palette).toBeVisible();
      await expect(paletteInput).toBeVisible();
      await expect(paletteInput).toBeFocused();
      await paletteInput.fill('server');
      await expect(paletteInput).toHaveValue('server');

      const viewport = page.viewportSize();
      const paletteBox = await palette.boundingBox();
      const inputBox = await paletteInput.boundingBox();
      expect(viewport).not.toBeNull();
      expect(paletteBox).not.toBeNull();
      expect(inputBox).not.toBeNull();
      expect(paletteBox!.x).toBeGreaterThanOrEqual(-1);
      expect(paletteBox!.x).toBeLessThanOrEqual(1);
      expect(paletteBox!.y).toBeGreaterThanOrEqual(-1);
      expect(paletteBox!.y).toBeLessThanOrEqual(1);
      expect(paletteBox!.width).toBeGreaterThanOrEqual(viewport!.width - 1);
      expect(paletteBox!.height).toBeGreaterThanOrEqual(viewport!.height - 1);
      expect(paletteBox!.x + paletteBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
      expect(paletteBox!.y + paletteBox!.height).toBeLessThanOrEqual(viewport!.height + 1);
      expect(inputBox!.width).toBeGreaterThan(200);
      await expectNoDocumentHorizontalOverflow(page);

      await page.keyboard.press('Escape');
      await expect(palette).toBeHidden();
    } else {
      await expect(nav).toBeHidden();
      await expect(mobileSearch).toBeHidden();
      await expect(inlineSearch).toBeVisible();
    }

    await account.click();
    await expect(page.getByTestId('shell.user-menu')).toBeVisible();
    await expect(page.getByTestId('shell.user-menu.account')).toBeVisible();
    await expect(page.getByTestId('shell.user-menu.public-status')).toBeVisible();
    await expect(page.getByTestId('shell.user-menu.logout')).toHaveAttribute(
      'href',
      /\/oauth\/logout\?next=%2F$/,
    );
  });
});
