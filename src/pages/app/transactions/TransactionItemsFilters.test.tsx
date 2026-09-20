import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TransactionItemsFilters } from './TransactionItemsFilters';

const translations: Record<string, string> = {
  'common.all': 'All',
  'common.clear_filters': 'Clear filters',
  'common.close': 'Close',
  'common.copy_link': 'Copy link',
  'common.done': 'Done',
  'filters.advanced.label': 'Advanced',
  'filters.advanced.open': 'Open advanced filters',
  'filters.advanced.title': 'Advanced filters',
  'filters.help.open': 'Open filter help',
  'task_state.done': 'Done',
  'task_state.staged': 'Staged',
  'task_state.waiting': 'Waiting',
  'transactions.items.advanced.chain.label': 'Chain',
  'transactions.items.advanced.done.label': 'Done state',
  'transactions.items.advanced.node.label': 'Node',
  'transactions.items.advanced.success.label': 'Success',
  'transactions.items.advanced.type.label': 'Type',
  'transactions.items.search.placeholder': 'Find a transaction',
};

vi.mock('../../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const t = (key: string) => translations[key] ?? key;

function renderFilters() {
  const onAdvancedClose = vi.fn();
  const clearFilters = vi.fn();

  render(
    <TransactionItemsFilters
      t={t}
      smartInputRef={{ current: null }}
      smart=""
      smartNeedle=""
      smartErrorsCount={0}
      onSmartChange={vi.fn()}
      onSmartSubmit={vi.fn()}
      smartSuggestions={[]}
      activeFilterChips={[]}
      filtersActive
      helpOpen={false}
      onHelpOpen={vi.fn()}
      onHelpClose={vi.fn()}
      advancedOpen
      onAdvancedOpen={vi.fn()}
      onAdvancedClose={onAdvancedClose}
      clearFilters={clearFilters}
      chainIdText=""
      setChainIdText={vi.fn()}
      nodeIdText=""
      setNodeIdText={vi.fn()}
      typeText=""
      setTypeText={vi.fn()}
      done=""
      setDoneValue={vi.fn()}
      success=""
      setSuccessValue={vi.fn()}
    />
  );

  return { clearFilters, onAdvancedClose };
}

describe('TransactionItemsFilters', () => {
  it('associates each visible advanced-filter label with one uniquely named control', async () => {
    const user = userEvent.setup();
    renderFilters();

    const chain = screen.getByRole('textbox', { name: 'Chain' });
    const node = screen.getByRole('textbox', { name: 'Node' });
    const type = screen.getByRole('textbox', { name: 'Type' });
    const done = screen.getByRole('combobox', { name: 'Done state' });
    const success = screen.getByRole('combobox', { name: 'Success' });
    const controls = [chain, node, type, done, success];

    expect(new Set(controls.map((control) => control.id)).size).toBe(controls.length);
    expect(controls.every((control) => control.id.length > 0)).toBe(true);
    expect(chain).toHaveAttribute('inputmode', 'numeric');
    expect(node).toHaveAttribute('inputmode', 'numeric');
    expect(type).toHaveAttribute('inputmode', 'numeric');

    await user.click(screen.getByText('Chain', { selector: 'label' }));
    expect(chain).toHaveFocus();
    await user.click(screen.getByText('Done state', { selector: 'label' }));
    expect(done).toHaveFocus();
  });

  it('keeps filter controls touch-sized on mobile and compact above the small breakpoint', () => {
    renderFilters();

    for (const control of [
      screen.getByRole('textbox', { name: 'Chain' }),
      screen.getByRole('textbox', { name: 'Node' }),
      screen.getByRole('textbox', { name: 'Type' }),
      screen.getByRole('combobox', { name: 'Done state' }),
      screen.getByRole('combobox', { name: 'Success' }),
    ]) {
      expect(control).toHaveClass('h-11', 'sm:h-9');
    }

    expect(screen.getByTestId('transactions.items.smart_filter.help')).toHaveClass('h-11', 'w-11', 'sm:h-8', 'sm:w-8');
    expect(screen.getByTestId('transactions.items.advanced.open')).toHaveClass('h-11', 'min-w-11', 'sm:h-8');
    expect(screen.getByTestId('transactions.items.copy_link')).toHaveClass('h-11', 'sm:h-8');
    expect(screen.getAllByRole('button', { name: 'Clear filters' })).not.toHaveLength(0);
    for (const clearButton of screen.getAllByRole('button', { name: 'Clear filters' })) {
      expect(clearButton).toHaveClass('h-11', 'sm:h-8');
    }
    expect(screen.getByTestId('transactions.items.advanced.footer_done')).toHaveClass('h-11', 'sm:h-8');
  });
});
