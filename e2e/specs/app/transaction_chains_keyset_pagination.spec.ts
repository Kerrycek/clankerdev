import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, type HaveApiHandler } from '../../fixtures';

function makeChain(id: number, state = 'done') {
  return {
    id,
    state,
    created_at: new Date('2026-01-26T00:00:00.000Z').toISOString(),
    updated_at: new Date('2026-01-26T00:00:00.000Z').toISOString(),
    label: `Chain ${id}`,
    concerns: [],
    action_state_id: null,
    progress: 10,
    size: 10,
  };
}

async function bootstrap(page: Page, handlers: Record<string, HaveApiHandler>, userLevel = 100) {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_TOKEN' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'test', level: userLevel },
    handlers,
  });
}

test.describe('Transaction chains keyset pagination', () => {
  for (const { label, path, level } of [
    { label: 'user', path: '/app/transactions', level: 1 },
    { label: 'admin', path: '/admin/transactions', level: 100 },
  ]) {
    test(`@pr-smoke @pr-smoke-mobile ${label} view disables Next on an exact terminal page`, async ({ page }) => {
      const requestedLimits: string[] = [];
      const terminalPage = Array.from({ length: 50 }, (_, i) => 300 - i).map((id) => makeChain(id));

      await bootstrap(page, {
        'GET transaction_chains': ({ searchParams }) => {
          if (searchParams.has('transaction_chain[state]')) return { transaction_chains: [] };
          const limit = searchParams.get('transaction_chain[limit]') ?? '';
          requestedLimits.push(limit);
          if (limit !== '51') return { transaction_chains: [] };
          return { transaction_chains: terminalPage };
        },
      }, level);

      await page.goto(path);

      await expect(page.getByTestId('transactions.list')).toBeVisible();
      await expect(page.getByTestId('transactions.row.300')).toBeVisible();
      await expect(page.getByTestId('transactions.row.251')).toBeVisible();
      await expect(page.getByTestId('transactions.pagination.next')).toBeDisabled();
      await expect.poll(() => requestedLimits).toContain('51');
      await expect(page.getByTestId(/^transactions\.row\.\d+$/)).toHaveCount(50);
    });
  }

  test('@pr-smoke @pr-smoke-mobile Next uses a hidden look-ahead row and keeps cursor continuity', async ({ page }) => {
    const allChains = Array.from({ length: 100 }, (_, i) => 300 - i).map((id) => makeChain(id));
    const cursors: string[] = [];

    await bootstrap(page, {
      'GET transaction_chains': ({ searchParams }) => {
        if (searchParams.has('transaction_chain[state]')) return { transaction_chains: [] };
        if (searchParams.get('transaction_chain[limit]') !== '51') return { transaction_chains: [] };
        const fromId = searchParams.get('transaction_chain[from_id]');
        cursors.push(fromId ?? 'first');
        const boundary = fromId ? Number(fromId) : Number.POSITIVE_INFINITY;
        return { transaction_chains: allChains.filter((chain) => chain.id < boundary).slice(0, 51) };
      },
    }, 1);

    await page.goto('/app/transactions');

    await expect(page.getByTestId('transactions.row.300')).toBeVisible();
    await expect(page.getByTestId('transactions.row.251')).toBeVisible();
    await expect(page.getByTestId('transactions.row.250')).toHaveCount(0);
    await expect(page.getByTestId(/^transactions\.row\.\d+$/)).toHaveCount(50);
    await expect(page.getByTestId('transactions.pagination.next')).toBeEnabled();

    await page.getByTestId('transactions.pagination.next').click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('transactions.row.250')).toBeVisible();
    await expect(page.getByTestId('transactions.row.201')).toBeVisible();
    await expect(page.getByTestId('transactions.pagination.next')).toBeDisabled();
    await expect.poll(() => cursors).toContain('251');

    await page.getByTestId('transactions.pagination.prev').click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId('transactions.row.300')).toBeVisible();
  });

  test('@pr-smoke @pr-smoke-mobile error view merges both look-ahead streams before deciding Next', async ({ page }) => {
    const failed = Array.from({ length: 26 }, (_, i) => 400 - i * 2).map((id) => makeChain(id, 'failed'));
    const fatal = Array.from({ length: 26 }, (_, i) => 399 - i * 2).map((id) => makeChain(id, 'fatal'));
    const requestedStates = new Set<string>();

    await bootstrap(page, {
      'GET transaction_chains': ({ searchParams }) => {
        const state = searchParams.get('transaction_chain[state]');
        if (state !== 'failed' && state !== 'fatal') return { transaction_chains: [] };
        expect(searchParams.get('transaction_chain[limit]')).toBe('26');
        requestedStates.add(state);
        const fromId = Number(searchParams.get('transaction_chain[from_id]') ?? Number.POSITIVE_INFINITY);
        const source = state === 'failed' ? failed : fatal;
        return { transaction_chains: source.filter((chain) => chain.id < fromId).slice(0, 26) };
      },
    });

    await page.goto('/admin/transactions?errors=1&limit=25');

    await expect(page.getByTestId('transactions.row.400')).toBeVisible();
    await expect(page.getByTestId('transactions.row.376')).toBeVisible();
    await expect(page.getByTestId('transactions.row.375')).toHaveCount(0);
    await expect(page.getByTestId(/^transactions\.row\.\d+$/)).toHaveCount(25);
    await expect(page.getByTestId('transactions.pagination.next')).toBeEnabled();
    await expect.poll(() => [...requestedStates].sort()).toEqual(['failed', 'fatal']);

    await page.getByTestId('transactions.pagination.next').click();
    await expect(page).toHaveURL(/from_id=376/);
    await expect(page.getByTestId('transactions.row.375')).toBeVisible();
    await expect(page.getByTestId('transactions.row.351')).toBeVisible();
    await expect(page.getByTestId('transactions.row.350')).toHaveCount(0);
    await expect(page.getByTestId('transactions.pagination.next')).toBeEnabled();

    await page.getByTestId('transactions.pagination.next').click();
    await expect(page).toHaveURL(/from_id=351/);
    await expect(page.getByTestId('transactions.row.350')).toBeVisible();
    await expect(page.getByTestId('transactions.row.349')).toBeVisible();
    await expect(page.getByTestId('transactions.pagination.next')).toBeDisabled();
  });

  test('@pr-smoke @pr-smoke-mobile an exact terminal error union disables Next', async ({ page }) => {
    const failed = Array.from({ length: 13 }, (_, i) => 300 - i * 2).map((id) => makeChain(id, 'failed'));
    const fatal = Array.from({ length: 12 }, (_, i) => 299 - i * 2).map((id) => makeChain(id, 'fatal'));

    await bootstrap(page, {
      'GET transaction_chains': ({ searchParams }) => {
        const state = searchParams.get('transaction_chain[state]');
        if (state !== 'failed' && state !== 'fatal') return { transaction_chains: [] };
        expect(searchParams.get('transaction_chain[limit]')).toBe('26');
        return { transaction_chains: state === 'failed' ? failed : fatal };
      },
    });

    await page.goto('/admin/transactions?errors=1&limit=25');

    await expect(page.getByTestId('transactions.row.300')).toBeVisible();
    await expect(page.getByTestId('transactions.row.277')).toBeVisible();
    await expect(page.getByTestId(/^transactions\.row\.\d+$/)).toHaveCount(25);
    await expect(page.getByTestId('transactions.pagination.next')).toBeDisabled();
  });

  test('@pr-smoke @pr-smoke-mobile pinned chains stay outside the page boundary', async ({ page }) => {
    const terminalPage = Array.from({ length: 50 }, (_, i) => 300 - i).map((id) => makeChain(id));

    await page.addInitScript(() => {
      window.localStorage.setItem('webui-next.pinned_transaction_chains.user-1', JSON.stringify([999]));
    });
    await bootstrap(page, {
      'GET transaction_chains': ({ searchParams }) => {
        if (searchParams.has('transaction_chain[state]')) return { transaction_chains: [] };
        if (searchParams.get('transaction_chain[limit]') !== '51') return { transaction_chains: [] };
        return { transaction_chains: terminalPage };
      },
      'GET transaction_chains/999': () => ({ transaction_chain: makeChain(999) }),
    }, 1);

    await page.goto('/app/transactions');

    await expect(page.getByTestId('transactions.row.999')).toBeVisible();
    await expect(page.getByTestId('transactions.row.300')).toBeVisible();
    await expect(page.getByTestId('transactions.row.251')).toBeVisible();
    await expect(page.getByTestId(/^transactions\.row\.\d+$/)).toHaveCount(51);
    await expect(page.getByTestId('transactions.pagination.next')).toBeDisabled();
  });
});
