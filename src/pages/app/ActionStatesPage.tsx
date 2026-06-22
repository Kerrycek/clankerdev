import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueries } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { cancelActionState, fetchActionState, fetchActionStates, type ActionState } from '../../lib/api/actionStates';
import { useAppMode } from '../../app/appMode';
import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';
import { FilterBar } from '../../components/layout/FilterBar';
import { ListShell } from '../../components/layout/ListShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { useChrome } from '../../components/layout/ChromeContext';
import { Alert } from '../../components/ui/Alert';
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
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../lib/smartFilter';
import {
  classifyActionState,
  operationCategoryLabel,
  operationLabel,
  operationSeverityLabel,
  operationVisibilityLabel,
} from '../../lib/operationTaxonomy';
import {
  ACTION_STATE_VISIBILITY_FILTERS,
  actionStateMatchesVisibilityFilter,
  actionStateVisibilityFromUrl,
  canonicalActionStateSmartKey,
  normalizeIds,
  parseBoolToken,
  parseOrderToken,
  parseVisibilityToken,
  type ActionStateVisibilityFilter,
} from './ActionStatesFilterModel';
import { useKeysetPagination } from '../../lib/hooks/useKeysetPagination';
import { cursorFromAscendingPage, cursorFromDescendingPage } from '../../lib/lockIndex';
import {
  isFailingActionState,
  isFinishedActionState,
} from '../../lib/taskStatus';
import { useActionStatePollIntervalMs, useTierAIntervalMs } from '../../lib/refreshTiers';
import { ActionStateListRow, type ActionStateRowItem } from './ActionStateListRow';

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
  const visibilityFilter = useMemo(() => actionStateVisibilityFromUrl(sp.get('visibility')), [sp]);
  const needle = useMemo(() => qText.trim().toLowerCase(), [qText]);

  const filtersActive = Boolean(qText.trim() || errorsOnly || visibilityFilter !== 'all');

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


  const setVisibilityFilterInUrl = (next: ActionStateVisibilityFilter) => {
    setSp((prev) => {
      const p = new URLSearchParams(prev);
      if (next === 'all') p.delete('visibility');
      else p.set('visibility', next);
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
      p.delete('visibility');
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
    let nextVisibility = visibilityFilter;

    const free: string[] = [];
    const errs: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (kv) {
        const rawKey = kv.rawKey;
        const rawValue = kv.rawValue;
        const value = unquoteSmartValue(rawValue);

        const key = canonicalActionStateSmartKey(rawKey);
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


        if (key === 'visibility') {
          const next = parseVisibilityToken(value);
          if (!next) errs.push(t('action_states.smart.error.invalid_visibility', { value }));
          else nextVisibility = next;
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

      const visibilityAlias = parseVisibilityToken(low);
      if (visibilityAlias && low !== 'all') {
        nextVisibility = visibilityAlias;
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
      if (nextVisibility === 'all') p.delete('visibility');
      else p.set('visibility', nextVisibility);
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

    const suggestedVisibility = parseVisibilityToken(low);
    if (suggestedVisibility && suggestedVisibility !== 'all') {
      suggestions.push({
        id: `visibility:${suggestedVisibility}`,
        primary: t(`action_states.visibility.${suggestedVisibility}`),
        secondary: t('action_states.smart.suggest.visibility.secondary'),
        onPick: () => {
          setVisibilityFilterInUrl(suggestedVisibility);
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'action_states.smart_filter.suggest.visibility',
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
  }, [applySmartText, basePath, errorsOnly, navigate, order, qText, setErrorsOnlyInUrl, setQueryInUrl, setVisibilityFilterInUrl, smartNeedle, t]);

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

    if (visibilityFilter !== 'all') {
      chips.push(
        <FilterChip
          key="visibility"
          label={t('action_states.visibility.chip', { value: t(`action_states.visibility.${visibilityFilter}`) })}
          tone={visibilityFilter === 'system' ? 'info' : visibilityFilter === 'admin' ? 'warn' : 'neutral'}
          onRemove={() => setVisibilityFilterInUrl('all')}
          testId="action_states.chip.visibility"
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
  }, [errorsOnly, qText, setErrorsOnlyInUrl, setQueryInUrl, setVisibilityFilterInUrl, smartErrors, t, visibilityFilter]);

  const pagination = useKeysetPagination({
    id: 'action_states.list',
    filterKey: JSON.stringify({ order, q: qText.trim(), errors: errorsOnly, visibility: visibilityFilter, scope: basePath }),
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
      refetchInterval: (data: unknown) => (data && isFinishedActionState(data as any) ? false : actionPollMs),
    })),
  });

  const trackedQs = useQueries({
    queries: trackedIds.map((id) => ({
      queryKey: ['action_state', 'show', { id }],
      queryFn: async () => (await fetchActionState(id)).data,
      enabled: Number.isFinite(id) && id > 0,
      refetchInterval: (data: unknown) => (data && isFinishedActionState(data as any) ? false : actionPollMs),
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
    const rows = q.data as any;
    return order === 'oldest' ? cursorFromAscendingPage(rows) : cursorFromDescendingPage(rows);
  }, [order, q.data]);

  const hasMore = (q.data ?? []).length >= pagination.limit;

  const merged = useMemo(() => {
    const map = new Map<number, ActionStateRowItem>();

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
      const s = q2.data as any as ActionState;
      const sid = Number((s as any).id ?? id);
      if (!Number.isFinite(sid) || sid <= 0) continue;
      upsert(sid, s, { pinned: true });
    }

    // Tracked next
    for (let i = 0; i < trackedIds.length; i++) {
      const id = trackedIds[i];
      const q2 = trackedQs[i];
      if (!id || !q2?.data) continue;
      const s = q2.data as any as ActionState;
      const sid = Number((s as any).id ?? id);
      if (!Number.isFinite(sid) || sid <= 0) continue;
      upsert(sid, s, { tracked: true, pinned: pinnedSet.has(sid) });
    }

    // Then the index list
    for (const s0 of q.data ?? []) {
      const s = s0 as any as ActionState;
      const id = Number((s as any)?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (map.has(id)) continue;
      upsert(id, s, { tracked: trackedSet.has(id), pinned: pinnedSet.has(id) });
    }

    const arr = Array.from(map.values());

    arr.sort((a, b) => {
      // Pinned first
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

      const aCreated = Date.parse(String((a.s as any).created_at ?? ''));
      const bCreated = Date.parse(String((b.s as any).created_at ?? ''));
      if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) {
        return order === 'oldest' ? aCreated - bCreated : bCreated - aCreated;
      }

      const aId = Number((a.s as any).id ?? 0);
      const bId = Number((b.s as any).id ?? 0);
      return order === 'oldest' ? aId - bId : bId - aId;
    });

    return arr;
  }, [order, pinnedIds, pinnedQs, pinnedSet, q.data, trackedIds, trackedQs, trackedSet]);

  const filtered = useMemo(() => {
    let rows = merged;

    if (errorsOnly) {
      rows = rows.filter((x) => isFailingActionState(x.s));
    }

    if (visibilityFilter !== 'all') {
      rows = rows.filter((x) => actionStateMatchesVisibilityFilter(x.s, visibilityFilter));
    }

    if (needle) {
      rows = rows.filter((x) => {
        const id = Number(x.s.id);
        const rawLabel = x.s.label ? String(x.s.label) : `#${id}`;
        const op = classifyActionState(x.s);
        const taxonomyLabel = op.key.endsWith('.unknown') ? op.fallbackLabel : operationLabel(op, t);
        const haystack = [
          String(id),
          rawLabel,
          taxonomyLabel,
          operationCategoryLabel(op, t),
          operationSeverityLabel(op, t),
          operationVisibilityLabel(op, t),
          op.matchText,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      });
    }

    return rows;
  }, [errorsOnly, merged, needle, t, visibilityFilter]);

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

  const renderRow = (x: ActionStateRowItem) => {
    const id = Number(x.s.id);
    const highlight = chrome.highlightActionStateId != null && chrome.highlightActionStateId === id;

    return (
      <ActionStateListRow
        key={id}
        item={x}
        basePath={basePath}
        highlighted={highlight}
        cancelPending={cancelM.isPending}
        onTogglePinned={(targetId) => chrome.togglePinnedActionState(targetId)}
        onTrack={(targetId) => chrome.trackActionState(targetId)}
        onDismiss={(targetId) => chrome.dismissActionState(targetId)}
        onCancel={(state) => {
          setCancelError(null);
          setCancelTarget(state);
        }}
      />
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

            <div className="flex w-full flex-wrap gap-2 sm:w-auto" data-testid="action_states.visibility.filters">
              {ACTION_STATE_VISIBILITY_FILTERS.map((value) => (
                <Button
                  key={value}
                  variant={visibilityFilter === value ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setVisibilityFilterInUrl(value)}
                  testId={`action_states.visibility.${value}`}
                >
                  {t(`action_states.visibility.${value}`)}
                </Button>
              ))}
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
              { example: 'visibility:system', description: t('action_states.smart_help.examples.visibility') },
            ]}
            topKeys={[
              { key: 'q', description: t('action_states.smart_help.keys.q'), example: 'q:backup' },
              { key: 'errors', description: t('action_states.smart_help.keys.errors'), example: 'errors' },
              { key: 'id', description: t('action_states.smart_help.keys.id'), example: 'id:123' },
              { key: 'order', description: t('action_states.smart_help.keys.order'), example: 'order:oldest' },
              { key: 'visibility', description: t('action_states.smart_help.keys.visibility'), example: 'visibility:user' },
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

              <div>
                <div className="text-sm font-medium">{t('action_states.visibility.label')}</div>
                <div className="mt-2">
                  <Select
                    testId="action_states.advanced.visibility"
                    value={visibilityFilter}
                    onChange={(e) => setVisibilityFilterInUrl(actionStateVisibilityFromUrl(e.target.value))}
                    options={ACTION_STATE_VISIBILITY_FILTERS.map((value) => ({
                      value,
                      label: t(`action_states.visibility.${value}`),
                    }))}
                  />
                </div>
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
          const id = Number((cancelTarget as any).id);
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
