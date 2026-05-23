import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { Pin, PinOff } from 'lucide-react';

import { cancelActionState, fetchActionState, fetchActionStates, type ActionState } from '../../lib/api/actionStates';
import { useAppMode } from '../../app/appMode';
import { useI18n } from '../../app/i18n';
import { formatDateTime } from '../../lib/format';
import { useActionStatePollIntervalMs, useTierAIntervalMs } from '../../lib/refreshTiers';
import { extractRelatedTransactionChainIdFromActionState } from '../../lib/taskLinks';
import {
  actionStateBadge,
  actionStateProgressLabel,
  actionStateProgressPercent,
  isFailingActionState,
  isFinishedActionState,
} from '../../lib/taskStatus';
import { clsx } from '../ui/clsx';
import { toneProgressFillClass, toneSurfaceClass, type ToneVariant } from '../ui/tone';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { StatusDot } from '../ui/StatusDot';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';
import { useChrome } from './ChromeContext';

function parseIds(input: unknown, limit: number): number[] {
  if (!Array.isArray(input)) return [];
  const ids: number[] = [];
  for (const v of input) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) continue;
    ids.push(Math.floor(n));
    if (ids.length >= limit) break;
  }
  return ids;
}

export function ActionStatesPanel(props: {
  limit?: number;
  filterText?: string;
  pinnedIds?: number[];
  onTogglePin?: (actionStateId: number) => void;
}) {
  const { basePath } = useAppMode();
  const chrome = useChrome();
  const i18n = useI18n();

  const actionPollMs = useActionStatePollIntervalMs();
  const tierARefetchMs = useTierAIntervalMs();

  const trackedIds = useMemo(
    () => chrome.trackedActionStates.map((x) => x.id),
    [chrome.trackedActionStates]
  );
  const trackedSet = useMemo(() => new Set<number>(trackedIds), [trackedIds]);

  const pinnedIds = useMemo(() => parseIds(props.pinnedIds, 50), [props.pinnedIds]);
  const pinnedSet = useMemo(() => new Set<number>(pinnedIds), [pinnedIds]);

  const explicitIds = useMemo(() => {
    const set = new Set<number>();
    for (const id of trackedIds) set.add(id);
    for (const id of pinnedIds) set.add(id);
    return Array.from(set)
      .filter((id) => Number.isFinite(id) && id > 0)
      .slice(0, 60);
  }, [trackedIds, pinnedIds]);

  const explicitQs = useQueries({
    queries: explicitIds.map((id) => ({
      queryKey: ['action_state', 'show', { id }],
      queryFn: async () => (await fetchActionState(id)).data,
      enabled: Number.isFinite(id) && id > 0,
      refetchInterval: actionPollMs,
    })),
  });

  const indexQ = useQuery({
    queryKey: ['action_states', 'index', { limit: props.limit ?? 10 }],
    queryFn: async () => (await fetchActionStates({ limit: props.limit ?? 10, order: 'newest' })).data,
    // keep this a bit slower; explicitQs cover the things the user explicitly cares about
    refetchInterval: tierARefetchMs,
  });

  const merged = useMemo(() => {
    const map = new Map<number, { s: ActionState; tracked: boolean; pinned: boolean }>();

    for (let i = 0; i < explicitIds.length; i++) {
      const requestedId = explicitIds[i];
      const q = explicitQs[i];
      if (q?.data) {
        const id = Number((q.data as any).id ?? requestedId);
        if (!Number.isFinite(id) || id <= 0) continue;
        map.set(id, {
          s: q.data as any,
          tracked: trackedSet.has(id),
          pinned: pinnedSet.has(id),
        });
      }
    }

    const list = indexQ.data ?? [];
    for (const s of list as any[]) {
      const id = Number(s?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (map.has(id)) continue;
      map.set(id, { s: s as any, tracked: trackedSet.has(id), pinned: pinnedSet.has(id) });
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      const aCreated = Date.parse(String((a.s as any).created_at ?? ''));
      const bCreated = Date.parse(String((b.s as any).created_at ?? ''));
      if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) {
        return bCreated - aCreated;
      }
      return Number((b.s as any).id ?? 0) - Number((a.s as any).id ?? 0);
    });

    return arr;
  }, [explicitIds, explicitQs, indexQ.data, pinnedSet, trackedSet]);

  const needle = (props.filterText ?? '').trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!needle) return merged;
    return merged.filter((x) => {
      const id = Number((x.s as any).id);
      const label = (x.s as any).label ? String((x.s as any).label) : `#${id}`;
      return String(id).includes(needle) || label.toLowerCase().includes(needle);
    });
  }, [merged, needle]);

  const pinned = filtered.filter((x) => x.pinned);
  const rest = filtered.filter((x) => !x.pinned);

  const failures = rest.filter((x) => isFailingActionState(x.s));
  const active = rest.filter((x) => !isFinishedActionState(x.s) && !isFailingActionState(x.s));
  const done = rest.filter((x) => isFinishedActionState(x.s) && !isFailingActionState(x.s));

  const [cancelTarget, setCancelTarget] = useState<ActionState | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelM = useMutation({
    mutationFn: async (id: number) => cancelActionState(id),
    onMutate: () => setCancelError(null),
    onSuccess: () => {
      setCancelTarget(null);
      setCancelError(null);
      void indexQ.refetch();
      for (const q of explicitQs) void q.refetch?.();
    },
    onError: (err: any) => {
      setCancelError(String(err?.message ?? err));
    },
  });

  const renderRow = (x: { s: ActionState; tracked: boolean; pinned: boolean }) => {
    const s = x.s;
    const id = Number((s as any).id);
    const label = (s as any).label ? String((s as any).label) : `#${id}`;
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

    const pinLabel = x.pinned ? i18n.t('tasks.action.unpin') : i18n.t('tasks.action.pin');

    const createdAt = (s as any).created_at ? formatDateTime(String((s as any).created_at)) : null;
    const updatedAt = (s as any).updated_at ? formatDateTime(String((s as any).updated_at)) : null;

    const meta: React.ReactNode[] = [];
    meta.push(<span key="id">#{id}</span>);
    if (createdAt) meta.push(<span key="created">{i18n.t('tasks.meta.created', { time: createdAt })}</span>);
    if (updatedAt) meta.push(<span key="updated">{i18n.t('tasks.meta.updated', { time: updatedAt })}</span>);

    return (
      <div
        key={id}
        className={clsx('rounded-md border p-3', toneSurfaceClass(toneVariant), highlight ? 'ring-1 ring-warn-border' : null)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <StatusDot variant={dotVariant} title={badge.label} />
              <Link className="underline" to={`${basePath}/action-states/${id}`}>
                  {label}
                </Link>
            </div>

            {meta.length > 0 || relatedChainId ? (
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
                      {i18n.t('tasks.meta.chain', { id: relatedChainId })}
                    </Link>
                  </>
                ) : null}
              </div>
            ) : null}

            {pLabel ? <div className="mt-1 text-xs text-faint">{i18n.t('tasks.meta.progress', { progress: pLabel })}</div> : null}
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>

            <div className="flex items-center gap-2">
              {props.onTogglePin ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => props.onTogglePin?.(id)}
                  title={pinLabel}
                  ariaLabel={pinLabel}
                >
                  {x.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                </Button>
              ) : null}

              {Boolean((s as any).can_cancel) && !isFinishedActionState(s) ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setCancelError(null);
                    setCancelTarget(s);
                  }}
                  disabled={cancelM.isPending}
                >
                  {i18n.t('tasks.action.cancel')}
                </Button>
              ) : null}

              {x.tracked ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => chrome.dismissActionState(id)}
                  title={i18n.t('tasks.action.dismiss_title')}
                >
                  {i18n.t('tasks.action.dismiss')}
                </Button>
              ) : null}
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

  const anyLoading =
    indexQ.isLoading || (explicitQs.length > 0 && explicitQs.some((q) => q.isLoading && !q.data));
  const anyError = indexQ.isError || (explicitQs.length > 0 && explicitQs.some((q) => q.isError && !q.data));

  if (anyLoading && merged.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner />
      </div>
    );
  }

  if (anyError && merged.length === 0) {
    return (
      <div>
        <div className="text-sm font-medium">{i18n.t('tasks.error.load_action_states')}</div>
        <div className="mt-1 text-sm text-muted">{String((indexQ.error as any)?.message ?? indexQ.error)}</div>
      </div>
    );
  }

  if (merged.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted">{i18n.t('nav.action_states')}</div>
          <Link className="text-xs font-medium underline" to={`${basePath}/action-states`}>
            {i18n.t('tasks.action.view_all')}
          </Link>
</div>
        <div className="mt-2 text-sm text-muted">{i18n.t('tasks.empty.no_action_states')}</div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted">{i18n.t('nav.action_states')}</div>
          <Link className="text-xs font-medium underline" to={`${basePath}/action-states`}>
            {i18n.t('tasks.action.view_all')}
          </Link>
</div>
        <div className="mt-2 text-sm text-muted">{i18n.t('tasks.empty.no_action_states_filtered')}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted">
          {i18n.t('nav.action_states')}
          {needle ? <span className="text-faint"> · {i18n.t('tasks.meta.filtered')}</span> : null}
        </div>
          <Link className="text-xs font-medium underline" to={`${basePath}/action-states`}>
            {i18n.t('tasks.action.view_all')}
          </Link>
</div>

      <div className="mt-3 space-y-4">
        {pinned.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-faint">{i18n.t('tasks.section.pinned')}</div>
            <div className="space-y-2">{pinned.map(renderRow)}</div>
          </div>
        ) : null}

        {failures.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-danger">{i18n.t('tasks.section.failed')}</div>
            <div className="space-y-2">{failures.map(renderRow)}</div>
          </div>
        ) : null}

        {active.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted">{i18n.t('tasks.section.active')}</div>
              <div className="text-xs text-faint">{i18n.t('tasks.meta.auto_refreshing')}</div>
            </div>
            <div className="space-y-2">{active.map(renderRow)}</div>
          </div>
        ) : null}

        {done.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs text-muted">
              {active.length > 0 ? i18n.t('tasks.section.recent') : i18n.t('tasks.section.most_recent')}
            </div>
            <div className="space-y-2">{done.map(renderRow)}</div>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={cancelTarget !== null}
        title={i18n.t('tasks.cancel_dialog.title')}
        description={
          cancelTarget?.label
            ? String(cancelTarget.label)
            : i18n.t('tasks.cancel_dialog.description_default')
        }
        danger
        confirmLabel={i18n.t('tasks.cancel_dialog.confirm')}
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
          <Alert variant="danger" title={i18n.t('tasks.cancel_dialog.failed_title')}>
            {cancelError}
          </Alert>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
