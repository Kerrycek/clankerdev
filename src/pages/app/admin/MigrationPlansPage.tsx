import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { createMigrationPlan, fetchMigrationPlans } from '../../../lib/api/migrations';
import { searchUsers } from '../../../lib/api/users';
import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { FilterBar } from '../../../components/layout/FilterBar';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { formatDateTime } from '../../../lib/format';
import { formatErrorMessage } from '../../../lib/errors';
import { objectRef, type ObjectRef } from '../../../lib/objectRef';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import { useTierCIntervalMs } from '../../../lib/refreshTiers';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../../lib/smartFilter';

import { useChrome } from '../../../components/layout/ChromeContext';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Card } from '../../../components/ui/Card';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Drawer } from '../../../components/ui/Drawer';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterChip } from '../../../components/ui/FilterChip';
import { LoadingState } from '../../../components/ui/LoadingState';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../components/ui/SmartInputHelp';
import { TableCard } from '../../../components/ui/TableCard';
import { TableRowLink } from '../../../components/ui/TableRowLink';
import { Input } from '../../../components/ui/Input';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';
import { StatusDot } from '../../../components/ui/StatusDot';
import { toneSurfaceClass } from '../../../components/ui/tone';

const PLAN_STATES = ['staged', 'running', 'cancelling', 'failing', 'cancelled', 'done', 'error'] as const;
type PlanState = (typeof PLAN_STATES)[number];

function parsePlanState(value: string | null): PlanState | '' {
  if (!value) return '';
  return (PLAN_STATES as readonly string[]).includes(value) ? (value as PlanState) : '';
}

function safeNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

function idFromResourceRef(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'object') {
    if (typeof v.id === 'number') return v.id;
    if (typeof v.id === 'string') {
      const n = Number(v.id);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

function primaryLabelFromRef(ref: any): string | null {
  if (!ref) return null;
  if (typeof ref === 'string' && ref.trim()) return ref;
  if (typeof ref === 'number') return String(ref);
  if (typeof ref === 'object') {
    if (typeof ref.login === 'string' && ref.login) return ref.login;
    if (typeof ref.domain_name === 'string' && ref.domain_name) return ref.domain_name;
    if (typeof ref.label === 'string' && ref.label) return ref.label;
    if (typeof ref.name === 'string' && ref.name) return ref.name;
  }
  return null;
}

function formatRef(ref: any, na: string): string {
  const id = idFromResourceRef(ref);
  const label = primaryLabelFromRef(ref);
  if (label && id !== null && id !== undefined) return `${label} (#${id})`;
  if (label) return label;
  if (id !== null && id !== undefined) return `#${id}`;
  return na;
}

export function MigrationPlansPage() {
  const { basePath } = useAppMode();
  const chrome = useChrome();
  const { t } = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const qText = useMemo(() => String(searchParams.get('q') ?? ''), [searchParams]);
  const state = useMemo(() => parsePlanState(searchParams.get('state')), [searchParams]);
  const userId = useMemo(() => searchParams.get('user') ?? '', [searchParams]);

  const userIdNum = safeNumber(userId);
  const qTrim = qText.trim() || undefined;

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const smartNeedle = useMemo(() => smart.trim(), [smart]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const smartInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (smartNeedle === '?') setHelpOpen(true);
  }, [smartNeedle]);

  const setTextParam = (key: string, value: string | undefined) => {
    const v = String(value ?? '').trim();
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (v) p.set(key, v);
      else p.delete(key);
      return p;
    });
  };

  const filtersActive = Boolean(qTrim || state || userIdNum !== undefined);

  const clearFilters = () => {
    setSmart('');
    setSmartErrors([]);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('q');
      p.delete('state');
      p.delete('user');
      return p;
    });
  };

  const pagination = useKeysetPagination({
    id: 'admin.migration_plans.list',
    filterKey: JSON.stringify({ q: qTrim, state: state || undefined, userId: userIdNum, scope: basePath }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const tierCRefetchMs = useTierCIntervalMs();

  const listQ = useQuery({
    queryKey: ['migration_plans', 'list', { q: qTrim, state, userId: userIdNum, limit: pagination.limit, fromId: pagination.fromId }],
    queryFn: async () =>
      (
        await fetchMigrationPlans({
          limit: pagination.limit,
          fromId: pagination.fromId,
          q: qTrim,
          state: state || undefined,
          userId: userIdNum,
        })
      ).data,
    refetchInterval: tierCRefetchMs,
    staleTime: 10_000,
  });

  const pageData = listQ.data ?? [];
  const rows = pageData;

  const pageCursor = useMemo(() => cursorFromDescendingPage(pageData as LegacyAny), [pageData]);
  const hasMore = pageData.length >= pagination.limit;
  const canNext = pagination.hasForward || (hasMore && pageCursor !== null);
  const canPaginate = pagination.stack.length > 1 || pageData.length > 0;

  const [notice, setNotice] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [cConcurrency, setCConcurrency] = useState('10');
  const [cStopOnError, setCStopOnError] = useState(true);
  const [cSendMail, setCSendMail] = useState(true);
  const [cReason, setCReason] = useState('');

  const createdPlanRef = useRef<ObjectRef | null>(null);

  const createM = useMutation({
    mutationFn: async () => {
      const concurrency = Number(cConcurrency);
      return createMigrationPlan({
        concurrency: Number.isFinite(concurrency) ? concurrency : undefined,
        stop_on_error: cStopOnError,
        send_mail: cSendMail,
        reason: cReason.trim() || undefined,
      });
    },
    onMutate: () => {
      createdPlanRef.current = null;
      setNotice('');
    },
    onSuccess: (res) => {
      const planId = (res.data as LegacyAny)?.id as number | undefined;

      const asId = getMetaActionStateId(res.meta);
      if (asId !== undefined) {
        if (typeof planId === 'number' && Number.isFinite(planId)) {
          const ref = objectRef('MigrationPlan', planId);
          createdPlanRef.current = ref;

          // Bind a local lock as soon as we know the created object id, so the detail page
          // (which the user navigates to immediately) can gate its actions while create finishes.
          chrome.acquireLocalLock(ref, { actionStateId: asId });

          chrome.trackActionState(asId, {
            object: ref,
            actionLabelKey: 'action.migration_plan.create.label',
            objectLabel: t('admin.migration_plans.item.title', { id: planId }),
          });
        } else {
          chrome.trackActionState(asId, { actionLabelKey: 'action.migration_plan.create.label' });
        }
      }

      setNotice(t('admin.migration_plans.notice.created'));
      setCreateOpen(false);
      void qc.invalidateQueries({ queryKey: ['migration_plans'] });

      // Reset form defaults.
      setCConcurrency('10');
      setCStopOnError(true);
      setCSendMail(true);
      setCReason('');

      if (typeof planId === 'number' && Number.isFinite(planId)) {
        navigate(`${basePath}/migration-plans/${planId}`);
      }
    },
    onSettled: () => {
      if (createdPlanRef.current) {
        chrome.releaseLocalLock(createdPlanRef.current);
        createdPlanRef.current = null;
      }
    },
  });
  const na = t('common.na');

  const stateLabel = (st: unknown): string => {
    const s = String(st ?? '');
    if (s === 'staged') return t('migration_plan.state.staged');
    if (s === 'running') return t('migration_plan.state.running');
    if (s === 'cancelling') return t('migration_plan.state.cancelling');
    if (s === 'failing') return t('migration_plan.state.failing');
    if (s === 'cancelled') return t('migration_plan.state.cancelled');
    if (s === 'done') return t('migration_plan.state.done');
    if (s === 'error') return t('migration_plan.state.error');
    return s || t('migration_plan.state.unknown');
  };

  const badgeForState = (st: unknown): { variant: React.ComponentProps<typeof Badge>['variant']; label: string } => {
    const s = String(st ?? 'unknown');
    if (s === 'done') return { variant: 'ok', label: stateLabel(s) };
    if (s === 'running') return { variant: 'black', label: stateLabel(s) };
    if (s === 'staged' || s === 'cancelled') return { variant: 'neutral', label: stateLabel(s) };
    if (s === 'cancelling' || s === 'failing') return { variant: 'warn', label: stateLabel(s) };
    if (s === 'error') return { variant: 'danger', label: stateLabel(s) };
    return { variant: 'neutral', label: stateLabel(s) };
  };

  const rowVariantForState = (st: unknown): 'ok' | 'info' | 'warn' | 'danger' | 'neutral' => {
    const s = String(st ?? 'unknown');
    if (s === 'done') return 'ok';
    if (s === 'running') return 'info';
    if (s === 'cancelling' || s === 'failing') return 'warn';
    if (s === 'error') return 'danger';
    return 'neutral';
  };

  const dotVariantForState = (st: unknown): 'ok' | 'info' | 'warn' | 'danger' | 'neutral' => {
    const s = String(st ?? 'unknown');
    if (s === 'done') return 'ok';
    if (s === 'running') return 'info';
    if (s === 'cancelling' || s === 'failing') return 'warn';
    if (s === 'error') return 'danger';
    return 'neutral';
  };

  const shareUrl = useMemo(() => (typeof window !== 'undefined' ? window.location.href : ''), [searchParams]);

  const openPlan = (planId: number) => {
    navigate(`${basePath}/migration-plans/${planId}`);
  };

  const resolveStateValue = (raw: string): PlanState | '' | null => {
    const v = String(raw ?? '').trim().toLowerCase();
    if (!v || v === 'all' || v === '*' || v === 'any') return '';
    if ((PLAN_STATES as readonly string[]).includes(v)) return v as PlanState;

    const matches = PLAN_STATES.filter((s) => s.startsWith(v));
    if (matches.length === 1) return matches[0] ?? null;
    return null;
  };

  const canonicalKey = (rawKey: string): 'q' | 'state' | 'user' | 'id' | null => {
    const k = String(rawKey ?? '').trim().toLowerCase();
    if (!k) return null;
    if (k === 'q' || k === 'search' || k === 's' || k === 'text') return 'q';
    if (k === 'state' || k === 'st') return 'state';
    if (k === 'user' || k === 'u' || k === 'owner') return 'user';
    if (k === 'id' || k === '#') return 'id';
    return null;
  };

  const debouncedNeedle = useDebouncedValue(smartNeedle, 200);
  const userSuggestEnabled =
    smartNeedle.length >= 2 && debouncedNeedle === smartNeedle && !smartNeedle.includes(':') && parseNumericToken(smartNeedle) === null;

  const userSuggestQuery = useQuery({
    queryKey: ['users', 'search', { q: debouncedNeedle, limit: 8 }],
    enabled: userSuggestEnabled,
    queryFn: async () => (await searchUsers({ q: debouncedNeedle, limit: 8 })).data,
    staleTime: 10_000,
  });

  async function applySmartText(raw: string) {
    const input = String(raw ?? '').trim();
    if (!input) return;

    if (input === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(input).map((x) => x.trim()).filter(Boolean);

    // Numeric → open plan
    const numericOnly = tokens.length === 1 ? parseNumericToken(tokens[0] ?? '') : null;
    if (numericOnly !== null) {
      setSmart('');
      setSmartErrors([]);
      openPlan(numericOnly);
      return;
    }

    let nextQ = qText;
    let nextState = state;
    let nextUser = userId;
    const free: string[] = [];
    const errors: string[] = [];

    for (const tok of tokens) {
      const kv = splitKeyValueToken(tok);

      if (!kv) {
        free.push(unquoteSmartValue(tok));
        continue;
      }

      const key = canonicalKey(kv.rawKey);
      const value = unquoteSmartValue(kv.rawValue);

      if (!key) {
        errors.push(t('filters.smart.error.unknown_key', { key: kv.rawKey }));
        continue;
      }

      if (key === 'q') {
        if (!value.trim()) {
          errors.push(t('filters.smart.error.missing_value', { key: kv.rawKey }));
          continue;
        }
        nextQ = value;
        continue;
      }

      if (key === 'state') {
        const st = resolveStateValue(value);
        if (st === null) {
          errors.push(t('admin.migration_plans.smart.error.state', { value }));
          continue;
        }
        nextState = st;
        continue;
      }

      if (key === 'user') {
        if (!value.trim()) {
          errors.push(t('filters.smart.error.missing_value', { key: kv.rawKey }));
          continue;
        }

        const n = parseNumericToken(value);
        if (n !== null) {
          nextUser = String(n);
          continue;
        }

        const users = (await searchUsers({ q: value, limit: 10 })).data;
        const exact = users.filter((u) => u.login.toLowerCase() === value.toLowerCase());
        if (exact.length === 1) {
          nextUser = String(exact[0]?.id);
          continue;
        }

        errors.push(t('filters.smart.error.user_unresolved', { value }));
        continue;
      }

      if (key === 'id') {
        const n = parseNumericToken(value);
        if (n !== null) {
          setSmart('');
          setSmartErrors([]);
          openPlan(n);
          return;
        }

        errors.push(t('admin.migration_plans.smart.error.id_numeric_only', { value }));
        continue;
      }

      errors.push(t('filters.smart.error.unknown_key', { key: kv.rawKey }));
    }

    if (free.length > 0) nextQ = free.join(' ');

    setTextParam('q', nextQ.trim() || undefined);
    setTextParam('state', nextState || undefined);
    setTextParam('user', nextUser.trim() || undefined);

    setSmart('');
    setSmartErrors(errors);

    if (errors.length > 0) {
      toasts.pushToast({ variant: 'danger', title: errors[0] ?? t('common.unknown_error') });
    }
  }

  const smartSuggestions: SmartFilterSuggestion[] = useMemo(() => {
    const out: SmartFilterSuggestion[] = [];
    const needle = smartNeedle;
    if (!needle) return out;

    if (needle === '?') {
      out.push({
        id: 'help',
        primary: t('filters.help.open'),
        secondary: t('filters.help.suggestion.secondary'),
        onPick: () => setHelpOpen(true),
        testId: 'admin.migration_plans.smart.suggest.help',
      });
      return out;
    }

    const num = parseNumericToken(needle);
    if (num !== null) {
      out.push({
        id: `open.${num}`,
        primary: t('admin.migration_plans.smart.suggest.open', { id: num }),
        secondary: t('admin.migration_plans.smart.suggest.open.secondary'),
        onPick: () => {
          openPlan(num);
          setSmart('');
        },
        testId: 'admin.migration_plans.smart.suggest.open',
      });
    }

    const low = needle.toLowerCase();
    const stateCandidates = low ? PLAN_STATES.filter((s) => s.startsWith(low)) : [];
    if (stateCandidates.length > 0 && stateCandidates.length <= 4) {
      for (const st of stateCandidates) {
        out.push({
          id: `state.${st}`,
          primary: `state:${st}`,
          secondary: t('admin.migration_plans.smart.suggest.state', { state: stateLabel(st) }),
          onPick: () => {
            setTextParam('state', st);
            setSmart('');
          },
        });
      }
    }

    if (userSuggestQuery.data && userSuggestQuery.data.length > 0) {
      for (const u of userSuggestQuery.data.slice(0, 5)) {
        out.push({
          id: `user.${u.id}`,
          primary: `user:${u.login}`,
          secondary: t('admin.migration_plans.smart.suggest.user', { id: u.id, login: u.login }),
          onPick: () => {
            setTextParam('user', String(u.id));
            setSmart('');
          },
        });
      }
    }

    out.push({
      id: 'search',
      primary: t('admin.migration_plans.smart.suggest.search', { q: needle }),
      secondary: t('admin.migration_plans.smart.suggest.search.secondary'),
      onPick: () => {
        setTextParam('q', needle);
        setSmart('');
      },
      testId: 'admin.migration_plans.smart.suggest.search',
    });

    return out;
  }, [openPlan, smartNeedle, stateLabel, t, userSuggestQuery.data]);

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];

    if (qTrim) {
      chips.push(
        <FilterChip
          key="q"
          label={`q:${qTrim}`}
          tone="neutral"
          onRemove={() => setTextParam('q', undefined)}
          testId="admin.migration_plans.chip.q"
        />
      );
    }

    if (state) {
      chips.push(
        <FilterChip
          key="state"
          label={`state:${state}`}
          tone="neutral"
          onRemove={() => setTextParam('state', undefined)}
          testId="admin.migration_plans.chip.state"
        />
      );
    }

    if (userIdNum !== undefined) {
      chips.push(
        <FilterChip
          key="user"
          label={`user:${userIdNum}`}
          tone="neutral"
          onRemove={() => setTextParam('user', undefined)}
          testId="admin.migration_plans.chip.user"
        />
      );
    }

    smartErrors.forEach((e, idx) => {
      chips.push(
        <FilterChip
          key={`err.${idx}`}
          label={e}
          tone="danger"
          onRemove={() => setSmartErrors((prev) => prev.filter((_, i) => i !== idx))}
          testId={`admin.migration_plans.chip.error.${idx}`}
        />
      );
    });

    return chips;
  }, [qTrim, setTextParam, smartErrors, state, userIdNum]);

  return (
    <ListShell
      testId="admin.migration_plans.page"
      header={
        <PageHeader
          title={t('admin.migration_plans.title')}
          description={t('admin.migration_plans.subtitle')}
          meta={filtersActive ? <span className="text-xs text-faint">{t('list.meta.filters_active')}</span> : null}
          testId="admin.migration_plans.list.header"
          actions={
            <Button onClick={() => setCreateOpen(true)} testId="admin.migration_plans.create.open">
              {t('admin.migration_plans.create.open_label')}
            </Button>
          }
        />
      }
      filters={
        <>
          <FilterBar testId="admin.migration_plans.list.filters">
            <div className="w-full sm:max-w-xl">
              <SmartFilterInput
                ref={smartInputRef}
                value={smart}
                onChange={(v) => {
                  setSmart(v);
                  if (smartErrors.length) setSmartErrors([]);
                }}
                placeholder={t('admin.migration_plans.smart.placeholder')}
                ariaLabel={t('admin.migration_plans.smart.placeholder')}
                testId="admin.migration_plans.smart_filter.input"
                suggestions={smartSuggestions}
                onSubmit={() => void applySmartText(smart)}
                suffix={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 px-0"
                    onClick={() => setHelpOpen(true)}
                    aria-label={t('filters.help.open')}
                    title={t('filters.help.open')}
                  >
                    <CircleHelp className="h-4 w-4" aria-hidden />
                  </Button>
                }
              />

              {activeFilterChips.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1" data-testid="admin.migration_plans.active_filters">
                  {activeFilterChips}
                </div>
              ) : null}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAdvancedOpen(true)}
              aria-label={t('filters.advanced.open')}
              title={t('filters.advanced.open')}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              <span className="ml-2 hidden sm:inline">{t('filters.advanced.label')}</span>
            </Button>

            <CopyButton
              size="sm"
              variant="secondary"
              label={t('common.copy_link')}
              text={shareUrl}
              testId="admin.migration_plans.copy_link"
            />

            {filtersActive ? (
              <Button variant="secondary" size="sm" onClick={clearFilters} testId="admin.migration_plans.filter.clear">
                {t('common.clear_filters')}
              </Button>
            ) : null}
          </FilterBar>

          <SmartInputHelp
            open={helpOpen}
            onClose={() => setHelpOpen(false)}
            title={t('admin.migration_plans.smart_help.title')}
            intro={t('admin.migration_plans.smart_help.intro')}
            examples={[
              { example: '?', description: t('admin.migration_plans.smart_help.examples.help') },
              { example: '123', description: t('admin.migration_plans.smart_help.examples.open') },
              { example: 'state:running', description: t('admin.migration_plans.smart_help.examples.state') },
              { example: 'user:alice', description: t('admin.migration_plans.smart_help.examples.user') },
              { example: 'q:maintenance', description: t('admin.migration_plans.smart_help.examples.search') },
            ]}
            topKeys={[
              { key: 'q', description: t('admin.migration_plans.smart_help.keys.q'), example: 'q:maintenance' },
              { key: 'state', description: t('admin.migration_plans.smart_help.keys.state'), example: 'state:running' },
              { key: 'user', description: t('admin.migration_plans.smart_help.keys.user'), example: 'user:alice' },
              { key: 'id', description: t('admin.migration_plans.smart_help.keys.id'), example: 'id:123' },
            ]}
            inference={[
              t('admin.migration_plans.smart_help.inference.enter'),
              t('admin.migration_plans.smart_help.inference.numeric'),
              t('admin.migration_plans.smart_help.inference.advanced'),
            ]}
            onInsertKey={(key) => {
              const prefix = `${key}:`;
              setSmart(prefix);
              setHelpOpen(false);
              window.setTimeout(() => smartInputRef.current?.focus(), 0);
            }}
            actions={[
              {
                label: t('filters.advanced.label'),
                onClick: () => {
                  setHelpOpen(false);
                  setAdvancedOpen(true);
                },
                variant: 'secondary',
              },
            ]}
            testId="admin.migration_plans.smart_help"
            keyRowTestIdPrefix="admin.migration_plans.smart_help.key"
          />

          <Drawer
            open={advancedOpen}
            onClose={() => setAdvancedOpen(false)}
            title={t('filters.advanced.title')}
            width="lg"
            testId="admin.migration_plans.advanced.drawer"
          >
            <div className="space-y-4">
              <div className="text-sm text-muted">{t('admin.migration_plans.advanced.hint')}</div>

              <div>
                <div className="text-xs font-medium text-faint">{t('admin.migration_plans.advanced.q.label')}</div>
                <Input
                  value={qText}
                  onChange={(e) => setTextParam('q', e.target.value)}
                  placeholder={t('admin.migration_plans.smart.placeholder')}
                  testId="admin.migration_plans.advanced.q"
                />
              </div>

              <div>
                <div className="text-xs font-medium text-faint">{t('admin.migration_plans.filter.state.label')}</div>
                <Select
                  value={state}
                  onChange={(e) => setTextParam('state', e.target.value || undefined)}
                  className="w-56"
                  testId="admin.migration_plans.filter.state"
                >
                  <option value="">{t('admin.migration_plans.filter.state.all')}</option>
                  {PLAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {stateLabel(st)}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <div className="text-xs font-medium text-faint">{t('admin.migration_plans.filter.user.label')}</div>
                <UserLookupInput
                  value={userId}
                  setValue={(v) => setTextParam('user', v || undefined)}
                  placeholder={t('admin.migration_plans.filter.user.placeholder')}
                  testId="admin.migration_plans.filter.user"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {filtersActive ? (
                  <Button variant="secondary" onClick={clearFilters} testId="admin.migration_plans.advanced.clear">
                    {t('common.clear_filters')}
                  </Button>
                ) : null}

                <Button variant="primary" onClick={() => setAdvancedOpen(false)}>
                  {t('common.done')}
                </Button>
              </div>
            </div>
          </Drawer>
        </>
      }
    >
      {notice ? (
        <Alert title={t('common.info')} variant="info">
          {notice}
        </Alert>
      ) : null}

      <Modal
        open={createOpen}
        onClose={() => {
          if (!createM.isPending) setCreateOpen(false);
        }}
        title={t('admin.migration_plans.create.title')}
      >
        <div className="space-y-4">
          <div>
            <div className="text-xs text-faint">{t('admin.migration_plan.field.concurrency')}</div>
            <Input
              value={cConcurrency}
              onChange={(e) => setCConcurrency(e.target.value)}
              type="number"
              disabled={createM.isPending}
              testId="admin.migration_plans.create.concurrency"
            />
            <div className="mt-1 text-xs text-faint">{t('admin.migration_plans.create.concurrency_help')}</div>
          </div>

          <div className="space-y-2">
            <Checkbox
              checked={cStopOnError}
              onChange={setCStopOnError}
              label={t('common.stop_on_error')}
              description={t('admin.migration_plans.create.stop_on_error_help')}
              disabled={createM.isPending}
              testId="admin.migration_plans.create.stop_on_error"
            />

            <Checkbox
              checked={cSendMail}
              onChange={setCSendMail}
              label={t('common.send_mail')}
              description={t('admin.migration_plans.create.send_mail_help')}
              disabled={createM.isPending}
              testId="admin.migration_plans.create.send_mail"
            />
          </div>

          <div>
            <div className="text-xs text-faint">
              {t('admin.migration_plans.create.reason.label')} <span className="text-faint">({t('common.optional')})</span>
            </div>
            <Input
              value={cReason}
              onChange={(e) => setCReason(e.target.value)}
              placeholder={t('admin.migration_plans.create.reason.placeholder')}
              disabled={createM.isPending}
              testId="admin.migration_plans.create.reason"
            />
          </div>

          {createM.isError ? (
            <Alert title={t('admin.migration_plans.create.error_title')} variant="danger">
              {formatErrorMessage(createM.error)}
            </Alert>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={createM.isPending}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => createM.mutate()} disabled={createM.isPending} testId="admin.migration_plans.create.submit">
              {createM.isPending ? t('common.creating') : t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>

      {listQ.isLoading ? (
        <LoadingState testId="admin.migration_plans.loading" />
      ) : listQ.isError ? (
        <ErrorState
          testId="admin.migration_plans.error"
          title={t('admin.migration_plans.load_error')}
          error={listQ.error}
          onRetry={() => void listQ.refetch()}
          showBack={false}
          detailsExtra={{ page: 'admin.migration_plans' }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          testId="admin.migration_plans.empty"
          title={filtersActive ? t('empty.list.no_matches.title') : t('admin.migration_plans.empty')}
          body={filtersActive ? t('empty.list.no_matches.body') : undefined}
          actionLabel={filtersActive ? t('common.clear_filters') : undefined}
          onAction={filtersActive ? clearFilters : undefined}
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((p) => {
                const st = badgeForState((p as LegacyAny).state);
                const rowVariant = rowVariantForState((p as LegacyAny).state);
                const dotVariant = dotVariantForState((p as LegacyAny).state);
                const id = Number((p as LegacyAny).id);
                const label = String((p as LegacyAny).label ?? '').trim() || na;
                const userLabel = formatRef((p as LegacyAny).user, na);
                const nodeLabel = formatRef((p as LegacyAny).node, na);
                const vpsCount = (p as LegacyAny).vps_count;
                const vpsCountStr = vpsCount === undefined || vpsCount === null ? na : String(vpsCount);
                const asId =
                  (typeof (p as LegacyAny).action_state_id === 'number' && Number.isFinite((p as LegacyAny).action_state_id)
                    ? Number((p as LegacyAny).action_state_id)
                    : undefined) ?? getMetaActionStateId((p as LegacyAny)._meta);

                return (
                  <Card key={id} testId={`admin.migration_plans.card.${id}`} className={toneSurfaceClass(rowVariant)}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <StatusDot variant={dotVariant} testId={`admin.migration_plans.card.${id}.dot`} />
                            <Link
                              className="block truncate text-base font-semibold text-accent hover:underline"
                              to={`${basePath}/migration-plans/${id}`}
                            >
                              {t('admin.migration_plans.item.title', { id })}
                            </Link>
                          </div>
                          <div className="mt-0.5 text-xs text-faint">{label}</div>
                        </div>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-muted">
                        <div>
                          <span className="text-faint">{t('common.user')}:</span> {userLabel}
                        </div>
                        <div>
                          <span className="text-faint">{t('common.node')}:</span> {nodeLabel}
                        </div>
                        <div>
                          <span className="text-faint">{t('common.vps_count')}:</span> {vpsCountStr}
                        </div>
                        {(p as LegacyAny).created_at ? (
                          <div>
                            <span className="text-faint">{t('common.created')}:</span> {formatDateTime(String((p as LegacyAny).created_at))}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {asId ? (
                          <Link className="text-xs text-accent hover:underline" to={`${basePath}/action-states?id=${String(asId)}`}>
                            {t('common.action_state')} #{String(asId)}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>

          {canPaginate ? (
            <Card className="md:hidden">
              <KeysetPagination
                page={pagination.page}
                pageCount={pagination.stack.length}
                canPrev={pagination.canPrev}
                canNext={canNext}
                onPrev={pagination.goPrev}
                onNext={() => pagination.goNext(pageCursor)}
                onGoToPage={pagination.goToPage}
                limit={pagination.limit}
                allowedLimits={pagination.allowedLimits}
                onLimitChange={pagination.setLimit}
                testId="admin.migration_plans.pagination.mobile"
              />
            </Card>
          ) : null}

          {/* Desktop: table */}
          <TableCard
            className="hidden md:block"
            minWidth="lg"
            tableTestId="admin.migration_plans.table"
            footer={
              canPaginate ? (
                <KeysetPagination
                  page={pagination.page}
                  pageCount={pagination.stack.length}
                  canPrev={pagination.canPrev}
                  canNext={canNext}
                  onPrev={pagination.goPrev}
                  onNext={() => pagination.goNext(pageCursor)}
                  onGoToPage={pagination.goToPage}
                  limit={pagination.limit}
                  allowedLimits={pagination.allowedLimits}
                  onLimitChange={pagination.setLimit}
                  testId="admin.migration_plans.pagination.desktop"
                />
              ) : null
            }
          >
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="w-8 px-4 py-2"><span className="sr-only">{t('common.state')}</span></th>
                <th className="px-4 py-2">{t('common.id')}</th>
                <th className="px-4 py-2">{t('common.label')}</th>
                <th className="px-4 py-2">{t('common.state')}</th>
                <th className="px-4 py-2">{t('common.user')}</th>
                <th className="px-4 py-2">{t('common.node')}</th>
                <th className="px-4 py-2">{t('common.vps_count')}</th>
                <th className="px-4 py-2">{t('common.created')}</th>
                <th className="px-4 py-2">{t('common.action_state')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const st = badgeForState((p as LegacyAny).state);
                const rowVariant = rowVariantForState((p as LegacyAny).state);
                const dotVariant = dotVariantForState((p as LegacyAny).state);
                const id = Number((p as LegacyAny).id);
                const label = String((p as LegacyAny).label ?? '').trim() || na;
                const userLabel = formatRef((p as LegacyAny).user, na);
                const nodeLabel = formatRef((p as LegacyAny).node, na);
                const vpsCount = (p as LegacyAny).vps_count;
                const vpsCountStr = vpsCount === undefined || vpsCount === null ? na : String(vpsCount);
                const asId =
                  (typeof (p as LegacyAny).action_state_id === 'number' && Number.isFinite((p as LegacyAny).action_state_id)
                    ? Number((p as LegacyAny).action_state_id)
                    : undefined) ?? getMetaActionStateId((p as LegacyAny)._meta);

                return (
                  <TableRowLink
                    key={id}
                    testId={`admin.migration_plans.row.${id}`}
                    to={`${basePath}/migration-plans/${id}`}
                    variant={rowVariant}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <td className="px-4 py-2">
                      <StatusDot variant={dotVariant} testId={`admin.migration_plans.row.${id}.dot`} ariaLabel={st.label} />
                    </td>
                    <td className="px-4 py-2">
                      <Link className="font-medium text-accent hover:underline" to={`${basePath}/migration-plans/${id}`}>
                        #{id}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted">{label}</td>
                    <td className="px-4 py-2">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted">{userLabel}</td>
                    <td className="px-4 py-2 text-xs text-muted">{nodeLabel}</td>
                    <td className="px-4 py-2 text-xs text-muted">{vpsCountStr}</td>
                    <td className="px-4 py-2 text-xs text-muted">{(p as LegacyAny).created_at ? formatDateTime(String((p as LegacyAny).created_at)) : na}</td>
                    <td className="px-4 py-2 text-xs">
                      {asId ? (
                        <Link className="text-accent hover:underline" to={`${basePath}/action-states?id=${String(asId)}`}>
                          #{String(asId)}
                        </Link>
                      ) : (
                        <span className="text-faint">{na}</span>
                      )}
                    </td>
                  </TableRowLink>
                );
              })}
            </tbody>
          </TableCard>
        </>
      )}
    </ListShell>
  );
}
