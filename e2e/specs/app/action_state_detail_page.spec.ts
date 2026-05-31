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
        'GET action_states/123': () => ({ action_state: makeAction(123) }),
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

  for (const roleCase of [
    { name: 'user', basePath: '/app', user: { id: 1, login: 'user', level: 1 } },
    { name: 'admin', basePath: '/admin', user: { id: 1, login: 'admin', level: 99 } },
  ]) {
    test(`shows related transactions and expandable payloads for ${roleCase.name}`, async ({ page }) => {
      await bootstrapVpsAdminWindow(page, {
        sessionToken: 'TEST_TOKEN',
      });

      const handlers = {
        'GET action_states/123': () => ({
          action_state: {
            id: 123,
            label: 'Create VPS',
            state: 'done',
            created_at: '2026-01-26T00:00:00.000Z',
            updated_at: '2026-01-26T00:10:00.000Z',
            current: 2,
            total: 2,
            finished: true,
            status: true,
            transaction_chain: { id: 456, label: 'Create chain' },
          },
        }),
        'GET transaction_chains/456': () => ({
          transaction_chain: {
            id: 456,
            label: 'Create chain',
            state: 'done',
            progress: 2,
            size: 2,
          },
        }),
        'GET transactions': ({ searchParams }: { searchParams: URLSearchParams }) => {
          if (searchParams.get('transaction[transaction_chain]') !== '456') return { transactions: [] };
          return {
            transactions: [
              {
                id: 7001,
                name: 'Create dataset',
                done: 'done',
                success: 1,
                type: 3001,
                priority: 0,
                created_at: '2026-01-26T00:01:00.000Z',
                started_at: '2026-01-26T00:01:01.000Z',
                finished_at: '2026-01-26T00:01:05.000Z',
                node: { id: 2, label: 'node2' },
                vps: { id: 12, label: 'vps12' },
                transaction_chain: { id: 456 },
                input: { dataset: 'tank/ct/vps12' },
                output: { ok: true },
              },
            ],
          };
        },
      };

      await installHaveApiMock(page, {
        user: roleCase.user,
        handlers,
      });

      await page.goto(`${roleCase.basePath}/action-states/123`);

      await expect(page.getByTestId('action_state.detail.transactions')).toBeVisible();
      await expect(page.getByTestId('action_state.detail.transactions.view_all')).toHaveAttribute(
        'href',
        `${roleCase.basePath}/transactions/items?transaction_chain=456`
      );

      await page.getByTestId('action_state.detail.tx.toggle.7001').click();
      await expect(page.getByTestId('action_state.detail.tx.expanded.7001')).toBeVisible();
      await expect(page.getByTestId('action_state.detail.tx.expanded.7001')).toContainText('tank/ct/vps12');
    });
  }

  test('deep reload keeps action-state detail and chained transactions visible', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST_TOKEN',
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET action_states/123': () => ({
          action_state: {
            id: 123,
            label: 'Create VPS',
            state: 'done',
            current: 1,
            total: 1,
            finished: true,
            status: true,
            transaction_chain: { id: 456, label: 'Create chain' },
          },
        }),
        'GET transaction_chains/456': () => ({
          transaction_chain: { id: 456, label: 'Create chain', state: 'done', progress: 1, size: 1 },
        }),
        'GET transactions': ({ searchParams }: { searchParams: URLSearchParams }) => {
          if (searchParams.get('transaction[transaction_chain]') !== '456') return { transactions: [] };
          return {
            transactions: [
              {
                id: 7001,
                name: 'Create dataset',
                done: 'done',
                success: 1,
                transaction_chain: { id: 456 },
                input: { dataset: 'tank/ct/vps12' },
              },
            ],
          };
        },
      },
    });

    await page.goto('/app/action-states/123');
    await expect(page.getByTestId('action_state.detail.transactions')).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(/\/app\/action-states\/123$/);
    await expect(page.getByTestId('action_state.detail')).toBeVisible();
    await expect(page.getByTestId('action_state.detail.transactions.table')).toContainText('Create dataset');
  });
});
