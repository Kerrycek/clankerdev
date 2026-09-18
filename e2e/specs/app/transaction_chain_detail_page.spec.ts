import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import {
  expectNoDocumentHorizontalOverflow,
  expectTableHorizontalScrollUsable,
} from '../../helpers/horizontalOverflow';

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
    concerns: {
      type: 'affect',
      objects: [
        ['Vps', 100],
        ['Dataset', 200],
        ['DnsZone', 300],
        ['Node', 2],
        ['UnknownConcern', 404],
        ['Vps', '999'],
        ['Vps', -1],
        ['Vps', 998, 'unexpected-third-item'],
        { class_name: 'Vps', row_id: 997 },
      ],
      labels: {
        Vps: 'VPS',
        Dataset: 'Dataset',
        DnsZone: 'DNS zone',
        Node: 'Node',
        UnknownConcern: 'Unknown object',
      },
    },
  }),
  'GET transaction_chains/124': () => ({
    id: 124,
    state: 'done',
    label: 'Done chain',
    progress: 2,
    size: 2,
    created_at: '2026-02-02T09:00:00Z',
    updated_at: '2026-02-02T09:02:00Z',
    action_state: { id: 556, label: 'Done action' },
    concerns: { type: 'affect', objects: [['Vps', 101]], labels: { Vps: 'VPS' } },
  }),
  'GET transaction_chains/125': () => ({
    id: 125,
    state: 'running',
    label: 'Running chain',
    progress: 1,
    size: 3,
    created_at: '2026-02-02T10:00:00Z',
    updated_at: '2026-02-02T10:02:00Z',
    action_state: { id: 557, label: 'Running action' },
    concerns: { type: 'affect', objects: [['Vps', 102]], labels: { Vps: 'VPS' } },
  }),
  'GET transactions': ({ searchParams }: { searchParams: URLSearchParams }) => {
    const chainId = searchParams.get('transaction[transaction_chain]');
    if (chainId === '124') {
      return [
        {
          id: 801,
          name: 'Prepare VPS',
          done: 'done',
          success: 1,
          priority: 10,
          type: 1,
          created_at: '2026-02-02T09:00:10Z',
          started_at: '2026-02-02T09:00:15Z',
          finished_at: '2026-02-02T09:01:00Z',
          node: { id: 2, label: 'node2' },
          vps: { id: 101, label: 'vps101' },
          transaction_chain: { id: 124 },
          input: { action: 'prepare' },
          output: { ok: true },
        },
        {
          id: 802,
          name: 'Start VPS',
          done: 'done',
          success: 1,
          priority: 20,
          type: 2,
          created_at: '2026-02-02T09:01:00Z',
          started_at: '2026-02-02T09:01:05Z',
          finished_at: '2026-02-02T09:02:00Z',
          node: { id: 2, label: 'node2' },
          vps: { id: 101, label: 'vps101' },
          transaction_chain: { id: 124 },
          input: { action: 'start' },
          output: { ok: true, stdout: 'booted' },
        },
      ];
    }
    if (chainId === '125') {
      return [
        {
          id: 901,
          name: 'Create dataset',
          done: 'done',
          success: 1,
          created_at: '2026-02-02T10:00:10Z',
          started_at: '2026-02-02T10:00:15Z',
          finished_at: '2026-02-02T10:01:00Z',
          node: { id: 3, label: 'node3' },
          vps: { id: 102, label: 'vps102' },
          transaction_chain: { id: 125 },
        },
        {
          id: 902,
          name: 'Configure network',
          done: 'running',
          success: 1,
          progress: 35,
          created_at: '2026-02-02T10:01:00Z',
          started_at: '2026-02-02T10:01:10Z',
          finished_at: null,
          node: { id: 3, label: 'node3' },
          vps: { id: 102, label: 'vps102' },
          transaction_chain: { id: 125 },
          stdout: 'creating veth',
        },
        {
          id: 903,
          name: 'Start services',
          done: 'waiting',
          success: 1,
          created_at: '2026-02-02T10:02:00Z',
          started_at: null,
          finished_at: null,
          node: { id: 3, label: 'node3' },
          vps: { id: 102, label: 'vps102' },
          transaction_chain: { id: 125 },
          depends_on: [902],
        },
      ];
    }
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
        output: { ok: false, error: 'step failed on node2' },
        result: { rollback_needed: true },
        stderr: 'mount: permission denied',
      },
    ];
  },
};

test.describe('@pr-smoke TransactionChainDetailPage', () => {
  test('@pr-smoke-mobile renders chain and transaction list', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_TOKEN' });
    await installHaveApiMock(page, { handlers });

    await page.goto('/app/transactions/123');

    await expect(page.getByTestId('transactions.chain.detail')).toBeVisible();
    await expect(page.getByTestId('transactions.chain.detail.header')).toBeVisible();
    await expect(page.getByTestId('transactions.chain.detail.info')).toBeVisible();

    const concerns = page.getByTestId('transactions.chain.detail.concerns');
    await expect(concerns).toContainText('VPS #100');
    await expect(concerns).toContainText('Dataset #200');
    await expect(concerns).toContainText('DNS zone #300');
    await expect(concerns).toContainText('Node #2');
    await expect(concerns).toContainText('Unknown object #404');
    await expect(concerns).not.toContainText('#999');
    await expect(concerns).not.toContainText('#998');
    await expect(concerns).not.toContainText('#997');
    await expect(page.getByTestId('transactions.chain.detail.concern.0.open')).toHaveAttribute('href', '/app/vps/100');
    await expect(page.getByTestId('transactions.chain.detail.concern.1.open')).toHaveAttribute('href', '/app/datasets/200');
    await expect(page.getByTestId('transactions.chain.detail.concern.2.open')).toHaveAttribute('href', '/app/dns/zones/300');
    await expect(page.getByTestId('transactions.chain.detail.concern.3.open')).toHaveCount(0);
    await expect(page.getByTestId('transactions.chain.detail.concern.4.open')).toHaveCount(0);
    await expect(concerns.locator('a[href^="/admin"]')).toHaveCount(0);

    await expect(page.getByTestId('transactions.chain.detail.tx.701')).toBeVisible();
    await expect(page.getByTestId('transactions.chain.detail.tx.702')).toBeVisible();
    await expect(page.getByTestId('transactions.chain.detail.tx.open.702')).toBeVisible();

    // RowTone Full: every transaction row has an explicit variant.
    await expect(page.getByTestId('transactions.chain.detail.tx.701')).toHaveAttribute('data-row-variant', 'warn');
    await expect(page.getByTestId('transactions.chain.detail.tx.702')).toHaveAttribute('data-row-variant', 'danger');

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoDocumentHorizontalOverflow(page);
    await expectTableHorizontalScrollUsable(page, 'transactions.chain.detail.transactions.table');

    await page.getByTestId('transactions.chain.detail.tx.toggle.702').click();
    await expect(page.getByTestId('transactions.chain.detail.tx.expanded.702')).toBeVisible();
    await expect(page.getByTestId('transactions.chain.detail.tx.expanded.702')).toContainText('step failed on node2');
    await expect(page.getByTestId('transactions.chain.detail.tx.expanded.702')).toContainText('mount: permission denied');
    await expect(page.getByTestId('transactions.chain.detail.tx.expanded.702')).toContainText('"a": 1');
    await expect(page.getByTestId('transactions.chain.detail.tx.expanded.702')).toContainText('"ok": false');
    await expect(page.getByTestId('transactions.chain.detail.tx.expanded.702')).toContainText('rollback_needed');
    await expectNoDocumentHorizontalOverflow(page);
    await page.setViewportSize({ width: 1280, height: 844 });

    await page.getByRole('button', { name: /collapse all|sbalit vše/i }).click();
    await expect(page.getByTestId('transactions.chain.detail.tx.expanded.702')).toBeHidden();
    await page.getByRole('button', { name: /expand all|rozbalit vše/i }).click();
    await expect(page.getByTestId('transactions.chain.detail.tx.expanded.702')).toBeVisible();

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

  test('renders done chain with multiple expandable transactions at narrow desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 720 });
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_TOKEN' });
    await installHaveApiMock(page, { handlers });

    await page.goto('/app/transactions/124');

    await expect(page.getByTestId('transactions.chain.detail')).toBeVisible();
    await expect(page.getByTestId('transactions.chain.detail.info')).toContainText('100%');
    await expect(page.getByTestId('transactions.chain.detail.tx.801')).toBeVisible();
    await expect(page.getByTestId('transactions.chain.detail.tx.802')).toBeVisible();

    await page.getByRole('button', { name: /expand all|rozbalit vše/i }).click();
    await expect(page.getByTestId('transactions.chain.detail.tx.expanded.801')).toContainText('"action": "prepare"');
    await expect(page.getByTestId('transactions.chain.detail.tx.expanded.802')).toContainText('booted');
  });

  test('renders running chain progress and current step', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_TOKEN' });
    await installHaveApiMock(page, { handlers });

    await page.goto('/app/transactions/125');

    await expect(page.getByTestId('transactions.chain.detail.info')).toContainText('1/3 · 33%');
    await expect(page.getByTestId('transactions.chain.detail.tx.902')).toContainText(/current step|aktuální krok/i);

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoDocumentHorizontalOverflow(page);
    await expectTableHorizontalScrollUsable(page, 'transactions.chain.detail.transactions.table');

    await page.getByTestId('transactions.chain.detail.tx.toggle.902').click();
    await expect(page.getByTestId('transactions.chain.detail.tx.expanded.902')).toContainText('creating veth');
    await expectNoDocumentHorizontalOverflow(page);
  });

  test('@pr-smoke-mobile renders admin route with admin-scoped links', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_TOKEN' });
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers,
    });

    await page.goto('/admin/transactions/123');

    await expect(page.getByTestId('transactions.chain.detail')).toBeVisible();
    await expect(page.getByTestId('transactions.chain.detail.open_items')).toHaveAttribute(
      'href',
      '/admin/transactions/items?transaction_chain=123'
    );
    await expect(page.getByTestId('transactions.chain.detail.tx.open.702')).toHaveAttribute(
      'href',
      '/admin/transactions/items/702'
    );
    await expect(page.getByTestId('transactions.chain.detail.concern.0.open')).toHaveAttribute('href', '/admin/vps/100');
    await expect(page.getByTestId('transactions.chain.detail.concern.1.open')).toHaveAttribute('href', '/admin/datasets/200');
    await expect(page.getByTestId('transactions.chain.detail.concern.2.open')).toHaveAttribute('href', '/admin/dns/zones/300');
    await expect(page.getByTestId('transactions.chain.detail.concern.3.open')).toHaveAttribute('href', '/admin/nodes/2');
    await expect(page.getByTestId('transactions.chain.detail.concern.4.open')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoDocumentHorizontalOverflow(page);
    await expectTableHorizontalScrollUsable(page, 'transactions.chain.detail.transactions.table');
  });

  test('deep reload keeps chain detail route and transaction table visible', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_TOKEN' });
    await installHaveApiMock(page, { handlers });

    await page.goto('/app/transactions/123');
    await expect(page.getByTestId('transactions.chain.detail.tx.702')).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(/\/app\/transactions\/123$/);
    await expect(page.getByTestId('transactions.chain.detail')).toBeVisible();
    await expect(page.getByTestId('transactions.chain.detail.tx.702')).toBeVisible();
  });
});
