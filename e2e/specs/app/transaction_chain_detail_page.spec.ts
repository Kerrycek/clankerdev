import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const handlers = {
  'GET transaction_chains/123': () => ({
    id: 123,
    state: 'queued',
    label: 'Demo chain',
    progress: 1,
    size: 2,
    created_at: '2026-02-02T08:00:00Z',
    updated_at: '2026-02-02T08:02:00Z',
    action_state: { id: 555, label: 'Action #555' },
    concerns: [
      { class_name: 'Vps', row_id: 100, label: 'vps100', type: 'direct' },
      { class_name: 'Node', row_id: 2, label: 'node2', type: 'direct' },
    ],
  }),
  'GET transactions': ({ searchParams }: { searchParams: URLSearchParams }) => {
    const chainId = searchParams.get('transaction[transaction_chain]');
    if (chainId !== '123') return [];

    return [
      {
        id: 701,
        name: 'Step 1',
        done: 'waiting',
        success: 0,
        priority: 10,
        urgent: false,
        type: 1,
        created_at: '2026-02-02T08:00:10Z',
        started_at: null,
        finished_at: null,
        node: { id: 2, label: 'node2' },
        vps: { id: 100, label: 'vps100' },
        transaction_chain: { id: 123 },
        depends_on: [],
      },
      {
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
      },
    ];
  },
};

test.describe('@pr-smoke TransactionChainDetailPage', () => {
  test('renders chain and transaction list', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_TOKEN' });
    await installHaveApiMock(page, { handlers });

    await page.goto('/app/transactions/123');

    await expect(page.getByTestId('transactions.chain.detail')).toBeVisible();
    await expect(page.getByTestId('transactions.chain.detail.header')).toBeVisible();
    await expect(page.getByTestId('transactions.chain.detail.info')).toBeVisible();

    await expect(page.getByTestId('transactions.chain.detail.tx.701')).toBeVisible();
    await expect(page.getByTestId('transactions.chain.detail.tx.702')).toBeVisible();
    await expect(page.getByTestId('transactions.chain.detail.tx.open.702')).toBeVisible();

    // RowTone Full: every transaction row has an explicit variant.
    await expect(page.getByTestId('transactions.chain.detail.tx.701')).toHaveAttribute('data-row-variant', 'warn');
    await expect(page.getByTestId('transactions.chain.detail.tx.702')).toHaveAttribute('data-row-variant', 'danger');

    // Header action should link to items list filtered by this chain.
    await expect(page.getByTestId('transactions.chain.detail.open_items')).toHaveAttribute(
      'href',
      '/app/transactions/items?transaction_chain=123'
    );

    // Pin toggle should update aria-label.
    const pin = page.getByTestId('transactions.chain.detail.pin');
    await expect(pin).toHaveAttribute('aria-label', /Pin transaction chain/i);
    await pin.click();
    await expect(pin).toHaveAttribute('aria-label', /Unpin transaction chain/i);
  });
});
