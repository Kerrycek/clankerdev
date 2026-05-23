import React from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { FilterChip } from '../../../components/ui/FilterChip';
import type { SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import type { User } from '../../../lib/api/users';
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
  mode: 'app' | 'admin';
  basePath: string;
  navigate: NavigateFunction;
  t: TransactionItemsTranslator;
  userSuggestions?: User[];
  onOpenHelp: () => void;
  onApply: () => void;
  onSetDone: (value: DoneValue) => void;
  onSetSuccess: (value: 0 | 1) => void;
  onSetQuery: (value: string) => void;
  onSetChainId: (value: number) => void;
  onSetVpsId: (value: number) => void;
  onSetNodeId: (value: number) => void;
  onSetUserId: (value: number) => void;
  onResetSmart: () => void;
}

interface BuildTransactionItemChipsArgs {
  mode: 'app' | 'admin';
  qTrim: string;
  chainIdNum?: number;
  nodeIdNum?: number;
  vpsIdNum?: number;
  typeNum?: number;
  done: DoneValue | '';
  success: '' | 0 | 1;
  userIdNum?: number;
  implicitMineFilter: boolean;
  mineUserId?: number;
  smartErrors: string[];
  onRemoveQuery: () => void;
  onRemoveChain: () => void;
  onRemoveNode: () => void;
  onRemoveVps: () => void;
  onRemoveType: () => void;
  onRemoveDone: () => void;
  onRemoveSuccess: () => void;
  onRemoveUser: () => void;
  onClearSmartErrors: () => void;
}

export function buildTransactionItemSmartSuggestions({
  needle,
  mode,
  basePath,
  navigate,
  t,
  userSuggestions,
  onOpenHelp,
  onApply,
  onSetDone,
  onSetSuccess,
  onSetQuery,
  onSetChainId,
  onSetVpsId,
  onSetNodeId,
  onSetUserId,
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
      id: 'vps',
      primary: t('transactions.items.smart.suggest.vps', { id }),
      secondary: t('transactions.items.smart.suggest.vps.secondary'),
      onPick: () => {
        onSetVpsId(numeric);
        onResetSmart();
      },
      testId: 'transactions.items.smart_filter.suggest.vps',
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

  if (needle.includes(':')) {
    suggestions.push({
      id: 'apply',
      primary: t('filters.smart.suggest.apply.primary'),
      secondary: t('filters.smart.suggest.apply.secondary'),
      onPick: onApply,
      testId: 'transactions.items.smart_filter.suggest.apply',
    });
    return suggestions;
  }

  const low = needle.trim().toLowerCase();
  const d = inferDoneToken(low);
  if (d) {
    suggestions.push({
      id: `done:${d}`,
      primary: t('transactions.items.smart.suggest.done', { value: d }),
      secondary: t('transactions.items.smart.suggest.done.secondary'),
      onPick: () => {
        onSetDone(d);
        onResetSmart();
      },
      testId: 'transactions.items.smart_filter.suggest.done',
    });
  }

  const s = inferSuccessToken(low);
  if (s !== null && ['ok', 'success', 'fail', 'failed', 'error'].includes(low)) {
    suggestions.push({
      id: `success:${s}`,
      primary: t('transactions.items.smart.suggest.success', { value: String(s) }),
      secondary: t('transactions.items.smart.suggest.success.secondary'),
      onPick: () => {
        onSetSuccess(s);
        onResetSmart();
      },
      testId: 'transactions.items.smart_filter.suggest.success',
    });
  }

  suggestions.push({
    id: 'search',
    primary: t('transactions.items.smart.suggest.search', { value: needle }),
    secondary: t('transactions.items.smart.suggest.search.secondary'),
    onPick: () => {
      onSetQuery(needle);
      onResetSmart();
    },
    testId: 'transactions.items.smart_filter.suggest.search',
  });

  if (mode === 'admin') {
    for (const u of (userSuggestions ?? []).slice(0, 5)) {
      suggestions.push({
        id: `user.${u.id}`,
        primary: t('filters.smart.suggest.user_login', { login: u.login }),
        secondary: `#${u.id}`,
        onPick: () => {
          onSetUserId(u.id);
          onResetSmart();
        },
        testId: `transactions.items.smart_filter.suggest.user.${u.id}`,
      });
    }
  }

  return suggestions;
}

export function buildTransactionItemFilterChips({
  mode,
  qTrim,
  chainIdNum,
  nodeIdNum,
  vpsIdNum,
  typeNum,
  done,
  success,
  userIdNum,
  implicitMineFilter,
  mineUserId,
  smartErrors,
  onRemoveQuery,
  onRemoveChain,
  onRemoveNode,
  onRemoveVps,
  onRemoveType,
  onRemoveDone,
  onRemoveSuccess,
  onRemoveUser,
  onClearSmartErrors,
}: BuildTransactionItemChipsArgs): React.ReactNode[] {
  const chips: React.ReactNode[] = [];

  if (implicitMineFilter && mineUserId !== undefined) {
    chips.push(
      <FilterChip key="scope" label={`scope:mine(user=${mineUserId})`} tone="info" testId="transactions.items.chip.scope" />
    );
  }

  if (qTrim) {
    chips.push(<FilterChip key="q" label={`q:${qTrim}`} onRemove={onRemoveQuery} testId="transactions.items.chip.q" />);
  }
  if (chainIdNum) {
    chips.push(<FilterChip key="chain" label={`chain:${chainIdNum}`} onRemove={onRemoveChain} testId="transactions.items.chip.chain" />);
  }
  if (nodeIdNum) {
    chips.push(<FilterChip key="node" label={`node:${nodeIdNum}`} onRemove={onRemoveNode} testId="transactions.items.chip.node" />);
  }
  if (vpsIdNum) {
    chips.push(<FilterChip key="vps" label={`vps:${vpsIdNum}`} onRemove={onRemoveVps} testId="transactions.items.chip.vps" />);
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
  if (userIdNum && mode === 'admin') {
    chips.push(<FilterChip key="user" label={`user:${userIdNum}`} onRemove={onRemoveUser} testId="transactions.items.chip.user" />);
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
