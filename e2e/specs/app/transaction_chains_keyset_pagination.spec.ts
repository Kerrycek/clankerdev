import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Transaction chains keyset pagination', () => {
  const makeChain = (id: number) => ({
    id,
    state: 'done',
    created_at: new Date('2026-01-26T00:00:00.000Z').toISOString(),
    updated_at: new Date('2026-01-26T00:00:00.000Z').toISOString(),
    label: `Chain ${id}`,
    concerns: [],
    action_state_id: null,
    progress: 10,
    size: 10,
  });

  test('Next/Prev uses the last visible row as its cursor', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST_TOKEN',
    });

    const page1 = Array.from({ length: 51 }, (_, i) => 300 - i).map(makeChain);
    const page2 = Array.from({ length: 50 }, (_, i) => 250 - i).map(makeChain);

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET transaction_chains': ({ searchParams }) => {
          expect(searchParams.get('transaction_chain[limit]')).toBe('51');
          const fromId = searchParams.get('transaction_chain[from_id]');
          return { transaction_chains: fromId ? page2 : page1, _meta: { total_count: 100 } };
        },
      },
    });

    await page.goto('/app/transactions');

    await expect(page.getByTestId('transactions.list')).toBeVisible();
    await expect(page.getByTestId('transactions.row.300')).toBeVisible();
    await expect(page.getByTestId('transactions.row.250')).toHaveCount(0);

    await page.getByTestId('transactions.pagination.next').click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('transactions.row.250')).toBeVisible();
    await expect(page.getByTestId('transactions.pagination.next')).toBeDisabled();

    await page.getByTestId('transactions.pagination.prev').click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId('transactions.row.300')).toBeVisible();
  });

  for (const route of ['/app/transactions', '/admin/transactions']) {
    test(`disables Next for an exact-limit terminal page on ${route}`, async ({ page }) => {
      await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_TOKEN' });
      const terminalPage = Array.from({ length: 50 }, (_, i) => makeChain(100 - i));

      await installHaveApiMock(page, {
        user: { id: 1, login: 'test', level: 1 },
        handlers: {
          'GET transaction_chains': ({ searchParams }) => {
            expect(searchParams.get('transaction_chain[limit]')).toBe('51');
            return { transaction_chains: terminalPage };
          },
        },
      });

      await page.goto(route);
      await expect(page.getByTestId('transactions.row.51')).toBeVisible();
      await expect(page.getByTestId('transactions.pagination.next')).toBeDisabled();
    });
  }

  test('merges error states with a global look-ahead row', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_TOKEN' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET transaction_chains': ({ searchParams }) => {
          expect(searchParams.get('transaction_chain[limit]')).toBe('51');
          const state = searchParams.get('transaction_chain[state]');
          const ids = state === 'failed'
            ? Array.from({ length: 26 }, (_, i) => 200 - i * 2)
            : Array.from({ length: 25 }, (_, i) => 199 - i * 2);
          return { transaction_chains: ids.map((id) => ({ ...makeChain(id), state })) };
        },
      },
    });

    await page.goto('/admin/transactions?errors=1');
    await expect(page.getByTestId('transactions.row.200')).toBeVisible();
    await expect(page.getByTestId('transactions.row.151')).toBeVisible();
    await expect(page.getByTestId('transactions.row.150')).toHaveCount(0);
    await expect(page.getByTestId('transactions.pagination.next')).toBeEnabled();
  });
});
