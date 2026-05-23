import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Sync indicator', () => {
  test('shows sync issues when background queries fail and allows manual retry', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let actionStatesCalls = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
        // Fail the first background refresh so the sync indicator appears.
        'GET action_states': () => {
          actionStatesCalls += 1;
          if (actionStatesCalls === 1) return failEnvelope('temporary failure');
          return { action_states: [] };
        },
      },
    });

    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();

    const indicator = page.getByTestId('shell.sync-indicator');
    await expect(indicator).toBeVisible();

    await indicator.click();
    await expect(page.getByTestId('shell.sync-panel')).toBeVisible();
    await expect(page.getByTestId('shell.sync-panel.retry')).toBeVisible();
    await expect(page.getByTestId('shell.sync-panel.reload')).toBeVisible();

    await page.getByTestId('shell.sync-panel.retry').click();
    await expect(indicator).toBeHidden();
  });
});
