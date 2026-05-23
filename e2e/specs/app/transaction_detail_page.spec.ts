import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const handlers = {
  'GET transactions/702': () => ({
    id: 702,
    name: 'Step 2',
    done: 'done',
    success: 0,
    priority: 20,
    urgent: true,
    type: 2,
    created_at: '2026-02-02T08:01:00Z',
    started_at: '2026-02-02T08:01:10Z',
    finished_at: '2026-02-02T08:02:40Z',
    node: { id: 2, label: 'node2' },
    vps: { id: 100, label: 'vps100' },
    transaction_chain: { id: 123 },
    depends_on: [701],
    input: { a: 1 },
    output: { ok: false },
  }),
};

test.describe('TransactionDetailPage', () => {
  test('renders transaction details', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_TOKEN' });
    await installHaveApiMock(page, { handlers });

    await page.goto('/app/transactions/items/702');

    await expect(page.getByTestId('transactions.items.detail')).toBeVisible();
    await expect(page.getByTestId('transactions.items.detail.header')).toBeVisible();
    await expect(page.getByTestId('transactions.items.detail.info')).toBeVisible();
    await expect(page.getByTestId('transactions.items.detail.payload')).toBeVisible();
    await expect(page.getByTestId('transactions.items.detail.raw')).toBeVisible();
    await expect(page.getByTestId('transactions.items.detail.raw.json')).toBeVisible();

    await expect(page.getByTestId('transactions.items.detail.open_chain')).toHaveAttribute('href', '/app/transactions/123');
  });
});
