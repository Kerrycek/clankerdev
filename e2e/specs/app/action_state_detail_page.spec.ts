import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Action state detail page', () => {
  test('Renders header + cancel dialog and calls cancel endpoint', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST_TOKEN',
    });

    const makeAction = (id: number) => ({
      id,
      label: `Action ${id}`,
      state: 'running',
      created_at: new Date('2026-01-26T00:00:00.000Z').toISOString(),
      updated_at: new Date('2026-01-26T00:10:00.000Z').toISOString(),
      can_cancel: true,
      current: 5,
      total: 10,
      unit: 'tx',
      finished: false,
      status: true,
    });

    let cancelCalled = false;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET action_states/123': () => makeAction(123),
        'POST action_states/123/cancel': () => {
          cancelCalled = true;
          return {};
        },
      },
    });

    await page.goto('/app/action-states/123');

    await expect(page.getByTestId('action_state.detail')).toBeVisible();
    await expect(page.getByTestId('action_state.detail.header')).toBeVisible();

    // Primary controls
    await expect(page.getByTestId('action_state.detail.refresh')).toBeVisible();
    await expect(page.getByTestId('action_state.detail.open_tasks')).toBeVisible();

    // Cancel flow
    await page.getByTestId('action_state.detail.cancel').click();
    await expect(page.getByTestId('tasks.cancel_dialog')).toBeVisible();

    await page.getByTestId('tasks.cancel_dialog.confirm').click();

    await expect.poll(() => cancelCalled).toBe(true);
  });
});
