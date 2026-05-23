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

async function assertOpaqueSurface(el: Locator) {
  await expect(el).toBeVisible();
  const styles = await el.evaluate((node) => {
    const cs = getComputedStyle(node);
    return {
      backgroundColor: cs.backgroundColor,
      opacity: cs.opacity,
      backgroundImage: cs.backgroundImage,
      backdropFilter: (cs as any).backdropFilter,
      filter: cs.filter,
    };
  });

  expect(parseAlpha(styles.backgroundColor)).toBeGreaterThanOrEqual(0.999);
  expect(Number(styles.opacity)).toBe(1);
  expect(styles.backgroundImage).toBe('none');

  // Both must be none/empty for “solid overlay” contract.
  expect(String(styles.backdropFilter ?? 'none')).toBe('none');
  expect(styles.filter).toBe('none');
}

test.describe('@smoke opaque overlay surfaces', () => {
  test('modal, drawer, command palette and toast surfaces are fully opaque in light and dark', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST_SESSION',
      webuiNext: {
        enableDesignSandbox: true,
      },
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'e2e', level: 2 },
      handlers: {
        // Command palette may call this endpoint after opening.
        'GET vpses': () => ({ vpses: [] }),
      },
    });

    await page.goto('/app/_design');
    await expect(page.getByTestId('design.page')).toBeVisible();

    const themes: Array<'light' | 'dark'> = ['light', 'dark'];

    for (const theme of themes) {
      await page.getByTestId('design.controls.theme').selectOption(theme);
      await expect(page.getByTestId('design.controls.summary')).toHaveAttribute('data-theme', theme);

      // Modal
      await page.getByRole('button', { name: 'Open modal' }).click();
      await assertOpaqueSurface(page.getByTestId('design.modal'));
      await assertOpaqueSurface(page.locator('[data-overlay-backdrop="true"]').first());

      // Toast (triggered from modal Save)
      await page.getByRole('button', { name: 'Save' }).click();
      const toast = page.locator('[data-overlay="toast"]').first();
      await assertOpaqueSurface(toast);

      // Drawer
      await page.getByRole('button', { name: 'Open drawer (left)' }).click();
      await assertOpaqueSurface(page.getByTestId('design.drawer.left'));
      await page.getByTestId('design.drawer.left.close').click();
      await expect(page.getByTestId('design.drawer.left')).toBeHidden();

      // Command palette
      await page.keyboard.press('Control+K');
      await assertOpaqueSurface(page.getByTestId('palette.modal'));
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('palette.modal')).toBeHidden();
    }
  });
});


test.describe('@smoke opaque overlay popovers', () => {
  test('smart-filter and user-lookup popovers are fully opaque in light and dark', async ({ page }) => {
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET users': () => ({
          users: [
            { id: 7, login: 'alice', full_name: 'Alice Example', email: 'alice@example.test', level: 1 },
          ],
        }),
        'GET user_request/registrations': () => ({ registrations: [] }),
        'GET user_request/changes': () => ({ changes: [] }),
      },
    });

    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_ADMIN_SESSION' });

    const themes = ['light', 'dark'] as const;

    for (const theme of themes) {
      await page.goto('/app/_design');
      await page.getByTestId('design.controls.theme').selectOption(theme);
      await expect(page.getByTestId('design.controls.summary')).toHaveAttribute('data-theme', theme);

      await page.goto('/admin/users');
      const smartInput = page.getByTestId('admin.users.smart_filter.input');
      await smartInput.fill('123');
      const smartPopover = page.getByTestId('admin.users.smart_filter.input.dropdown');
      await assertOpaqueSurface(smartPopover);

      await page.goto('/admin/requests');
      await page.getByRole('button', { name: /advanced/i }).click();
      const userLookup = page.getByTestId('admin.requests.filter.user.lookup');
      await userLookup.fill('ali');
      const lookupPopover = page.getByTestId('admin.requests.filter.user.lookup.dropdown');
      await assertOpaqueSurface(lookupPopover);
      await expect(page.getByTestId('admin.requests.filter.user.lookup.opt.7')).toBeVisible();
    }
  });
});
