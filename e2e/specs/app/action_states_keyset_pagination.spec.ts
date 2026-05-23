import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Action states keyset pagination', () => {
  test('Next/Prev updates URL and data', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST_TOKEN',
    });

    const makeAction = (id: number) => ({
      id,
      label: `Action ${id}`,
      state: 'running',
      created_at: new Date('2026-01-26T00:00:00.000Z').toISOString(),
      updated_at: new Date('2026-01-26T00:00:00.000Z').toISOString(),
      can_cancel: true,
      current: 5,
      total: 10,
      unit: 'tx',
      finished: false,
      status: true,
    });

    const page1 = Array.from({ length: 50 }, (_, i) => 300 - i).map(makeAction);
    const page2 = Array.from({ length: 50 }, (_, i) => 250 - i).map(makeAction);

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET action_states': ({ searchParams }) => {
          const fromId = searchParams.get('action_state[from_id]');
          return { action_states: fromId ? page2 : page1, _meta: { total_count: 100 } };
        },
        // Detail
        'GET action_states/300': () => makeAction(300),
        'GET action_states/250': () => makeAction(250),
      },
    });

    await page.goto('/app/action-states');

    await expect(page.getByTestId('action_states.page')).toBeVisible();
    await expect(page.getByTestId('action_states.row.300')).toBeVisible();

    await page.getByTestId('action_states.pagination.next').click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('action_states.row.250')).toBeVisible();

    await page.getByTestId('action_states.pagination.prev').click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId('action_states.row.300')).toBeVisible();
  });
});
