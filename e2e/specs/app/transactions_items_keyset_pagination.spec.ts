import { expect, test, type Page } from '@playwright/test';

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
    user: { id: 7, label: 'alice' },
    vps: { id: 100, label: 'vps100' },
    transaction_chain: { id: 123 },
  };
}

async function expectCanonicalAdminChainListUrl(
  page: Page,
  filters: Record<string, string>
) {
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return {
        pathname: url.pathname,
        params: Object.fromEntries(url.searchParams.entries()),
      };
    })
    .toEqual({
      pathname: '/admin/transactions',
      params: { ...filters, limit: '50', page: '1' },
    });
}

test.describe('Transactions items list keyset pagination', () => {
  test('@pr-smoke @pr-smoke-mobile lookahead keeps an exact terminal page in place without gaps', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const basePath = testInfo.project.name.includes('mobile') ? '/admin' : '/app';
    const allTransactions = Array.from({ length: 100 }, (_, i) => 300 - i).map(makeTx);
    const requests: Array<{ limit: number; fromId: number | null }> = [];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: basePath === '/admin' ? 99 : 1 },
      handlers: {
        'GET transactions': ({ searchParams }) => {
          const limit = Number(searchParams.get('transaction[limit]'));
          const rawFromId = searchParams.get('transaction[from_id]');
          const fromId = rawFromId === null ? null : Number(rawFromId);
          requests.push({ limit, fromId });

          const eligible = fromId === null ? allTransactions : allTransactions.filter((tx) => tx.id < fromId);
          return { transactions: eligible.slice(0, limit), _meta: { total_count: allTransactions.length } };
        },
      },
    });

    await page.goto(`${basePath}/transactions/items`);

    await expect(page.getByTestId('transactions.items.list')).toBeVisible();
    await expect(page.getByTestId('transactions.items.row.300')).toBeVisible();
    await expect(page.getByTestId('transactions.items.row.251')).toBeVisible();
    await expect(page.getByTestId('transactions.items.row.250')).toHaveCount(0);
    await expect(page.getByTestId('transactions.items.row.300')).toHaveAttribute('data-row-variant', 'danger');
    await expect(page.getByTestId('transactions.items.row.299')).toHaveAttribute('data-row-variant', 'ok');
    await expect(page.getByTestId('transactions.items.row.300.dot')).toBeVisible();
    expect(requests[0]).toEqual({ limit: 51, fromId: null });

    await page.getByTestId('transactions.items.pagination.next').click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('transactions.items.row.250')).toBeVisible();
    await expect(page.getByTestId('transactions.items.row.201')).toBeVisible();
    await expect(page.getByTestId('transactions.items.row.250')).toHaveAttribute('data-row-variant', 'danger');
    await expect(page.getByTestId('transactions.items.pagination.next')).toBeDisabled();
    expect(requests.at(-1)).toEqual({ limit: 51, fromId: 251 });

    await page.getByTestId('transactions.items.pagination.prev').click();
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page).toHaveURL(/page=1/);
    await expect(page.getByTestId('transactions.items.row.300')).toBeVisible();
  });

  test('rejects free text, applies a supported node filter and can clear it', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET transactions': ({ searchParams }) => {
          const node = searchParams.get('transaction[node]');
          if (node === '999') return { transactions: [], _meta: { total_count: 0 } };
          return { transactions: [makeTx(300), makeTx(299)], _meta: { total_count: 2 } };
        },
      },
    });

    await page.goto('/app/transactions/items');

    await expect(page.getByTestId('transactions.items.row.300')).toBeVisible();

    await page.getByTestId('transactions.items.smart_filter.input').fill('no-match');
    await page.getByTestId('transactions.items.smart_filter.input').press('Enter');
    await expect(page).not.toHaveURL(/(?:\?|&)q=/);
    await expect(page.getByTestId('toast.viewport')).toContainText(/exact (?:transaction )?filter|přesný filtr/i);
    await expect(page.getByTestId('transactions.items.row.300')).toBeVisible();

    await page.getByTestId('transactions.items.smart_filter.input').fill('node:999');
    await page.getByTestId('transactions.items.smart_filter.input').press('Enter');

    await expect(page).toHaveURL(/node=999/);
    await expect(page.getByTestId('transactions.items.empty')).toBeVisible();
    await page.getByTestId('transactions.items.empty.action').click();

    await expect(page.getByTestId('transactions.items.smart_filter.input')).toHaveValue('');
    await expect(page.getByTestId('transactions.items.row.300')).toBeVisible();
  });

  test('direct reload preserves item list filters and admin-scoped links', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: {
        'GET transactions': ({ searchParams }) => {
          if (searchParams.get('transaction[transaction_chain]') !== '123') return { transactions: [], _meta: { total_count: 0 } };
          return { transactions: [makeTx(300)], _meta: { total_count: 1 } };
        },
      },
    });

    await page.goto('/admin/transactions/items?transaction_chain=123');
    await expect(page.getByTestId('transactions.items.row.300')).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(/\/admin\/transactions\/items\?.*transaction_chain=123/);
    await expect(page.getByTestId('transactions.items.row.300')).toBeVisible();
    await expect(page.locator('a[href="/admin/transactions/items/300"]')).toHaveCount(2);
    await expect(page.locator('a[href="/admin/transactions/123"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/transactions?user=7"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/transactions?class_name=Vps&row_id=100"]')).toBeVisible();
    await page.getByTestId('transactions.items.advanced.open').click();
    await expect(page.getByTestId('transactions.items.advanced.drawer')).toBeVisible();
    await expect(page.getByTestId('transactions.items.advanced.chain')).toBeVisible();
    await expect(page.getByTestId('transactions.items.advanced.node')).toBeVisible();
    await expect(page.getByTestId('transactions.items.advanced.type')).toBeVisible();
    await expect(page.getByTestId('transactions.items.advanced.done')).toBeVisible();
    await expect(page.getByTestId('transactions.items.advanced.success')).toBeVisible();
    await expect(page.getByTestId('transactions.items.advanced.q')).toHaveCount(0);
    await expect(page.getByTestId('transactions.items.advanced.vps')).toHaveCount(0);
    await expect(page.getByTestId('transactions.items.advanced.user')).toHaveCount(0);
    await expect(page.locator('a[href="/app/transactions/items/300"]')).toHaveCount(0);
  });

  test('normalizes stale q before requesting items', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const itemRequests: string[] = [];
    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET transactions': ({ searchParams }) => {
          itemRequests.push(searchParams.toString());
          return { transactions: [makeTx(300)], _meta: { total_count: 1 } };
        },
      },
    });

    await page.goto('/app/transactions/items?q=mount&from_id=99&page=2');

    await expect(page).not.toHaveURL(/(?:\?|&)q=/);
    await expect(page).not.toHaveURL(/(?:\?|&)from_id=/);
    await expect(page).not.toHaveURL(/(?:\?|&)page=2(?:&|$)/);
    await expect(page.getByTestId('toast.viewport')).toContainText(/unsupported|nepodporovan/i);
    await expect(page.getByTestId('transactions.items.row.300')).toBeVisible();
    expect(itemRequests).toHaveLength(1);
    expect(itemRequests[0]).not.toContain('transaction%5Bq%5D');
  });

  test('redirects stale VPS and admin user item filters to supported chain filters', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let itemRequests = 0;
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: {
        'GET transactions': () => {
          itemRequests += 1;
          return { transactions: [] };
        },
        'GET transaction_chains': () => ({ transaction_chains: [] }),
      },
    });

    await page.goto('/admin/transactions/items?vps=100');
    await expectCanonicalAdminChainListUrl(page, { class_name: 'Vps', row_id: '100' });

    await page.goto('/admin/transactions/items?user=7');
    await expectCanonicalAdminChainListUrl(page, { user: '7' });
    expect(itemRequests).toBe(0);
  });

  test('keeps an administrator My view out of the unscoped item index', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let itemRequests = 0;
    const chainUserFilters: Array<string | null> = [];
    await installHaveApiMock(page, {
      user: { id: 7, login: 'admin', level: 99 },
      handlers: {
        'GET transactions': () => {
          itemRequests += 1;
          return { transactions: [] };
        },
        'GET transaction_chains': ({ searchParams }) => {
          chainUserFilters.push(searchParams.get('transaction_chain[user]'));
          return { transaction_chains: [] };
        },
      },
    });

    await page.goto('/app/transactions/items?node=5');

    await expect(page).toHaveURL(/\/app\/transactions(?:\?|$)/);
    await expect(page.getByTestId('toast.viewport')).toContainText(/choose a transaction chain|vyber řetězec transakcí/i);
    await expect.poll(() => chainUserFilters.includes('7')).toBe(true);
    await expect(page.locator('a[href="/app/transactions/items"]')).toHaveCount(0);
    expect(itemRequests).toBe(0);
  });

  test('keeps the server-scoped item index available to support accounts', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let itemRequests = 0;
    await installHaveApiMock(page, {
      user: { id: 7, login: 'support', level: 50 },
      handlers: {
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET transactions': () => {
          itemRequests += 1;
          return { transactions: [], _meta: { total_count: 0 } };
        },
      },
    });

    await page.goto('/app/transactions');

    const itemsLink = page.locator('a[href="/app/transactions/items"]');
    await expect(itemsLink).toBeVisible();
    await itemsLink.click();
    await expect(page).toHaveURL(/\/app\/transactions\/items$/);
    await expect(page.getByTestId('transactions.items.empty')).toBeVisible();
    expect(itemRequests).toBe(1);
  });
});
