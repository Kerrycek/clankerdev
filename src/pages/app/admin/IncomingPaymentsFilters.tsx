import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue, parseNumericToken } from '../../../lib/smartFilter';
import { tableVariantFromBadgeVariant } from '../../../lib/variantMap';
import { incomingPaymentBadgeVariant, incomingPaymentStateLabelKey } from '../../../lib/paymentsBadges';

import { FilterBar } from '../../../components/layout/FilterBar';
import { Button } from '../../../components/ui/Button';
import { CopyButton } from '../../../components/ui/CopyButton';
import { FilterChip } from '../../../components/ui/FilterChip';
import { Select } from '../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import {
  canonicalIncomingPaymentSmartKey,
  incomingPaymentStateFilterOptions,
  parseIncomingPaymentStateValue,
} from './IncomingPaymentsModel';
import { IncomingPaymentsFiltersHelp } from './IncomingPaymentsFiltersHelp';

type SearchParamSetter = (
  nextInit: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
  navigateOptions?: { replace?: boolean; state?: unknown }
) => void;

export function IncomingPaymentsFilters(props: {
  basePath: string;
  state: string;
  qText: string;
  userId: string;
  userIdNum?: number;
  setUserId: (value: string) => void;
  setSearchParams: SearchParamSetter;
  onRefresh: () => void;
  shareUrl: string;
}) {
  const { t } = useI18n();
  const toasts = useToasts();
  const navigate = useNavigate();

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const smartNeedle = smart.trim();
  const smartInputRef = useRef<HTMLInputElement>(null);

  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (smartNeedle === '?') setHelpOpen(true);
  }, [smartNeedle]);

  const filtersActive = Boolean(props.state || props.qText.trim() || props.userIdNum !== undefined);

  const setStateInUrl = (nextState: string) => {
    const st = String(nextState ?? '').trim().toLowerCase();
    props.setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (st && incomingPaymentStateFilterOptions().includes(st)) p.set('state', st);
      else p.delete('state');
      return p;
    });
  };

  const setQueryInUrl = (nextQ: string) => {
    const qq = String(nextQ ?? '').trim();
    props.setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (qq) p.set('q', qq);
      else p.delete('q');
      return p;
    });
  };

  const clearFilters = () => {
    setSmart('');
    setSmartErrors([]);
    props.setUserId('');

    props.setSearchParams((prev) => {
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
          navigate(`${props.basePath}/payments/incoming/${n}`);
          return;
        }
      }
    }

    let nextState = props.state;
    let nextQ = props.qText;
    let nextUserId = props.userIdNum;

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
            navigate(`${props.basePath}/payments/incoming/${n}`);
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

    props.setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (nextState) p.set('state', nextState);
      else p.delete('state');

      if (nextQ.trim()) p.set('q', nextQ.trim());
      else p.delete('q');

      if (nextUserId !== undefined) p.set('user', String(nextUserId));
      else p.delete('user');

      return p;
    });

    props.setUserId(nextUserId !== undefined ? String(nextUserId) : '');
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
            st === props.state
              ? t('payments.incoming.smart.suggest.state.clear.secondary')
              : t('payments.incoming.smart.suggest.state.secondary'),
          onPick: () => {
            setStateInUrl(st === props.state ? '' : st);
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
        onPick: () => navigate(`${props.basePath}/payments/incoming/${numeric}`),
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
  }, [smartNeedle, t, props.state, props.basePath, navigate]);

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];

    if (props.state) {
      const stLabel = t(incomingPaymentStateLabelKey(props.state));
      const tone = tableVariantFromBadgeVariant(incomingPaymentBadgeVariant(props.state)) ?? 'neutral';

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

    const q = props.qText.trim();
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

    if (props.userIdNum !== undefined) {
      chips.push(
        <FilterChip
          key="user"
          label={`user:#${props.userIdNum}`}
          onRemove={() => props.setUserId('')}
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
  }, [props.qText, props.state, props.userIdNum, smartErrors, t]);

  return (
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
          value={props.state}
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

        <Button type="button" variant="secondary" size="sm" onClick={props.onRefresh} testId="admin.payments.incoming.filters.refresh">
          {t('common.refresh')}
        </Button>

        <CopyButton
          text={props.shareUrl}
          label={t('common.copy_link')}
          size="sm"
          variant="secondary"
          testId="admin.payments.incoming.filters.copy_link"
        />

        {filtersActive ? (
          <Button type="button" variant="secondary" size="sm" onClick={clearFilters} testId="admin.payments.incoming.filters.clear">
            {t('common.clear_filters')}
          </Button>
        ) : null}
      </FilterBar>

      {activeFilterChips.length ? <div className="flex flex-wrap gap-2">{activeFilterChips}</div> : null}

      <IncomingPaymentsFiltersHelp
        helpOpen={helpOpen}
        advancedOpen={advancedOpen}
        filtersActive={filtersActive}
        userId={props.userId}
        setUserId={props.setUserId}
        setSmart={setSmart}
        smartInputRef={smartInputRef}
        setHelpOpen={setHelpOpen}
        setAdvancedOpen={setAdvancedOpen}
        clearFilters={clearFilters}
      />

    </>
  );
}
