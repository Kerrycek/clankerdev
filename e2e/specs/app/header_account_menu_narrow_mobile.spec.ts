import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke-mobile keeps the account menu inside a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'test', level: 1 },
    handlers: {
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
    },
  });

  await page.goto('/app/vps');
  await expect(page.getByTestId('vps.list')).toBeVisible();
  await page.getByTestId('shell.user-menu-button').click();

  const menu = page.getByTestId('shell.user-menu');
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  await expect(page.getByTestId('shell.user-menu.account')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('shell.user-menu.logout')).toBeInViewport({ ratio: 1 });
  await expectNoDocumentHorizontalOverflow(page);
});
