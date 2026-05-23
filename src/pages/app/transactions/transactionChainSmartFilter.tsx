import React from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { FilterChip } from '../../../components/ui/FilterChip';
import type { SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { directConcernLink } from '../../../lib/concernLinks';
import type { User } from '../../../lib/api/users';
import { parseNumericToken, splitKeyValueToken, unquoteSmartValue } from '../../../lib/smartFilter';

import {
  inferChainState,
  looksLikeConcernClass,
  chainFilterToneFromState,
  type ChainState,
  type TransactionChainsTranslator,
} from './transactionChainSemantics';

interface BuildSuggestionsArgs {
  needle: string;
  mode: 'app' | 'admin';
  basePath: string;
  navigate: NavigateFunction;
  t: TransactionChainsTranslator;
  userSuggestions?: User[];
  onOpenHelp: () => void;
  onApply: () => void;
  onSetClassName: (value: string) => void;
  onSetRowId: (value: string) => void;
  onSetState: (value: ChainState | '') => void;
  onSetErrorsOnly: (value: boolean) => void;
  onSetUserId: (value: string) => void;
  onResetSmart: () => void;
}

export function buildTransactionChainSmartSuggestions({
  needle,
  mode,
  basePath,
  navigate,
  t,
  userSuggestions,
  onOpenHelp,
  onApply,
  onSetClassName,
  onSetRowId,
  onSetState,
  onSetErrorsOnly,
  onSetUserId,
  onResetSmart,
}: BuildSuggestionsArgs): SmartFilterSuggestion[] {
  if (!needle) return [];

  if (needle === '?') {
    return [
      {
        id: 'help',
        primary: t('filters.help.title'),
        secondary: t('filters.help.open'),
        onPick: onOpenHelp,
      },
    ];
  }

  const suggestions: SmartFilterSuggestion[] = [];
  const numeric = parseNumericToken(needle);
  if (numeric !== null) {
    const id = String(numeric);
    suggestions.push({
      id: `open:${id}`,
      primary: t('transactions.chains.smart.suggest.open_chain', { id }),
      secondary: t('transactions.chains.smart.suggest.open_chain.secondary'),
      onPick: () => navigate(`${basePath}/transactions/${numeric}`),
    });

    suggestions.push({
      id: `concern_id:${id}`,
      primary: t('transactions.chains.smart.suggest.concern_id', { id }),
      secondary: t('transactions.chains.smart.suggest.concern_id.secondary'),
      onPick: () => {
        onSetRowId(String(numeric));
        onResetSmart();
      },
    });

    if (mode === 'admin') {
      suggestions.push({
        id: `user:${id}`,
        primary: t('transactions.chains.smart.suggest.user_id', { id }),
        secondary: t('transactions.chains.smart.suggest.user_id.secondary'),
        onPick: () => {
          onSetUserId(String(numeric));
          onResetSmart();
        },
      });
    }

    return suggestions;
  }

  const mHash = needle.match(/^([A-Z][A-Za-z0-9_:]*)#(\d+)$/);
  if (mHash) {
    const cls = mHash[1] ?? '';
    const rid = Number(mHash[2]);
    if (looksLikeConcernClass(cls) && Number.isFinite(rid) && rid > 0) {
      suggestions.push({
        id: `concern:${cls}#${rid}`,
        primary: t('transactions.chains.smart.suggest.concern', { cls, id: String(rid) }),
        secondary: t('transactions.chains.smart.suggest.concern.secondary'),
        onPick: () => {
          onSetClassName(cls);
          onSetRowId(String(rid));
          onResetSmart();
        },
      });

      const link = directConcernLink(basePath, cls, Math.floor(rid));
      if (link) {
        suggestions.push({
          id: `open_object:${cls}#${rid}`,
          primary: t('transactions.chains.smart.suggest.open_object', { cls, id: String(rid) }),
          secondary: t('transactions.chains.smart.suggest.open_object.secondary'),
          onPick: () => navigate(link),
        });
      }
    }
  }

  const kv = splitKeyValueToken(needle);
  if (kv) {
    const rawKey = kv.rawKey;
    const value = unquoteSmartValue(kv.rawValue);

    if (!looksLikeConcernClass(rawKey)) {
      const stateMatch = rawKey.trim().toLowerCase();
      if (['state', 'st', 'status'].includes(stateMatch)) {
        const st = inferChainState(value);
        if (st) {
          suggestions.push({
            id: `state:${st}`,
            primary: t('transactions.chains.smart.suggest.state', { state: String(st) }),
            secondary: t('transactions.chains.smart.suggest.state.secondary'),
            onPick: () => {
              onSetState(st);
              onSetErrorsOnly(false);
              onResetSmart();
            },
          });
        }
      }

      if (['errors', 'error', 'err', 'failed', 'fail'].includes(stateMatch)) {
        suggestions.push({
          id: 'errors_only',
          primary: t('transactions.chains.smart.suggest.errors_only'),
          secondary: t('transactions.chains.smart.suggest.errors_only.secondary'),
          onPick: () => {
            onSetErrorsOnly(true);
            onSetState('');
            onResetSmart();
          },
        });
      }
    }

    if (looksLikeConcernClass(rawKey)) {
      const n = parseNumericToken(value);
      if (n !== null) {
        suggestions.push({
          id: `concern:${rawKey}#${n}`,
          primary: t('transactions.chains.smart.suggest.concern', { cls: rawKey.trim(), id: String(n) }),
          secondary: t('transactions.chains.smart.suggest.concern.secondary'),
          onPick: () => {
            onSetClassName(rawKey.trim());
            onSetRowId(String(n));
            onResetSmart();
          },
        });
      }
    }

    suggestions.push({
      id: 'apply',
      primary: t('filters.smart.suggest.apply.primary'),
      secondary: t('filters.smart.suggest.apply.secondary'),
      onPick: onApply,
    });

    return suggestions;
  }

  suggestions.push({
    id: `label:${needle}`,
    primary: t('transactions.chains.smart.suggest.label', { value: needle }),
    secondary: t('transactions.chains.smart.suggest.label.secondary'),
    onPick: onApply,
  });

  const stateSuggestion = inferChainState(needle);
  if (stateSuggestion) {
    suggestions.push({
      id: `state:${stateSuggestion}`,
      primary: t('transactions.chains.smart.suggest.state', { state: String(stateSuggestion) }),
      secondary: t('transactions.chains.smart.suggest.state.secondary'),
      onPick: () => {
        onSetState(stateSuggestion);
        onSetErrorsOnly(false);
        onResetSmart();
      },
    });
  }

  if (mode === 'admin') {
    for (const user of userSuggestions ?? []) {
      const login = user.login.trim();
      const id = String(user.id);
      if (!login || !id) continue;
      suggestions.push({
        id: `user_login:${login}`,
        primary: t('filters.smart.suggest.user_login', { login }),
        secondary: t('transactions.chains.smart.suggest.user_login.secondary'),
        onPick: () => {
          onSetUserId(id);
          onResetSmart();
        },
      });
    }
  }

  return suggestions;
}

interface BuildActiveChipsArgs {
  t: TransactionChainsTranslator;
  mode: 'app' | 'admin';
  smartErrors: string[];
  queryTrim: string;
  errorsOnly: boolean;
  state: ChainState | '';
  classNameNorm?: string;
  rowIdNum?: number;
  userIdNum?: number;
  userSessionNum?: number;
  clearSmartErrors: () => void;
  clearQuery: () => void;
  clearErrorsOnly: () => void;
  clearState: () => void;
  clearClassName: () => void;
  clearRowId: () => void;
  clearUserId: () => void;
  clearUserSessionId: () => void;
}

export function buildTransactionChainActiveFilterChips({
  t,
  mode,
  smartErrors,
  queryTrim,
  errorsOnly,
  state,
  classNameNorm,
  rowIdNum,
  userIdNum,
  userSessionNum,
  clearSmartErrors,
  clearQuery,
  clearErrorsOnly,
  clearState,
  clearClassName,
  clearRowId,
  clearUserId,
  clearUserSessionId,
}: BuildActiveChipsArgs): React.ReactNode[] {
  const chips: React.ReactNode[] = [];

  if (smartErrors.length > 0) {
    for (const error of smartErrors) {
      chips.push(<FilterChip key={`smart_error:${error}`} label={error} tone="danger" onRemove={clearSmartErrors} />);
    }
  }

  if (queryTrim) {
    chips.push(<FilterChip key="q" label={`q:${queryTrim}`} onRemove={clearQuery} />);
  }

  if (errorsOnly) {
    chips.push(
      <FilterChip
        key="errors_only"
        label={t('transactions.chains.filter.errors_only.chip')}
        tone="danger"
        onRemove={clearErrorsOnly}
      />
    );
  }

  if (state) {
    chips.push(<FilterChip key="state" label={`state:${state}`} tone={chainFilterToneFromState(state)} onRemove={clearState} />);
  }

  if (classNameNorm) {
    chips.push(<FilterChip key="class" label={`class:${classNameNorm}`} tone="muted" onRemove={clearClassName} />);
  }

  if (rowIdNum !== undefined) {
    chips.push(<FilterChip key="row_id" label={`id:${rowIdNum}`} tone="muted" onRemove={clearRowId} />);
  }

  if (mode === 'admin' && userIdNum !== undefined) {
    chips.push(<FilterChip key="user" label={`user:${userIdNum}`} tone="muted" onRemove={clearUserId} />);
  }

  if (mode === 'admin' && userSessionNum !== undefined) {
    chips.push(
      <FilterChip key="user_session" label={`session:${userSessionNum}`} tone="muted" onRemove={clearUserSessionId} />
    );
  }

  return chips;
}
