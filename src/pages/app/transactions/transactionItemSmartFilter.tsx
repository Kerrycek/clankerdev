import React from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { FilterChip } from '../../../components/ui/FilterChip';
import type { SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { parseNumericToken } from '../../../lib/smartFilter';

import {
  inferDoneToken,
  inferSuccessToken,
  transactionItemsFilterToneFromSuccess,
  type DoneValue,
  type TransactionItemsTranslator,
} from './transactionItemSemantics';

interface BuildTransactionItemSuggestionsArgs {
  needle: string;
  basePath: string;
  navigate: NavigateFunction;
  t: TransactionItemsTranslator;
  onOpenHelp: () => void;
  onApply: () => void;
  onSetDone: (value: DoneValue) => void;
  onSetSuccess: (value: 0 | 1) => void;
  onSetChainId: (value: number) => void;
  onSetNodeId: (value: number) => void;
  onResetSmart: () => void;
}

interface BuildTransactionItemChipsArgs {
  chainIdNum?: number;
  nodeIdNum?: number;
  typeNum?: number;
  done: DoneValue | '';
  success: '' | 0 | 1;
  smartErrors: string[];
  onRemoveChain: () => void;
  onRemoveNode: () => void;
  onRemoveType: () => void;
  onRemoveDone: () => void;
  onRemoveSuccess: () => void;
  onClearSmartErrors: () => void;
}

export function buildTransactionItemSmartSuggestions({
  needle,
  basePath,
  navigate,
  t,
  onOpenHelp,
  onApply,
  onSetDone,
  onSetSuccess,
  onSetChainId,
  onSetNodeId,
  onResetSmart,
}: BuildTransactionItemSuggestionsArgs): SmartFilterSuggestion[] {
  if (!needle) return [];

  if (needle === '?') {
    return [
      {
        id: 'help',
        primary: t('filters.help.title'),
        secondary: t('filters.help.suggestion.secondary'),
        onPick: onOpenHelp,
        testId: 'transactions.items.smart_filter.suggest.help',
      },
    ];
  }

  const suggestions: SmartFilterSuggestion[] = [];
  const numeric = parseNumericToken(needle);
  if (numeric !== null) {
    const id = String(numeric);
    suggestions.push({
      id: 'open',
      primary: t('transactions.items.smart.suggest.open_tx', { id }),
      secondary: t('transactions.items.smart.suggest.open_tx.secondary'),
      onPick: () => {
        onResetSmart();
        navigate(`${basePath}/transactions/items/${id}`);
      },
      testId: 'transactions.items.smart_filter.suggest.open',
    });
    suggestions.push({
      id: 'chain',
      primary: t('transactions.items.smart.suggest.chain', { id }),
      secondary: t('transactions.items.smart.suggest.chain.secondary'),
      onPick: () => {
        onSetChainId(numeric);
        onResetSmart();
      },
      testId: 'transactions.items.smart_filter.suggest.chain',
    });
    suggestions.push({
      id: 'node',
      primary: t('transactions.items.smart.suggest.node', { id }),
      secondary: t('transactions.items.smart.suggest.node.secondary'),
      onPick: () => {
        onSetNodeId(numeric);
        onResetSmart();
      },
      testId: 'transactions.items.smart_filter.suggest.node',
    });
    return suggestions;
  }

  const low = needle.trim().toLowerCase();
  const inferredDone = inferDoneToken(low);
  if (inferredDone) {
    suggestions.push({
      id: `done:${inferredDone}`,
      primary: t('transactions.items.smart.suggest.done', { value: inferredDone }),
      secondary: t('transactions.items.smart.suggest.done.secondary'),
      onPick: () => {
        onSetDone(inferredDone);
        onResetSmart();
      },
      testId: 'transactions.items.smart_filter.suggest.done',
    });
  }

  const inferredSuccess = inferSuccessToken(low);
  if (inferredSuccess !== null && ['ok', 'success', 'fail', 'failed', 'error'].includes(low)) {
    suggestions.push({
      id: `success:${inferredSuccess}`,
      primary: t('transactions.items.smart.suggest.success', { value: String(inferredSuccess) }),
      secondary: t('transactions.items.smart.suggest.success.secondary'),
      onPick: () => {
        onSetSuccess(inferredSuccess);
        onResetSmart();
      },
      testId: 'transactions.items.smart_filter.suggest.success',
    });
  }

  if (suggestions.length > 0) return suggestions;

  suggestions.push({
    id: 'apply',
    primary: needle.includes(':')
      ? t('filters.smart.suggest.apply.primary')
      : t('transactions.items.smart.suggest.exact_filters_only', { value: needle }),
    secondary: needle.includes(':')
      ? t('filters.smart.suggest.apply.secondary')
      : t('transactions.items.smart.suggest.exact_filters_only.secondary'),
    onPick: onApply,
    testId: 'transactions.items.smart_filter.suggest.apply',
  });

  return suggestions;
}

export function buildTransactionItemFilterChips({
  chainIdNum,
  nodeIdNum,
  typeNum,
  done,
  success,
  smartErrors,
  onRemoveChain,
  onRemoveNode,
  onRemoveType,
  onRemoveDone,
  onRemoveSuccess,
  onClearSmartErrors,
}: BuildTransactionItemChipsArgs): React.ReactNode[] {
  const chips: React.ReactNode[] = [];

  if (chainIdNum) {
    chips.push(<FilterChip key="chain" label={`chain:${chainIdNum}`} onRemove={onRemoveChain} testId="transactions.items.chip.chain" />);
  }
  if (nodeIdNum) {
    chips.push(<FilterChip key="node" label={`node:${nodeIdNum}`} onRemove={onRemoveNode} testId="transactions.items.chip.node" />);
  }
  if (typeNum) {
    chips.push(<FilterChip key="type" label={`type:${typeNum}`} onRemove={onRemoveType} testId="transactions.items.chip.type" />);
  }
  if (done) {
    chips.push(<FilterChip key="done" label={`done:${done}`} onRemove={onRemoveDone} testId="transactions.items.chip.done" />);
  }
  if (success !== '') {
    chips.push(
      <FilterChip
        key="success"
        label={`success:${success}`}
        tone={transactionItemsFilterToneFromSuccess(success)}
        onRemove={onRemoveSuccess}
        testId="transactions.items.chip.success"
      />
    );
  }
  smartErrors.forEach((e, idx) => {
    chips.push(
      <FilterChip
        key={`err.${idx}`}
        label={e}
        tone="danger"
        onRemove={onClearSmartErrors}
        testId={`transactions.items.chip.error.${idx}`}
      />
    );
  });

  return chips;
}
