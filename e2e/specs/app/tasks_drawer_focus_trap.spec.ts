import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile @smoke @smoke-mobile Tasks drawer opens as a non-modal side panel', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'test', level: 1 },
    handlers: {
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
    },
  });

  await page.goto('/app/vps');

  const openBtn = page.getByTestId('tasks.open-button');
  await expect(openBtn).toBeVisible();

  await openBtn.focus();
  await expect(openBtn).toBeFocused();

  await openBtn.click();

  const drawer = page.getByTestId('tasks.drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute('aria-modal', 'false');
  await expect(page.locator('[data-overlay-backdrop="true"]')).toHaveCount(0);

  const closeBtn = page.getByTestId('tasks.close-button');
  await expect(closeBtn).toBeVisible();

  // The Tasks drawer is intentionally non-modal: the current page remains visible and usable behind it.
  await expect(page.getByTestId('vps.list')).toBeVisible();
  await expect(openBtn).toBeVisible();

  // Escape still closes the panel without navigating away from the underlying page.
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/app\/vps(?:\?.*)?$/);
});

test('@pr-smoke Tasks drawer cards stay readable in the narrow side panel', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'test', level: 1 },
    handlers: {
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
      'GET action_states': () => ({
        action_states: [
          {
            id: 79,
            label: 'Stop virtual private server with a longer generated task label',
            status: true,
            finished: true,
            current: 1,
            total: 1,
            created_at: '2026-05-31T01:35:27Z',
            updated_at: '2026-05-31T01:35:27Z',
            transaction_chain: { id: 79 },
          },
        ],
      }),
    },
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/app/vps');
  await page.getByTestId('tasks.open-button').click();

  const drawer = page.getByTestId('tasks.drawer');
  const row = page.getByTestId('tasks.row.79');
  const actions = page.getByTestId('tasks.row.actions.79');

  await expect(drawer).toBeVisible();
  await expect(row).toBeVisible();
  await expect(actions).toBeVisible();
  await expect(row.getByText('Stop virtual private server')).toBeVisible();
  await expect(row.getByText(/(created|vytvořeno)/i)).toBeVisible();
  await expect(row.getByText(/(updated|upraveno)/i)).toBeVisible();

  const drawerBox = await drawer.boundingBox();
  const rowBox = await row.boundingBox();
  const actionsBox = await actions.boundingBox();

  expect(drawerBox).not.toBeNull();
  expect(rowBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(rowBox!.x).toBeGreaterThanOrEqual(drawerBox!.x);
  expect(rowBox!.x + rowBox!.width).toBeLessThanOrEqual(drawerBox!.x + drawerBox!.width);
  expect(actionsBox!.x).toBeGreaterThanOrEqual(rowBox!.x);
  expect(actionsBox!.x + actionsBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width);
});
