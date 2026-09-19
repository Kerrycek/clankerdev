import { expect, test, type Locator, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const labels = {
  chain: /^(Chain|Řetězec)$/,
  node: /^Node$/,
  type: /^(Type|Typ)$/,
  done: /^(Done|Dokončeno)$/,
  success: /^(Success|Úspěch)$/,
};

async function expectHeight(locator: Locator, expected: number) {
  const box = await locator.boundingBox();
  expect(box, 'control should have a rendered box').not.toBeNull();
  expect(Math.round(box?.height ?? 0)).toBe(expected);
}

async function expectActiveTestId(page: Page, testId: string) {
  await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid ?? null)).toBe(testId);
}

test('@pr-smoke @pr-smoke-mobile advanced item filters expose labels, keyboard order, and responsive touch geometry', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name.includes('mobile');
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'test', level: 1 },
    handlers: {
      'GET transactions': () => ({ transactions: [], _meta: { total_count: 0 } }),
    },
  });

  await page.goto('/app/transactions/items?node=5');
  await expect(page.getByTestId('transactions.items.empty')).toBeVisible();
  await expectHeight(page.getByTestId('transactions.items.smart_filter.input'), mobile ? 44 : 36);

  const topActions = [
    page.getByTestId('transactions.items.smart_filter.help'),
    page.getByTestId('transactions.items.advanced.open'),
    page.getByTestId('transactions.items.copy_link'),
    page.getByTestId('transactions.items.clear_filters'),
  ];
  for (const action of topActions) await expectHeight(action, mobile ? 44 : 32);
  if (mobile) {
    const advancedBox = await page.getByTestId('transactions.items.advanced.open').boundingBox();
    expect(Math.round(advancedBox?.width ?? 0)).toBeGreaterThanOrEqual(44);
  }

  await page.getByTestId('transactions.items.advanced.open').click();
  const drawer = page.getByTestId('transactions.items.advanced.drawer');
  await expect(drawer).toBeVisible();

  const controls = [
    page.getByRole('textbox', { name: labels.chain }),
    page.getByRole('textbox', { name: labels.node }),
    page.getByRole('textbox', { name: labels.type }),
    page.getByRole('combobox', { name: labels.done }),
    page.getByRole('combobox', { name: labels.success }),
  ];
  for (const control of controls) await expectHeight(control, mobile ? 44 : 36);

  const ids = await Promise.all(controls.map((control) => control.getAttribute('id')));
  expect(ids.every(Boolean)).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
  await expect(controls[0]).toHaveAttribute('inputmode', 'numeric');
  await expect(controls[1]).toHaveAttribute('inputmode', 'numeric');
  await expect(controls[2]).toHaveAttribute('inputmode', 'numeric');

  await controls[1].focus();
  await drawer.locator('label').filter({ hasText: labels.chain }).click();
  await expect(controls[0]).toBeFocused();
  await controls[4].focus();
  await drawer.locator('label').filter({ hasText: labels.done }).click();
  await expect(controls[3]).toBeFocused();

  await expectHeight(page.getByTestId('transactions.items.advanced.clear'), mobile ? 44 : 32);
  await expectHeight(page.getByTestId('transactions.items.advanced.footer_done'), mobile ? 44 : 32);

  await page.getByTestId('drawer.close').focus();
  for (const testId of [
    'transactions.items.advanced.chain',
    'transactions.items.advanced.node',
    'transactions.items.advanced.type',
    'transactions.items.advanced.done',
    'transactions.items.advanced.success',
    'transactions.items.advanced.clear',
    'transactions.items.advanced.footer_done',
    'drawer.close',
  ]) {
    await page.keyboard.press('Tab');
    await expectActiveTestId(page, testId);
  }
});
