import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueries } from '@tanstack/react-query';
import { CircleHelp, Pin, PinOff, SlidersHorizontal } from 'lucide-react';

import { cancelActionState, fetchActionState, fetchActionStates, type ActionState } from '../../lib/api/actionStates';
import { useAppMode } from '../../app/appMode';
import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';
import { FilterBar } from '../../components/layout/FilterBar';
import { ListShell } from '../../components/layout/ListShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { useChrome } from '../../components/layout/ChromeContext';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { StatusDot } from '../../components/ui/StatusDot';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Checkbox } from '../../components/ui/Checkbox';
import { CopyButton } from '../../components/ui/CopyButton';
import { Drawer } from '../../components/ui/Drawer';
import { FilterChip } from '../../components/ui/FilterChip';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../components/ui/SmartInputHelp';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { KeysetPagination } from '../../components/ui/KeysetPagination';
import { LoadingState } from '../../components/ui/LoadingState';
import { Select } from '../../components/ui/Select';
import { clsx } from '../../components/ui/clsx';
import { toneProgressFillClass, toneSurfaceClass, type ToneVariant } from '../../components/ui/tone';
import { formatDateTime } from '../../lib/format';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../lib/smartFilter';
import { useKeysetPagination } from '../../lib/hooks/useKeysetPagination';
import { cursorFromAscendingPage, cursorFromDescendingPage } from '../../lib/lockIndex';
import { extractRelatedTransactionChainIdFromActionState } from '../../lib/taskLinks';
import {
  actionStateBadge,
  actionStateProgressLabel,
  actionStateProgressPercent,
  isFailingActionState,
  isFinishedActionState,
} from '../../lib/taskStatus';
import { useActionStatePollIntervalMs, useTierAIntervalMs } from '../../lib/refreshTiers';

function normalizeIds(ids: number[], limit: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const raw of ids) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    const id = Math.floor(n);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= limit) break;
  }
  return out;
}

type SmartKey = 'q' | 'errors' | 'order' | 'id';

function canonicalKey(raw: string): SmartKey | null {
  const k = raw.trim().toLowerCase();
  if (!k) return null;

  if (['q', 'query', 'label', 'name', 'search', 'text'].includes(k)) return 'q';
  if (['errors', 'error', 'err', 'failed', 'fail'].includes(k)) return 'errors';
  if (['order', 'sort'].includes(k)) return 'order';
  if (['id', '#', 'action', 'action_state', 'action_state_id', 'as'].includes(k)) return 'id';
  return null;
}

function parseBoolToken(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return null;
}

function parseOrderToken(value: string): 'newest' | 'oldest' | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === 'newest' || v === 'latest' || v === 'desc' || v === 'down') return 'newest';
  if (v === 'oldest' || v === 'asc' || v === 'up') return 'oldest';
  return null;
}

export function ActionStatesPage() {
  const { basePath } = useAppMode();
  const chrome = useChrome();
  const { t } = useI18n();
  const navigate = useNavigate();
  const toasts = useToasts();

  const actionPollMs = useActionStatePollIntervalMs();
  const tierARefetchMs = useTierAIntervalMs();
  const [sp, setSp] = useSearchParams();

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const smartNeedle = smart.trim();
  const smartInputRef = useRef<HTMLInputElement>(null);

  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const order = useMemo(() => {
    const raw = sp.get('order');
    return raw === 'oldest' ? 'oldest' : 'newest';
  }, [sp]);

  const qText = useMemo(() => sp.get('q') ?? '', [sp]);
  const errorsOnly = useMemo(() => sp.get('errors') === '1', [sp]);
  const needle = useMemo(() => qText.trim().toLowerCase(), [qText]);

  const filtersActive = Boolean(qText.trim() || errorsOnly);

  const setOrderInUrl = (next: 'newest' | 'oldest') => {
    setSp((prev) => {
      const p = new URLSearchParams(prev);
      p.set('order', next);
      return p;
    });
  };

  const setQueryInUrl = (next: string) => {
    setSp((prev) => {
      const p = new URLSearchParams(prev);
      if (next.trim()) p.set('q', next);
      else p.delete('q');
      return p;
    });
  };

  const setErrorsOnlyInUrl = (next: boolean) => {
    setSp((prev) => {
      const p = new URLSearchParams(prev);
      if (next) p.set('errors', '1');
      else p.delete('errors');
      return p;
    });
  };

  const clearFilters = () => {
    setSmart('');
    setSmartErrors([]);

    setSp((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('q');
      p.delete('errors');
      // keep order
      return p;
    });
  };

  const applySmartText = (raw: string) => {
    const input = raw.trim();
    if (!input) return;

    if (input === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(input)
      .map((t) => t.trim())
      .filter(Boolean);

    const firstToken = tokens[0];
    const numericOnly = tokens.length === 1 && firstToken ? parseNumericToken(firstToken) : null;
    if (numericOnly !== null) {
      setSmart('');
      setSmartErrors([]);
      navigate(`${basePath}/action-states/${numericOnly}`);
      return;
    }

    let nextOrder: 'newest' | 'oldest' = order;
    let nextQ = qText;
    let nextErrors = errorsOnly;

    const free: string[] = [];
    const errs: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (kv) {
        const rawKey = kv.rawKey;
        const rawValue = kv.rawValue;
        const value = unquoteSmartValue(rawValue);

        const key = canonicalKey(rawKey);
        if (!key) {
          errs.push(t('filters.smart.error.unknown_key', { key: rawKey }));
          continue;
        }

        if (!value.trim() && key !== 'errors') {
          errs.push(t('filters.smart.error.missing_value', { key: rawKey.trim() }));
          continue;
        }

        if (key === 'id') {
          const n = parseNumericToken(value);
          if (n === null) errs.push(t('action_states.smart.error.id_numeric_only', { value }));
          else {
            setSmart('');
            setSmartErrors([]);
            navigate(`${basePath}/action-states/${n}`);
            return;
          }
          continue;
        }

        if (key === 'order') {
          const o = parseOrderToken(value);
          if (!o) errs.push(t('action_states.smart.error.invalid_order', { value }));
          else nextOrder = o;
          continue;
        }

        if (key === 'q') {
          nextQ = value;
          continue;
        }

        if (key === 'errors') {
          if (!value.trim()) {
            nextErrors = true;
            continue;
          }
          const b = parseBoolToken(value);
          if (b === null) errs.push(t('action_states.smart.error.invalid_bool', { value }));
          else nextErrors = b;
          continue;
        }

        errs.push(t('filters.smart.error.unknown_key', { key: rawKey }));
        continue;
      }

      const plain = unquoteSmartValue(token);
      const low = plain.trim().toLowerCase();
      if (low === 'errors' || low === 'error' || low === 'failed' || low === 'fail') {
        nextErrors = true;
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
      p.set('order', nextOrder);
      if (nextQ.trim()) p.set('q', nextQ);
      else p.delete('q');
      if (nextErrors) p.set('errors', '1');
      else p.delete('errors');
      return p;
    });

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
          testId: 'action_states.smart_filter.suggest.help',
        },
      ];
    }

    const suggestions: SmartFilterSuggestion[] = [];
    const numeric = parseNumericToken(needle);
    if (numeric !== null) {
      const id = String(numeric);
      suggestions.push({
        id: `open:${id}`,
        primary: t('action_states.smart.suggest.open_action_state', { id }),
        secondary: t('action_states.smart.suggest.open_action_state.secondary'),
        onPick: () => navigate(`${basePath}/action-states/${numeric}`),
        testId: 'action_states.smart_filter.suggest.open',
      });
      return suggestions;
    }

    if (needle.includes(':')) {
      suggestions.push({
        id: 'apply',
        primary: t('filters.smart.suggest.apply.primary'),
        secondary: t('filters.smart.suggest.apply.secondary'),
        onPick: () => applySmartText(needle),
        testId: 'action_states.smart_filter.suggest.apply',
      });
      return suggestions;
    }

    const low = needle.trim().toLowerCase();
    if (low === 'errors' || low === 'error' || low === 'failed' || low === 'fail') {
      suggestions.push({
        id: 'errors',
        primary: errorsOnly ? t('action_states.smart.suggest.errors_off') : t('action_states.smart.suggest.errors_on'),
        secondary: errorsOnly
          ? t('action_states.smart.suggest.errors_off.secondary')
          : t('action_states.smart.suggest.errors_on.secondary'),
        onPick: () => {
          setErrorsOnlyInUrl(!errorsOnly);
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'action_states.smart_filter.suggest.errors',
      });
      return suggestions;
    }

    suggestions.push({
      id: 'search',
      primary: t('action_states.smart.suggest.search', { value: needle }),
      secondary: t('action_states.smart.suggest.search.secondary'),
      onPick: () => {
        setQueryInUrl(needle);
        setSmart('');
        setSmartErrors([]);
      },
      testId: 'action_states.smart_filter.suggest.search',
    });

    return suggestions;
  }, [applySmartText, basePath, errorsOnly, navigate, order, qText, setErrorsOnlyInUrl, setQueryInUrl, smartNeedle, t]);

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];

    const q = qText.trim();
    if (q) {
      chips.push(
        <FilterChip
          key="q"
          label={`q:${q}`}
          onRemove={() => setQueryInUrl('')}
          testId="action_states.chip.q"
        />
      );
    }

    if (errorsOnly) {
      chips.push(
        <FilterChip
          key="errors"
          label="errors"
          tone="danger"
          onRemove={() => setErrorsOnlyInUrl(false)}
          testId="action_states.chip.errors"
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
          testId={`action_states.chip.error.${idx}`}
        />
      );
    });

    return chips;
  }, [errorsOnly, qText, setErrorsOnlyInUrl, setQueryInUrl, smartErrors]);

  const pagination = useKeysetPagination({
    id: 'action_states.list',
    filterKey: JSON.stringify({ order, q: qText.trim(), errors: errorsOnly, scope: basePath }),
    searchParams: sp,
    setSearchParams: setSp,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const trackedIds = useMemo(
    () => normalizeIds(chrome.trackedActionStates.map((x) => x.id), 50),
    [chrome.trackedActionStates]
  );
  const trackedSet = useMemo(() => new Set<number>(trackedIds), [trackedIds]);

  const pinnedIds = useMemo(
    () => normalizeIds(chrome.pinnedActionStates, 50),
    [chrome.pinnedActionStates]
  );
  const pinnedSet = useMemo(() => new Set<number>(pinnedIds), [pinnedIds]);

  const pinnedQs = useQueries({
    queries: pinnedIds.map((id) => ({
      queryKey: ['action_state', 'show', { id }],
      queryFn: async () => (await fetchActionState(id)).data,
      enabled: Number.isFinite(id) && id > 0,
      refetchInterval: (data: unknown) => (data && isFinishedActionState(data as LegacyAny) ? false : actionPollMs),
    })),
  });

  const trackedQs = useQueries({
    queries: trackedIds.map((id) => ({
      queryKey: ['action_state', 'show', { id }],
      queryFn: async () => (await fetchActionState(id)).data,
      enabled: Number.isFinite(id) && id > 0,
      refetchInterval: (data: unknown) => (data && isFinishedActionState(data as LegacyAny) ? false : actionPollMs),
    })),
  });

  const q = useQuery({
    queryKey: ['action_states', 'index', { limit: pagination.limit, fromId: pagination.fromId, order }],
    queryFn: async () =>
      (
        await fetchActionStates({
          limit: pagination.limit,
          fromId: pagination.fromId,
          order,
        })
      ).data,
    refetchInterval: tierARefetchMs,
  });

  const pageCursor = useMemo(() => {
    const rows = q.data as LegacyAny;
    return order === 'oldest' ? cursorFromAscendingPage(rows) : cursorFromDescendingPage(rows);
  }, [order, q.data]);

  const hasMore = (q.data ?? []).length >= pagination.limit;

  const merged = useMemo(() => {
    const map = new Map<number, { s: ActionState; tracked: boolean; pinned: boolean }>();

    const upsert = (sid: number, s: ActionState, flags: { tracked?: boolean; pinned?: boolean }) => {
      const prev = map.get(sid);
      if (prev) {
        map.set(sid, {
          s: s ?? prev.s,
          tracked: prev.tracked || Boolean(flags.tracked),
          pinned: prev.pinned || Boolean(flags.pinned),
        });
      } else {
        map.set(sid, {
          s,
          tracked: Boolean(flags.tracked),
          pinned: Boolean(flags.pinned),
        });
      }
    };

    // Pinned first (so we always include them even if outside `limit`)
    for (let i = 0; i < pinnedIds.length; i++) {
      const id = pinnedIds[i];
      const q2 = pinnedQs[i];
      if (!id || !q2?.data) continue;
      const s = q2.data as LegacyAny as ActionState;
      const sid = Number((s as LegacyAny).id ?? id);
      if (!Number.isFinite(sid) || sid <= 0) continue;
      upsert(sid, s, { pinned: true });
    }

    // Tracked next
    for (let i = 0; i < trackedIds.length; i++) {
      const id = trackedIds[i];
      const q2 = trackedQs[i];
      if (!id || !q2?.data) continue;
      const s = q2.data as LegacyAny as ActionState;
      const sid = Number((s as LegacyAny).id ?? id);
      if (!Number.isFinite(sid) || sid <= 0) continue;
      upsert(sid, s, { tracked: true, pinned: pinnedSet.has(sid) });
    }

    // Then the index list
    for (const s0 of q.data ?? []) {
      const s = s0 as LegacyAny as ActionState;
      const id = Number((s as LegacyAny)?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (map.has(id)) continue;
      upsert(id, s, { tracked: trackedSet.has(id), pinned: pinnedSet.has(id) });
    }

    const arr = Array.from(map.values());

    arr.sort((a, b) => {
      // Pinned first
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

      const aCreated = Date.parse(String((a.s as LegacyAny).created_at ?? ''));
      const bCreated = Date.parse(String((b.s as LegacyAny).created_at ?? ''));
      if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) {
        return order === 'oldest' ? aCreated - bCreated : bCreated - aCreated;
      }

      const aId = Number((a.s as LegacyAny).id ?? 0);
      const bId = Number((b.s as LegacyAny).id ?? 0);
      return order === 'oldest' ? aId - bId : bId - aId;
    });

    return arr;
  }, [order, pinnedIds, pinnedQs, pinnedSet, q.data, trackedIds, trackedQs, trackedSet]);

  const filtered = useMemo(() => {
    let rows = merged;

    if (errorsOnly) {
      rows = rows.filter((x) => isFailingActionState(x.s));
    }

    if (needle) {
      rows = rows.filter((x) => {
        const id = Number((x.s as LegacyAny).id);
        const label = (x.s as LegacyAny).label ? String((x.s as LegacyAny).label) : `#${id}`;
        return String(id).includes(needle) || label.toLowerCase().includes(needle);
      });
    }

    return rows;
  }, [errorsOnly, merged, needle]);

  const pinnedRows = useMemo(() => filtered.filter((x) => x.pinned), [filtered]);
  const restRows = useMemo(() => filtered.filter((x) => !x.pinned), [filtered]);

  const pinnedMissing = useMemo(() => {
    const missing: number[] = [];
    for (let i = 0; i < pinnedIds.length; i++) {
      const id = pinnedIds[i];
      const q2 = pinnedQs[i];
      if (!id || !q2) continue;
      if (q2.isError && !q2.data) missing.push(id);
    }
    return missing;
  }, [pinnedIds, pinnedQs]);

  const [cancelTarget, setCancelTarget] = useState<ActionState | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelM = useMutation({
    mutationFn: async (id: number) => cancelActionState(id),
    onMutate: () => setCancelError(null),
    onSuccess: () => {
      setCancelTarget(null);
      setCancelError(null);
      void q.refetch();
      for (const q2 of trackedQs) void q2.refetch?.();
      for (const q2 of pinnedQs) void q2.refetch?.();
    },
    onError: (err: any) => {
      setCancelError(String(err?.message ?? err));
    },
  });

  const renderRow = (x: { s: ActionState; tracked: boolean; pinned: boolean }) => {
    const s = x.s;
    const id = Number((s as LegacyAny).id);
    const label = (s as LegacyAny).label ? String((s as LegacyAny).label) : `#${id}`;
    const badge = actionStateBadge(s);
    const toneVariant: ToneVariant | undefined = ((): ToneVariant | undefined => {
      const v = badge.variant;
      if (v === 'ok' || v === 'warn' || v === 'danger' || v === 'info' || v === 'neutral') return v;
      return undefined;
    })();
    const dotVariant = toneVariant && toneVariant !== 'muted' ? toneVariant : 'neutral';
    const pct = actionStateProgressPercent(s);
    const pLabel = actionStateProgressLabel(s);

    const relatedChainId = extractRelatedTransactionChainIdFromActionState(s);

    const highlight = chrome.highlightActionStateId != null && chrome.highlightActionStateId === id;

    const createdAt = (s as LegacyAny).created_at ? formatDateTime(String((s as LegacyAny).created_at)) : null;
    const updatedAt = (s as LegacyAny).updated_at ? formatDateTime(String((s as LegacyAny).updated_at)) : null;

    const meta: React.ReactNode[] = [];
    meta.push(<span key="id">#{id}</span>);
    if (createdAt) meta.push(<span key="created">{t('tasks.meta.created', { time: createdAt })}</span>);
    if (updatedAt) meta.push(<span key="updated">{t('tasks.meta.updated', { time: updatedAt })}</span>);

    const pinLabel = x.pinned ? t('tasks.action.unpin') : t('tasks.action.pin');

    return (
      <div
        key={id}
        className={clsx('rounded-md border p-3', toneSurfaceClass(toneVariant), highlight ? 'ring-1 ring-warn-border' : null)}
        data-testid={`action_states.row.${id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <StatusDot variant={dotVariant} title={badge.label} />
              <Link className="text-fg underline" to={`${basePath}/action-states/${id}`}>
                {label}
              </Link>
            </div>

            <div className="mt-1 text-xs text-faint">
              {meta.map((p, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? ' · ' : null}
                  {p}
                </React.Fragment>
              ))}

              {relatedChainId ? (
                <>
                  {meta.length > 0 ? ' · ' : null}
                  <Link className="underline" to={`${basePath}/transactions/${relatedChainId}`}>
                    {t('tasks.meta.chain', { id: relatedChainId })}
                  </Link>
                </>
              ) : null}
            </div>

            {pLabel ? (
              <div className="mt-1 text-xs text-faint">{t('tasks.meta.progress', { progress: pLabel })}</div>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="px-2"
                onClick={() => chrome.togglePinnedActionState(id)}
                title={pinLabel}
                ariaLabel={pinLabel}
              >
                {x.pinned ? <PinOff size={16} /> : <Pin size={16} />}
              </Button>

              {Boolean((s as LegacyAny).can_cancel) && !isFinishedActionState(s) ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setCancelError(null);
                    setCancelTarget(s);
                  }}
                  disabled={cancelM.isPending}
                >
                  {t('tasks.action.cancel')}
                </Button>
              ) : null}

              {x.tracked ? (
                <Button size="sm" variant="secondary" onClick={() => chrome.dismissActionState(id)}>
                  {t('tasks.action.dismiss')}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => chrome.trackActionState(id)}>
                  {t('tasks.action.track')}
                </Button>
              )}
            </div>

            {pct !== null ? <div className="text-xs text-faint">{pct}%</div> : null}
          </div>
        </div>

        {pct !== null ? (
          <div className="mt-3 h-2 rounded-full bg-surface-2">
            <div className={clsx('h-2 rounded-full', toneProgressFillClass(toneVariant))} style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
    );
  };

  const hasMergedData = merged.length > 0;
  const hasFilteredData = filtered.length > 0;

  return (
    <ListShell
      testId="action_states.page"
      header={
        <PageHeader
          title={t('nav.action_states')}
          description={t('action_states.page.description')}
          meta={t('action_states.page.meta')}
          testId="action_states.list.header"
          actions={
            <Button variant="secondary" onClick={() => chrome.openTasks()} testId="action_states.open_tasks">
              {t('common.open_tasks')}
            </Button>
          }
        />
      }
      filters={
        <>
          <FilterBar testId="action_states.list.filters">
            <div className="w-full sm:max-w-xl">
              <SmartFilterInput
                ref={smartInputRef}
                value={smart}
                onChange={(v) => {
                  setSmart(v);
                  if (smartErrors.length) setSmartErrors([]);
                }}
                placeholder={t('action_states.search.placeholder')}
                ariaLabel={t('action_states.search.placeholder')}
                testId="action_states.smart_filter.input"
                suggestions={smartSuggestions}
                onSubmit={() => applySmartText(smart)}
                suffix={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 px-0"
                    onClick={() => setHelpOpen(true)}
                    ariaLabel={t('filters.help.open')}
                    title={t('filters.help.open')}
                    testId="action_states.smart_filter.help"
                  >
                    <CircleHelp className="h-4 w-4" aria-hidden />
                  </Button>
                }
              />

              {activeFilterChips.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1" data-testid="action_states.active_filters">
                  {activeFilterChips}
                </div>
              ) : null}
            </div>

            <div className="w-full sm:w-44">
              <Select
                testId="action_states.order.select"
                value={order}
                onChange={(e) => setOrderInUrl(e.target.value === 'oldest' ? 'oldest' : 'newest')}
                options={[
                  { value: 'newest', label: t('action_states.order.newest') },
                  { value: 'oldest', label: t('action_states.order.oldest') },
                ]}
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAdvancedOpen(true)}
              ariaLabel={t('filters.advanced.open')}
              title={t('filters.advanced.open')}
              testId="action_states.advanced.open"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              <span className="ml-2 hidden sm:inline">{t('filters.advanced.label')}</span>
            </Button>

            <Button variant="secondary" size="sm" onClick={() => q.refetch()} testId="action_states.refresh">
              {t('common.refresh')}
            </Button>

            <CopyButton
              text={typeof window !== 'undefined' ? window.location.href : ''}
              label={t('common.copy_link')}
              testId="action_states.copy_link"
            />

            {filtersActive || smartErrors.length > 0 ? (
              <Button variant="secondary" size="sm" testId="action_states.clear_filters" onClick={clearFilters}>
                {t('common.clear_filters')}
              </Button>
            ) : null}
          </FilterBar>

          <SmartInputHelp
            open={helpOpen}
            onClose={() => {
              setHelpOpen(false);
              if (smartNeedle === '?') setSmart('');
            }}
            title={t('filters.help.title')}
            intro={t('action_states.smart_help.intro')}
            examples={[
              { example: '?', description: t('action_states.smart_help.examples.help') },
              { example: '123', description: t('action_states.smart_help.examples.open_id') },
              { example: 'errors', description: t('action_states.smart_help.examples.errors') },
              { example: 'backup', description: t('action_states.smart_help.examples.search') },
              { example: 'order:oldest', description: t('action_states.smart_help.examples.order') },
            ]}
            topKeys={[
              { key: 'q', description: t('action_states.smart_help.keys.q'), example: 'q:backup' },
              { key: 'errors', description: t('action_states.smart_help.keys.errors'), example: 'errors' },
              { key: 'id', description: t('action_states.smart_help.keys.id'), example: 'id:123' },
              { key: 'order', description: t('action_states.smart_help.keys.order'), example: 'order:oldest' },
            ]}
            inference={[
              t('action_states.smart_help.inference.enter_applies'),
              t('action_states.smart_help.inference.number_opens'),
              t('action_states.smart_help.inference.key_value'),
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
              {
                label: t('common.open_tasks'),
                onClick: () => {
                  setHelpOpen(false);
                  chrome.openTasks();
                },
              },
            ]}
            testId="action_states.smart_help"
            keyRowTestIdPrefix="action_states.smart_help.key"
          />

          <Drawer
            open={advancedOpen}
            onClose={() => setAdvancedOpen(false)}
            title={t('filters.advanced.title')}
            width="lg"
            testId="action_states.advanced.drawer"
            footer={
              <div className="flex items-center justify-end gap-2">
                {filtersActive ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters} testId="action_states.advanced.clear">
                    {t('common.clear_filters')}
                  </Button>
                ) : null}
                <Button variant="primary" size="sm" onClick={() => setAdvancedOpen(false)} testId="action_states.advanced.done">
                  {t('common.done')}
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium">{t('filters.advanced.title')}</div>
                <div className="mt-2">
                  <Input
                    value={qText}
                    onChange={(e) => setQueryInUrl(e.target.value)}
                    placeholder={t('action_states.search.placeholder')}
                    testId="action_states.advanced.q"
                  />
                </div>
              </div>

              <div>
                <Checkbox
                  checked={errorsOnly}
                  onChange={(checked) => setErrorsOnlyInUrl(checked)}
                  label={t('action_states.errors.label')}
                  description={t('action_states.errors.title')}
                  testId="action_states.advanced.errors"
                />
              </div>
            </div>
          </Drawer>
        </>
      }
    >
      {pinnedMissing.length > 0 ? (
        <Alert variant="warn" title={t('action_states.pinned_missing.title')}>
          <div className="mt-2 space-y-2">
            {pinnedMissing.map((id) => (
              <div key={id} className="flex items-center justify-between gap-3">
                <span>#{id}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => chrome.togglePinnedActionState(id)}
                  title={t('tasks.action.unpin')}
                >
                  {t('tasks.action.unpin')}
                </Button>
              </div>
            ))}
          </div>
        </Alert>
      ) : null}

      {q.isLoading && !hasMergedData ? <LoadingState testId="action_states.loading" /> : null}

      {q.isError && !hasMergedData ? (
        <ErrorState
          testId="action_states.error"
          title={t('action_states.error.load_title')}
          error={q.error}
          onRetry={() => void q.refetch()}
          showBack={false}
          detailsExtra={{ page: 'action_states.list', scope: basePath }}
        />
      ) : null}

      {merged.length === 0 && !q.isLoading && !q.isError ? (
        <EmptyState
          testId="action_states.empty"
          title={t('action_states.empty.title')}
          body={t('action_states.empty.body')}
          actionLabel={filtersActive ? t('common.clear_filters') : undefined}
          onAction={filtersActive ? clearFilters : undefined}
        />
      ) : null}

      {merged.length > 0 && filtered.length === 0 && !q.isError ? (
        <EmptyState
          testId="action_states.empty_filtered"
          title={t('action_states.empty_filtered.title')}
          body={t('tasks.empty.no_action_states_filtered')}
          actionLabel={filtersActive ? t('common.clear_filters') : undefined}
          onAction={filtersActive ? clearFilters : undefined}
        />
      ) : null}

      {hasFilteredData ? (
        <div className="space-y-6">
          {pinnedRows.length > 0 ? (
            <div>
              <div className="text-xs font-medium text-faint">{t('tasks.section.pinned')}</div>
              <div className="mt-2 space-y-3">{pinnedRows.map(renderRow)}</div>
            </div>
          ) : null}

          {restRows.length > 0 ? <div className="space-y-3">{restRows.map(renderRow)}</div> : null}
        </div>
      ) : null}

      <Card>
        <KeysetPagination
          page={pagination.page}
          pageCount={pagination.stack.length}
          canPrev={pagination.canPrev}
          canNext={pagination.hasForward || (hasMore && pageCursor !== null)}
          onPrev={pagination.goPrev}
          onNext={() => pagination.goNext(pageCursor)}
          onGoToPage={pagination.goToPage}
          limit={pagination.limit}
          allowedLimits={pagination.allowedLimits}
          onLimitChange={pagination.setLimit}
          testId="action_states.pagination"
        />
      </Card>

      <ConfirmDialog
        testId="tasks.cancel_dialog"
        open={cancelTarget !== null}
        title={t('tasks.cancel_dialog.title')}
        description={cancelTarget?.label ? String(cancelTarget.label) : t('tasks.cancel_dialog.description_default')}
        danger
        confirmLabel={t('tasks.cancel_dialog.confirm')}
        confirmLoading={cancelM.isPending}
        onCancel={() => {
          setCancelTarget(null);
          setCancelError(null);
        }}
        onConfirm={() => {
          if (!cancelTarget) return;
          const id = Number((cancelTarget as LegacyAny).id);
          if (!Number.isFinite(id) || id <= 0) return;
          cancelM.mutate(id);
        }}
      >
        {cancelError ? (
          <Alert variant="danger" title={t('tasks.cancel_dialog.failed_title')}>
            {cancelError}
          </Alert>
        ) : null}
      </ConfirmDialog>
    </ListShell>
  );
}
