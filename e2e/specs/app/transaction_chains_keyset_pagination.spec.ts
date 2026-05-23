import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Transaction chains keyset pagination', () => {
  test('Next/Prev updates URL and data', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST_TOKEN',
    });

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

    const page1 = Array.from({ length: 50 }, (_, i) => 300 - i).map(makeChain);
    const page2 = Array.from({ length: 50 }, (_, i) => 250 - i).map(makeChain);

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET transaction_chains': ({ searchParams }) => {
          const fromId = searchParams.get('transaction_chain[from_id]');
          return { transaction_chains: fromId ? page2 : page1, _meta: { total_count: 100 } };
        },
      },
    });

    await page.goto('/app/transactions');

    await expect(page.getByTestId('transactions.list')).toBeVisible();
    await expect(page.getByTestId('transactions.row.300')).toBeVisible();

    await page.getByTestId('transactions.pagination.next').click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('transactions.row.250')).toBeVisible();

    await page.getByTestId('transactions.pagination.prev').click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId('transactions.row.300')).toBeVisible();
  });
});
