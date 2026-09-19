import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile Drawer keeps focus and coarse-pointer controls accessible', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  await page.setViewportSize({ width: mobile ? 320 : 1440, height: mobile ? 844 : 1000 });
  await bootstrapVpsAdminWindow(page, {
    sessionToken: 'DRAWER_ACCESSIBILITY',
    webuiNext: { enableDesignSandbox: true },
  });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'e2e', level: 2 },
  });

  await page.goto('/app/_design');

  const opener = page.getByRole('button', { name: 'Open drawer (left)' });
  await opener.focus();
  await opener.press('Enter');

  const drawer = page.getByRole('dialog', { name: 'Demo drawer' });
  const close = page.getByTestId('design.drawer.left.close');
  const footerClose = drawer.getByRole('button', { name: 'Close', exact: true }).last();
  const input = drawer.getByPlaceholder('Input inside drawer');

  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute('aria-modal', 'true');
  await expect(close).toBeFocused();

  await close.press('Shift+Tab');
  await expect(footerClose).toBeFocused();
  await footerClose.press('Tab');
  await expect(close).toBeFocused();
  await close.press('Tab');
  await expect(input).toBeFocused();

  const coarsePointer = await page.evaluate(() => window.matchMedia('(any-pointer: coarse)').matches);
  const closeBox = await close.boundingBox();
  expect(closeBox).not.toBeNull();
  expect(closeBox!.height).toBe(coarsePointer ? 44 : 32);
  expect(closeBox!.width).toBe(coarsePointer ? 44 : 32);

  await input.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(opener).toBeFocused();

  if (mobile) {
    await page.setViewportSize({ width: 844, height: 390 });
    expect(await page.evaluate(() => window.matchMedia('(any-pointer: coarse)').matches)).toBe(true);
  }

  await opener.press('Enter');
  await expect(drawer).toBeVisible();
  const landscapeCloseBox = await close.boundingBox();
  expect(landscapeCloseBox).not.toBeNull();
  expect(landscapeCloseBox!.height).toBe(coarsePointer ? 44 : 32);
  expect(landscapeCloseBox!.width).toBe(coarsePointer ? 44 : 32);

  const backdrop = page.locator('[data-overlay-backdrop="true"]');
  const backdropBox = await backdrop.boundingBox();
  expect(backdropBox).not.toBeNull();
  await page.mouse.click(backdropBox!.x + backdropBox!.width - 4, backdropBox!.y + backdropBox!.height / 2);
  await expect(drawer).toBeHidden();
  await expect(opener).toBeFocused();
});
