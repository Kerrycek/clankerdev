import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

function makeTx(id: number) {
  return {
    id,
    name: `Tx ${id}`,
    done: 'done',
    success: id % 2,
    priority: 0,
    urgent: false,
    type: 2,
    created_at: new Date('2026-01-26T00:00:00.000Z').toISOString(),
    started_at: new Date('2026-01-26T00:00:10.000Z').toISOString(),
    finished_at: new Date('2026-01-26T00:00:20.000Z').toISOString(),
    node: { id: 1, label: 'node1' },
    vps: { id: 100, label: 'vps100' },
    transaction_chain: { id: 123 },
  };
}

test.describe('Transactions items list keyset pagination', () => {
  test('Next/Prev updates URL and data', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const page1 = Array.from({ length: 50 }, (_, i) => 300 - i).map(makeTx);
    const page2 = Array.from({ length: 50 }, (_, i) => 250 - i).map(makeTx);

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET transactions': ({ searchParams }) => {
          const fromId = searchParams.get('transaction[from_id]');
          return { transactions: fromId ? page2 : page1, _meta: { total_count: 100 } };
        },
      },
    });

    await page.goto('/app/transactions/items');

    await expect(page.getByTestId('transactions.items.list')).toBeVisible();
    await expect(page.getByTestId('transactions.items.row.300')).toBeVisible();
    await expect(page.getByTestId('transactions.items.row.300')).toHaveAttribute('data-row-variant', 'danger');
    await expect(page.getByTestId('transactions.items.row.299')).toHaveAttribute('data-row-variant', 'ok');
    await expect(page.getByTestId('transactions.items.row.300.dot')).toBeVisible();

    await page.getByTestId('transactions.items.pagination.next').click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('transactions.items.row.250')).toBeVisible();
    await expect(page.getByTestId('transactions.items.row.250')).toHaveAttribute('data-row-variant', 'danger');

    await page.getByTestId('transactions.items.pagination.prev').click();
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page).toHaveURL(/page=1/);
    await expect(page.getByTestId('transactions.items.row.300')).toBeVisible();
  });

  test('EmptyState appears for query filter and can clear filters', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET transactions': ({ searchParams }) => {
          const q = (searchParams.get('transaction[q]') ?? '').toLowerCase();
          if (q.includes('no-match')) return { transactions: [], _meta: { total_count: 0 } };
          return { transactions: [makeTx(300), makeTx(299)], _meta: { total_count: 2 } };
        },
      },
    });

    await page.goto('/app/transactions/items');

    await expect(page.getByTestId('transactions.items.row.300')).toBeVisible();

    await page.getByTestId('transactions.items.smart_filter.input').fill('no-match');
    await page.getByTestId('transactions.items.smart_filter.input').press('Enter');

    await expect(page.getByTestId('transactions.items.empty')).toBeVisible();
    await page.getByTestId('transactions.items.empty.action').click();

    await expect(page.getByTestId('transactions.items.smart_filter.input')).toHaveValue('');
    await expect(page.getByTestId('transactions.items.row.300')).toBeVisible();
  });
});
