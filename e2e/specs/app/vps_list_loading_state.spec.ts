import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

/**
 * NOTE: E2E tests are scaffolding only. Keep them cheap, deterministic, and
 * focused on user-visible behavior + test ids.
 */

test.describe('@smoke VPS list loading state', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET vpses': async () => {
          // simulate latency so the loading state is visible
          await new Promise((r) => setTimeout(r, 1500));
          return { vpses: [], _meta: { total_count: 0 } };
        },
      },
    });
  });

  test('shows loading state while fetching and then empty state', async ({ page }) => {
    await page.goto('/app/vps');

    await expect(page.getByTestId('vps.list.loading')).toBeVisible();
    await expect(page.getByTestId('vps.list.empty')).toBeVisible();
  });
});
