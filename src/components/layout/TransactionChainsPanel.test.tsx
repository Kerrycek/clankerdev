import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { fetchTransactionChain, fetchTransactionChains, fetchTransactions } from '../../lib/api/transactions';
import type { ObjectScopeValue } from '../../app/objectScope';
import { TransactionChainsPanel } from './TransactionChainsPanel';

const objectScopeMock = vi.hoisted(() => ({
  value: { scope: 'mine', mineUserId: 1, canSwitchScope: true } as ObjectScopeValue,
}));

vi.mock('../../app/appMode', () => ({
  useAppMode: () => ({ basePath: '/app' }),
}));

vi.mock('../../app/objectScope', () => ({
  useObjectScope: () => objectScopeMock.value,
}));

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const dict: Record<string, string> = {
        'common.collapse': 'Collapse',
        'common.expand': 'Expand',
        'common.loading': 'Loading',
        'nav.transactions': 'Transactions',
        'tasks.action.hide_items': 'Hide',
        'tasks.action.items': 'Items',
        'tasks.action.view_all': 'View all',
        'tasks.empty.no_chains': 'No recent transaction chains.',
        'tasks.empty.no_chains_filtered': 'No transaction chains match the current filter.',
        'tasks.empty.no_items': 'No recent transactions.',
        'tasks.error.load_chains': 'Failed to load transaction chains',
        'tasks.error.load_items': 'Failed to load transactions',
        'tasks.inspect.collapse_all': 'Collapse all',
        'tasks.inspect.expand_all': 'Expand all',
        'tasks.inspect.transactions': 'Transaction items',
        'tasks.meta.created': `created ${String(vars?.['time'] ?? '')}`,
        'tasks.meta.progress': `Progress: ${String(vars?.['progress'] ?? '')}`,
        'tasks.section.active': 'Active',
        'tasks.section.failed': 'Failed',
        'tasks.section.pinned': 'Pinned',
        'tasks.section.recent': 'Recent',
        'transactions.items.row.type_chip': `type ${String(vars?.['type'] ?? '')}`,
        'transactions.tx.input': 'Input',
        'transactions.tx.no_payload': 'No input/output payload recorded.',
        'transactions.tx.output': 'Output',
        'transactions.tx.prio': `prio ${String(vars?.['prio'] ?? '')}`,
        'transactions.tx.vps': `VPS ${String(vars?.['id'] ?? '')}`,
      };
      return dict[key] ?? key;
    },
  }),
}));

vi.mock('../../lib/refreshTiers', () => ({
  useTierAIntervalMs: () => false,
}));

vi.mock('../../lib/api/transactions', () => ({
  fetchTransactionChain: vi.fn(),
  fetchTransactionChains: vi.fn(),
  fetchTransactions: vi.fn(),
}));

function renderPanel() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <TransactionChainsPanel />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('TransactionChainsPanel', () => {
  beforeEach(() => {
    objectScopeMock.value = { scope: 'mine', mineUserId: 1, canSwitchScope: true };

    vi.mocked(fetchTransactionChain).mockReset();
    vi.mocked(fetchTransactionChains).mockReset();
    vi.mocked(fetchTransactions).mockReset();

    vi.mocked(fetchTransactionChain).mockResolvedValue({
      data: { id: 75, label: 'Create', state: 'queued', size: 2, progress: 1 },
    } as any);

    vi.mocked(fetchTransactionChains).mockResolvedValue({
      data: [
        {
          id: 75,
          label: 'Create',
          state: 'queued',
          size: 2,
          progress: 1,
          created_at: '2026-05-30T18:00:00Z',
        },
      ],
    } as any);

    vi.mocked(fetchTransactions).mockResolvedValue({
      data: [
        {
          id: 7001,
          name: 'CreateVps',
          type: 3001,
          priority: 0,
          success: 1,
          done: 'done',
          created_at: '2026-05-30T18:00:01Z',
          started_at: '2026-05-30T18:00:02Z',
          finished_at: '2026-05-30T18:00:04Z',
          vps: { id: 16 },
          input: { hostname: 'test-vps' },
          output: { ok: true },
        },
      ],
    } as any);
  });

  it('expands a transaction chain and shows transaction payload inline', async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByRole('link', { name: 'Create' });

    await user.click(screen.getByRole('button', { name: 'Items' }));

    await screen.findByText('Transaction items · 1');
    const tx = screen.getByText('CreateVps').closest('.rounded-md');
    expect(tx).not.toBeNull();

    await user.click(within(tx as HTMLElement).getByRole('button', { name: 'Expand' }));

    await waitFor(() => {
      expect(screen.getByText('Input')).toBeInTheDocument();
      expect(screen.getByText('Output')).toBeInTheDocument();
      expect(screen.getByText(/test-vps/)).toBeInTheDocument();
      expect(screen.getByText(/true/)).toBeInTheDocument();
    });

    expect(fetchTransactions).toHaveBeenCalledWith({ transactionChainId: 75, limit: 100 });
  });

  it('filters transaction chains to the current admin user in my scope', async () => {
    renderPanel();

    await screen.findByRole('link', { name: 'Create' });

    await waitFor(() => {
      expect(fetchTransactionChains).toHaveBeenCalledWith({ limit: 10, userId: 1 });
    });
  });

  it('does not apply a user filter in all-objects scope', async () => {
    objectScopeMock.value = { scope: 'all', mineUserId: undefined, canSwitchScope: true };

    renderPanel();

    await screen.findByRole('link', { name: 'Create' });

    await waitFor(() => {
      expect(fetchTransactionChains).toHaveBeenCalledWith({ limit: 10, userId: undefined });
    });
  });
});
