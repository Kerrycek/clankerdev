import { expect, test, type Locator } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

function parseAlpha(bg: string): number {
  const t = bg.trim().toLowerCase();
  if (t === 'transparent') return 0;

  if (t.startsWith('rgba(') && t.endsWith(')')) {
    const parts = t
      .slice(5, -1)
      .split(',')
      .map((p) => p.trim());

    if (parts.length === 4) return Number(parts[3]);
  }

  if (t.startsWith('rgb(')) return 1;

  return NaN;
}

async function backgroundAlpha(el: Locator): Promise<number> {
  const bg = await el.evaluate((node) => getComputedStyle(node).backgroundColor);
  return parseAlpha(bg);
}

async function fontVariantNumeric(el: Locator): Promise<string> {
  return await el.evaluate((node) => getComputedStyle(node).fontVariantNumeric);
}

async function assertTabularNumerals(el: Locator) {
  await el.scrollIntoViewIfNeeded();
  const v = (await fontVariantNumeric(el)).toLowerCase();
  expect(v).toContain('tabular');
}

async function assertTableScanContrast(table: Locator) {
  await table.scrollIntoViewIfNeeded();

  const clickableRow = table.locator('tbody tr').first();
  const zebraRow = table.locator('tbody tr').nth(1);

  const zebraBg = await zebraRow.evaluate((node) => getComputedStyle(node).backgroundColor);
  const zebraA = parseAlpha(zebraBg);
  expect(zebraA).toBe(1);

  await clickableRow.hover();
  // Contract: zebra rows use a solid alternate background, and hover on a clickable row
  // switches that row to a visible scan-contrast tone. Wait for the CSS transition
  // before reading the computed style; CI can otherwise sample the transparent
  // pre-hover value immediately after hover().
  await expect
    .poll(async () => {
      const hoverBg = await clickableRow.evaluate((node) => getComputedStyle(node).backgroundColor);
      return parseAlpha(hoverBg);
    })
    .toBeGreaterThanOrEqual(0.8);
}

test('@smoke design sandbox renders and UI settings controls work', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, {
    sessionToken: 'TEST_SESSION',
    webuiNext: {
      enableDesignSandbox: true,
    },
  });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'e2e', level: 2 },
  });

  await page.goto('/app/_design');

  await expect(page.getByTestId('design.page')).toBeVisible();
  await expect(page.getByTestId('design.controls')).toBeVisible();
  // Defaults
  await expect(page.getByTestId('design.controls.summary')).toHaveAttribute('data-theme', 'system');

  const table = page.getByTestId('design.tables.table');
  const rawTable = page.getByTestId('design.tables.raw_table');

  // Light theme: verify list table zebra + hover scan contrast
  await page.getByTestId('design.controls.theme').selectOption('light');
  await expect(page.getByTestId('design.controls.summary')).toHaveAttribute('data-theme', 'light');
  await assertTableScanContrast(table);
  await assertTabularNumerals(rawTable);

  // Dark theme: same contract
  await page.getByTestId('design.controls.theme').selectOption('dark');
  await expect(page.getByTestId('design.controls.summary')).toHaveAttribute('data-theme', 'dark');
  await assertTableScanContrast(table);
  await assertTabularNumerals(rawTable);

  // Drawer close button contract
  await page.getByRole('button', { name: 'Open drawer (left)' }).click();
  await expect(page.getByTestId('design.drawer.left')).toBeVisible();
  await page.getByTestId('design.drawer.left.close').click();
  await expect(page.getByTestId('design.drawer.left')).toBeHidden();
});
