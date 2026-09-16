import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, seedTrackedActionStates } from '../../fixtures';

test.describe('Task completion toasts', () => {
  test('@pr-smoke @pr-smoke-mobile does not replay a terminal action restored from session storage', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await seedTrackedActionStates(page, [
      {
        id: 41,
        addedAt: 1_700_000_000_000,
        actionLabelKey: 'action.vps.start.label',
        objectLabel: 'restored.example',
      },
    ]);

    let showCalls = 0;
    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
        'GET action_states/41': () => {
          showCalls += 1;
          return {
            action_state: {
              id: 41,
              label: 'Start',
              status: true,
              finished: true,
              current: 1,
              total: 1,
              created_at: '2026-01-20T12:00:00Z',
              updated_at: '2026-01-20T12:00:01Z',
            },
          };
        },
      },
    });

    await page.goto('/app/vps');
    await expect.poll(() => showCalls).toBeGreaterThan(0);
    await page.getByTestId('tasks.open-button').click();
    await expect(page.getByTestId('tasks.row.41')).toBeVisible();
    await expect(page.getByTestId('toast.action.open_tasks.41')).toHaveCount(0);
  });

  test('shows a toast when a tracked action state finishes', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await seedTrackedActionStates(page, [
      {
        id: 42,
        addedAt: 1_700_000_000_000,
        actionLabelKey: 'action.vps.start.label',
        objectLabel: 'vps42.example',
      },
    ]);

    let showCalls = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET vpses': () => ({
          vpses: [{ id: 42, hostname: 'vps42.example', object_state: 'active', is_running: true }],
          _meta: { total_count: 1 },
        }),
        'GET action_states/42': () => {
          showCalls += 1;
          if (showCalls === 1) {
            return {
              action_state: {
                id: 42,
                label: 'Start',
                status: true,
                finished: false,
                current: 0,
                total: 1,
                created_at: '2026-01-26T12:00:00Z',
                updated_at: '2026-01-26T12:00:01Z',
              },
            };
          }

          return {
            action_state: {
              id: 42,
              label: 'Start',
              status: true,
              finished: true,
              current: 1,
              total: 1,
              created_at: '2026-01-26T12:00:00Z',
              updated_at: '2026-01-26T12:00:02Z',
            },
          };
        },
      },
    });

    await page.goto('/app/vps');

    await expect(page.getByTestId('toast.viewport')).toBeVisible();
    await expect(page.getByTestId('toast.item.1')).toBeVisible();
    await expect(page.getByTestId('toast.action.open_tasks.42')).toBeVisible();
  });
});
