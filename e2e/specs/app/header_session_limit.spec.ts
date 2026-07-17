import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('header shows configured inactivity limit instead of BFF cookie lifetime', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, {
    sessionToken: 'TEST_USER_SESSION',
    webuiNext: {
      sessionExpiresAt: Date.now() + 720 * 60 * 60 * 1000,
    },
  });

  await installHaveApiMock(page, {
    user: {
      id: 53,
      login: 'KerryCZE',
      level: 99,
      preferred_session_length: 40 * 60,
    },
    handlers: {
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
      'GET datasets': () => ({ datasets: [], _meta: { total_count: 0 } }),
      'GET dns_zones': () => ({ dns_zones: [], _meta: { total_count: 0 } }),
      'GET transaction_chains': () => ({ transaction_chains: [], _meta: { total_count: 0 } }),
    },
  });

  await page.goto('/app');

  await expect(page.getByTestId('shell.session-remaining')).toContainText('40 min');
  await expect(page.getByTestId('shell.session-remaining')).not.toContainText('720');

  await page.getByTestId('shell.user-menu-button').click();
  await expect(page.getByTestId('shell.user-menu')).toBeVisible();
  await expect(page.getByTestId('shell.user-menu')).not.toContainText('720');
});
