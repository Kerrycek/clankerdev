import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';

import { fetchIncomingPayments } from '../../../lib/api/payments';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { useTierSlowIntervalMs } from '../../../lib/refreshTiers';
import { splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue, parseNumericToken } from '../../../lib/smartFilter';
import { tableVariantFromBadgeVariant } from '../../../lib/variantMap';
import { incomingPaymentBadgeVariant, incomingPaymentStateLabelKey } from '../../../lib/paymentsBadges';

import { FilterBar } from '../../../components/layout/FilterBar';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';

import { Button } from '../../../components/ui/Button';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Drawer } from '../../../components/ui/Drawer';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterChip } from '../../../components/ui/FilterChip';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Select } from '../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../components/ui/SmartInputHelp';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';
import { IncomingPaymentsListContent } from './IncomingPaymentsListContent';
import {
  canonicalIncomingPaymentSmartKey,
  incomingPaymentStateFilterOptions,
  parseIncomingPaymentStateValue,
  parsePositiveIntInput,
} from './IncomingPaymentsModel';

export function IncomingPaymentsPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const toasts = useToasts();
  const tierSlowMs = useTierSlowIntervalMs();
  const navigate = useNavigate();

  const [sp, setSp] = useSearchParams();

  const state = useMemo(() => {
    const raw = String(sp.get('state') ?? '').trim().toLowerCase();
    if (!raw) return '';
    return incomingPaymentStateFilterOptions().includes(raw) ? raw : '';
  }, [sp]);

  const qText = useMemo(() => String(sp.get('q') ?? ''), [sp]);

  const urlUser = useMemo(() => String(sp.get('user') ?? ''), [sp]);
  const [userId, setUserId] = useState(() => urlUser);

  useEffect(() => {
    setUserId(urlUser);
  }, [urlUser]);

  const userIdNum = useMemo(() => parsePositiveIntInput(userId), [userId]);

  useEffect(() => {
    // Keep URL in sync while allowing the lookup input to hold a non-numeric query.
    const next = new URLSearchParams(sp);
    if (userIdNum !== undefined) next.set('user', String(userIdNum));
    else next.delete('user');

    if (next.toString() !== sp.toString()) setSp(next, { replace: true });
  }, [sp, setSp, userIdNum]);

  const setStateInUrl = (nextState: string) => {
    const st = String(nextState ?? '').trim().toLowerCase();
    setSp((prev) => {
      const p = new URLSearchParams(prev);
      if (st && incomingPaymentStateFilterOptions().includes(st)) p.set('state', st);
      else p.delete('state');
      return p;
    });
  };

  const setQueryInUrl = (nextQ: string) => {
    const qq = String(nextQ ?? '').trim();
    setSp((prev) => {
      const p = new URLSearchParams(prev);
      if (qq) p.set('q', qq);
      else p.delete('q');
      return p;
    });
  };

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const smartNeedle = smart.trim();
  const smartInputRef = useRef<HTMLInputElement>(null);

  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (smartNeedle === '?') setHelpOpen(true);
  }, [smartNeedle]);

  const filtersActive = Boolean(state || qText.trim() || userIdNum !== undefined);

  const clearFilters = () => {
    setSmart('');
    setSmartErrors([]);
    setUserId('');

    setSp((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('state');
      p.delete('q');
      p.delete('user');
      return p;
    });
  };

  const applySmartText = (raw: string) => {
    const input = String(raw ?? '').trim();
    if (!input) return;

    if (input === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(input);

    // Domain heuristic: plain numerics are likely VS; open-by-id is opt-in via "#123" or id:123.
    if (tokens.length === 1) {
      const only = tokens[0] ?? '';
      if (String(only).trim().startsWith('#')) {
        const n = parseNumericToken(only);
        if (n !== null) {
          setSmart('');
          setSmartErrors([]);
          navigate(`${basePath}/payments/incoming/${n}`);
          return;
        }
      }
    }

    let nextState = state;
    let nextQ = qText;
    let nextUserId = userIdNum;

    const free: string[] = [];
    const errs: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (kv) {
        const key = canonicalIncomingPaymentSmartKey(kv.rawKey);
        const value = unquoteSmartValue(kv.rawValue);

        if (!key) {
          errs.push(t('filters.smart.error.unknown_key', { key: kv.rawKey }));
          continue;
        }

        if (!value.trim() && key !== 'state') {
          errs.push(t('filters.smart.error.missing_value', { key: kv.rawKey.trim() }));
          continue;
        }

        if (key === 'id') {
          const n = parseNumericToken(value);
          if (n === null) errs.push(t('payments.incoming.smart.error.id_numeric_only', { value }));
          else {
            setSmart('');
            setSmartErrors([]);
            navigate(`${basePath}/payments/incoming/${n}`);
            return;
          }
          continue;
        }

        if (key === 'state') {
          const st = parseIncomingPaymentStateValue(value);
          if (st === null) errs.push(t('payments.incoming.smart.error.invalid_state', { value }));
          else nextState = st;
          continue;
        }

        if (key === 'user') {
          const n = parseNumericToken(value);
          if (n !== null) nextUserId = n;
          else {
            // Treat non-numeric values as a search term, since server-side q matches user login.
            free.push(value);
          }
          continue;
        }

        if (key === 'q') {
          nextQ = value;
          continue;
        }

        errs.push(t('filters.smart.error.unknown_key', { key: kv.rawKey }));
        continue;
      }

      const plain = unquoteSmartValue(token);
      const low = plain.trim().toLowerCase();

      // Common triage shortcut: allow plain state tokens.
      if (incomingPaymentStateFilterOptions().includes(low)) {
        nextState = low;
        continue;
      }

      free.push(plain);
    }

    if (free.length > 0) nextQ = free.join(' ');

    if (errs.length > 0) {
      setSmartErrors(errs);
      toasts.pushToast({ variant: 'danger', title: errs[0] ?? t('common.unknown_error') });
      return;
    }

    setSp((prev) => {
      const p = new URLSearchParams(prev);
      if (nextState) p.set('state', nextState);
      else p.delete('state');

      if (nextQ.trim()) p.set('q', nextQ.trim());
      else p.delete('q');

      if (nextUserId !== undefined) p.set('user', String(nextUserId));
      else p.delete('user');

      return p;
    });

    setUserId(nextUserId !== undefined ? String(nextUserId) : '');
    setSmart('');
    setSmartErrors([]);
  };

  const smartSuggestions = useMemo((): SmartFilterSuggestion[] => {
    const needle = smartNeedle;
    if (!needle) return [];

    if (needle === '?') {
      return [
        {
          id: 'help',
          primary: t('filters.help.title'),
          secondary: t('filters.help.suggestion.secondary'),
          onPick: () => setHelpOpen(true),
          testId: 'admin.payments.incoming.smart_filter.suggest.help',
        },
      ];
    }

    const suggestions: SmartFilterSuggestion[] = [];

    // Apply key:value directly.
    if (needle.includes(':')) {
      suggestions.push({
        id: 'apply',
        primary: t('filters.smart.suggest.apply.primary'),
        secondary: t('filters.smart.suggest.apply.secondary'),
        onPick: () => applySmartText(needle),
        testId: 'admin.payments.incoming.smart_filter.suggest.apply',
      });
      return suggestions;
    }

    const low = needle.trim().toLowerCase();

    // State suggestions (exact or prefix).
    const sts = incomingPaymentStateFilterOptions().filter((x) => x).filter((s) => s.startsWith(low) || low === s);
    if (sts.length > 0 && low.length >= 2) {
      for (const st of sts.slice(0, 4)) {
        suggestions.push({
          id: `state:${st}`,
          primary: t('payments.incoming.smart.suggest.state', { state: t(incomingPaymentStateLabelKey(st)) }),
          secondary:
            st === state
              ? t('payments.incoming.smart.suggest.state.clear.secondary')
              : t('payments.incoming.smart.suggest.state.secondary'),
          onPick: () => {
            setStateInUrl(st === state ? '' : st);
            setSmart('');
            setSmartErrors([]);
          },
          testId: `admin.payments.incoming.smart_filter.suggest.state.${st}`,
        });
      }

      // Still allow searching for the word.
      suggestions.push({
        id: 'search',
        primary: t('payments.incoming.smart.suggest.search', { value: needle }),
        secondary: t('payments.incoming.smart.suggest.search.secondary'),
        onPick: () => {
          setQueryInUrl(needle);
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'admin.payments.incoming.smart_filter.suggest.search',
      });

      return suggestions;
    }

    // Numeric ambiguity: VS is common. Prefer searching, but offer "open #id" as an explicit option.
    const numeric = parseNumericToken(needle);
    const hasHash = needle.trim().startsWith('#');

    if (numeric !== null && hasHash) {
      const id = String(numeric);
      suggestions.push({
        id: `open:${id}`,
        primary: t('payments.incoming.smart.suggest.open_payment', { id }),
        secondary: t('payments.incoming.smart.suggest.open_payment.secondary'),
        onPick: () => navigate(`${basePath}/payments/incoming/${numeric}`),
        testId: 'admin.payments.incoming.smart_filter.suggest.open',
      });
      return suggestions;
    }

    // Default search suggestion.
    suggestions.push({
      id: 'search',
      primary: t('payments.incoming.smart.suggest.search', { value: needle }),
      secondary: t('payments.incoming.smart.suggest.search.secondary'),
      onPick: () => {
        setQueryInUrl(needle);
        setSmart('');
        setSmartErrors([]);
      },
      testId: 'admin.payments.incoming.smart_filter.suggest.search',
    });

    // Numeric "open" hint.
    if (numeric !== null && !hasHash) {
      const id = String(numeric);
      suggestions.push({
        id: `open:${id}`,
        primary: t('payments.incoming.smart.suggest.open_payment', { id }),
        secondary: t('payments.incoming.smart.suggest.open_payment.secondary_hash'),
        onPick: () => {
          setSmart(`#${id}`);
          window.requestAnimationFrame(() => smartInputRef.current?.focus());
        },
        testId: 'admin.payments.incoming.smart_filter.suggest.open_hint',
      });
    }

    return suggestions;
  }, [applySmartText, basePath, incomingPaymentStateLabelKey, navigate, qText, setQueryInUrl, setStateInUrl, smartNeedle, state, t]);

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];

    if (state) {
      const stLabel = t(incomingPaymentStateLabelKey(state));
      const tone = tableVariantFromBadgeVariant(incomingPaymentBadgeVariant(state)) ?? 'neutral';

      chips.push(
        <FilterChip
          key="state"
          label={`state:${stLabel}`}
          tone={tone}
          onRemove={() => setStateInUrl('')}
          testId="admin.payments.incoming.chip.state"
        />
      );
    }

    const q = qText.trim();
    if (q) {
      chips.push(
        <FilterChip
          key="q"
          label={`q:${q}`}
          onRemove={() => setQueryInUrl('')}
          testId="admin.payments.incoming.chip.q"
        />
      );
    }

    if (userIdNum !== undefined) {
      chips.push(
        <FilterChip
          key="user"
          label={`user:#${userIdNum}`}
          onRemove={() => setUserId('')}
          testId="admin.payments.incoming.chip.user"
        />
      );
    }

    smartErrors.forEach((e, idx) => {
      chips.push(
        <FilterChip
          key={`err.${idx}`}
          label={e}
          tone="danger"
          onRemove={() => setSmartErrors([])}
          testId={`admin.payments.incoming.chip.error.${idx}`}
        />
      );
    });

    return chips;
  }, [incomingPaymentStateLabelKey, qText, setQueryInUrl, setStateInUrl, smartErrors, state, t, userIdNum]);

  const pagination = useKeysetPagination({
    id: 'admin.payments.incoming.list',
    filterKey: JSON.stringify({ scope: basePath, state, q: qText.trim(), user: userIdNum ?? null }),
    searchParams: sp,
    setSearchParams: setSp,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100, 200],
  });

  const paymentsQ = useQuery({
    queryKey: [
      'incoming_payments',
      'index',
      { limit: pagination.limit, fromId: pagination.fromId, state: state || undefined, q: qText.trim() || undefined, user: userIdNum },
    ],
    queryFn: async () =>
      (
        await fetchIncomingPayments({
          limit: pagination.limit,
          fromId: pagination.fromId,
          state: state || undefined,
          q: qText.trim() || undefined,
          userId: userIdNum,
        })
      ).data,
    refetchInterval: tierSlowMs,
  });

  const rows = paymentsQ.data ?? [];

  const pageCursor = useMemo(() => cursorFromDescendingPage(rows, (row) => row.id), [rows]);
  const canNext = rows.length === pagination.limit;

  const shareUrl = useMemo(() => (typeof window !== 'undefined' ? window.location.href : ''), [sp]);

  return (
    <ListShell
      testId="admin.payments.incoming.list"
      header={<PageHeader title={t('payments.incoming.list.title')} description={t('payments.incoming.list.description')} />}
      filters={
        <>
          <FilterBar>
            <SmartFilterInput
              value={smart}
              onChange={(v) => {
                setSmart(v);
                if (smartErrors.length) setSmartErrors([]);
              }}
              onSubmit={() => applySmartText(smart)}
              suggestions={smartSuggestions}
              placeholder={t('payments.incoming.list.filter.q.placeholder')}
              ref={smartInputRef}
              testId="admin.payments.incoming.smart_filter"
              className="w-full sm:max-w-xl"
              suffix={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setHelpOpen(true)}
                  ariaLabel={t('filters.help.open')}
                  testId="admin.payments.incoming.filters.help"
                >
                  <CircleHelp className="h-4 w-4" />
                </Button>
              }
            />

            <Select
              value={state}
              onChange={(e) => setStateInUrl(e.target.value)}
              aria-label={t('payments.incoming.list.filter.state.aria')}
              className="w-44"
              testId="admin.payments.incoming.filter.state"
            >
              <option value="">{t('common.all')}</option>
              {incomingPaymentStateFilterOptions()
                .filter((x) => x)
                .map((s) => (
                  <option key={s} value={s}>
                    {t(incomingPaymentStateLabelKey(s))}
                  </option>
                ))}
            </Select>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAdvancedOpen(true)}
              testId="admin.payments.incoming.filters.advanced"
              ariaLabel={t('filters.advanced.open')}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => paymentsQ.refetch()}
              testId="admin.payments.incoming.filters.refresh"
            >
              {t('common.refresh')}
            </Button>

            <CopyButton
              text={shareUrl}
              label={t('common.copy_link')}
              size="sm"
              variant="secondary"
              testId="admin.payments.incoming.filters.copy_link"
            />

            {filtersActive ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={clearFilters}
                testId="admin.payments.incoming.filters.clear"
              >
                {t('common.clear_filters')}
              </Button>
            ) : null}
          </FilterBar>

          {activeFilterChips.length ? <div className="flex flex-wrap gap-2">{activeFilterChips}</div> : null}

          <SmartInputHelp
            open={helpOpen}
            onClose={() => setHelpOpen(false)}
            title={t('filters.help.title')}
            intro={t('payments.incoming.smart_help.intro')}
            examples={[
              { label: t('filters.help.examples.help'), value: '?' },
              { label: t('payments.incoming.smart_help.examples.search'), value: 'alice' },
              { label: t('payments.incoming.smart_help.examples.state'), value: 'state:unmatched' },
              { label: t('payments.incoming.smart_help.examples.open_id'), value: '#300' },
              { label: t('payments.incoming.smart_help.examples.vs'), value: 'vs:123456' },
            ]}
            topKeys={[
              { key: 'q', description: t('payments.incoming.smart_help.keys.q'), example: 'q:alice' },
              { key: 'state', description: t('payments.incoming.smart_help.keys.state'), example: 'state:unmatched' },
              { key: 'user', description: t('payments.incoming.smart_help.keys.user'), example: 'user:123' },
              { key: 'id', description: t('payments.incoming.smart_help.keys.id'), example: 'id:300' },
            ]}
            moreKeys={[
              { key: 'vs', description: t('payments.incoming.smart_help.keys.vs'), example: 'vs:123456' },
              { key: 'tx', description: t('payments.incoming.smart_help.keys.tx'), example: 'tx:ABC123' },
              { key: 'account', description: t('payments.incoming.smart_help.keys.account'), example: 'account:ČSOB' },
              { key: 'ident', description: t('payments.incoming.smart_help.keys.ident'), example: 'ident:john' },
              { key: 'msg', description: t('payments.incoming.smart_help.keys.msg'), example: 'msg:"order 42"' },
            ]}
            inference={[
              t('payments.incoming.smart_help.inference.enter_applies'),
              t('payments.incoming.smart_help.inference.number_searches'),
              t('payments.incoming.smart_help.inference.hash_opens'),
              t('payments.incoming.smart_help.inference.key_value'),
            ]}
            onInsertKey={(key) => {
              setHelpOpen(false);
              setSmart(`${key}:`);
              window.requestAnimationFrame(() => smartInputRef.current?.focus());
            }}
            actions={[
              {
                label: t('filters.help.open_advanced'),
                onClick: () => {
                  setHelpOpen(false);
                  setAdvancedOpen(true);
                },
              },
            ]}
            testId="admin.payments.incoming.smart_filter.help"
            keyRowTestIdPrefix="admin.payments.incoming.smart_filter.help.key"
          />

          <Drawer
            open={advancedOpen}
            onClose={() => setAdvancedOpen(false)}
            title={t('filters.advanced.title')}
            width="lg"
            testId="admin.payments.incoming.advanced_filters"
            footer={
              <div className="flex items-center justify-end gap-2">
                {filtersActive ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    {t('common.clear_filters')}
                  </Button>
                ) : null}
                <Button variant="primary" size="sm" onClick={() => setAdvancedOpen(false)}>
                  {t('common.close')}
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium">{t('common.user')}</div>
                <div className="mt-1">
                  <UserLookupInput
                    value={userId}
                    onChange={setUserId}
                    placeholder={t('payments.incoming.assign.user_placeholder')}
                    testId="admin.payments.incoming.filter.user.lookup"
                    loadingLabel={t('common.loading')}
                    noResultsLabel={t('palette.empty.no_results')}
                  />
                </div>
                <div className="mt-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
                  {t('payments.incoming.smart_help.drawer_hint')}
                </div>
              </div>
            </div>
          </Drawer>
        </>
      }
    >
      {paymentsQ.isLoading ? (
        <LoadingState testId="admin.payments.incoming.loading" />
      ) : paymentsQ.isError ? (
        <ErrorState
          testId="admin.payments.incoming.error"
          title={t('payments.incoming.list.load_error.title')}
          error={paymentsQ.error}
        />
      ) : rows.length === 0 ? (
        <EmptyState testId="admin.payments.incoming.empty" title={t('payments.incoming.list.empty')} />
      ) : (
        <IncomingPaymentsListContent
          rows={rows}
          basePath={basePath}
          pagination={pagination}
          pageCursor={pageCursor}
          canNext={canNext}
        />
      )}
    </ListShell>
  );
}
