import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { Pin, PinOff } from 'lucide-react';

import { cancelActionState, fetchActionState, fetchActionStates, type ActionState } from '../../lib/api/actionStates';
import { fetchTransactionChain, fetchTransactions, type Transaction } from '../../lib/api/transactions';
import { useAppMode } from '../../app/appMode';
import { useI18n } from '../../app/i18n';
import { formatDateTime } from '../../lib/format';
import { formatErrorMessage } from '../../lib/errors';
import { useActionStatePollIntervalMs, useTierAIntervalMs } from '../../lib/refreshTiers';
import { extractRelatedTransactionChainIdFromActionState } from '../../lib/taskLinks';
import { formatPayload, safeJson } from '../../lib/txFormat';
import {
  actionStateBadge,
  actionStateProgressLabel,
  actionStateProgressPercent,
  isFailingActionState,
  isFinishedActionState,
  transactionBadge,
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

function backendDetailPayload(s: ActionState): string {
  const keys = ['error', 'errors', 'exception', 'message', 'output', 'result', 'response', 'stderr', 'stdout', 'backtrace'];
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(s as any, key)) picked[key] = (s as any)[key];
  }
  return Object.keys(picked).length > 0 ? safeJson(picked) : safeJson(s);
}

function ActionStateInspect(props: {
  actionStateId: number;
  fallback?: ActionState;
  pinned: boolean;
  onBack: () => void;
  onTogglePin?: (actionStateId: number) => void;
}) {
  const { basePath } = useAppMode();
  const chrome = useChrome();
  const i18n = useI18n();
  const actionPollMs = useActionStatePollIntervalMs();
  const tierARefetchMs = useTierAIntervalMs();

  const actionQ = useQuery({
    queryKey: ['action_state', 'show', { id: props.actionStateId }],
    queryFn: async () => (await fetchActionState(props.actionStateId)).data,
    initialData: props.fallback,
    refetchInterval: (data) => (data && isFinishedActionState(data as any) ? false : actionPollMs),
  });

  const s = actionQ.data;
  const relatedChainId = s ? extractRelatedTransactionChainIdFromActionState(s) : null;

  const chainQ = useQuery({
    queryKey: ['transaction_chains', 'show', { id: relatedChainId ?? -1 }],
    queryFn: async () => (await fetchTransactionChain(relatedChainId!)).data,
    enabled: Boolean(relatedChainId && relatedChainId > 0),
    refetchInterval: relatedChainId ? tierARefetchMs : false,
  });

  const txQ = useQuery({
    queryKey: ['transactions', 'list', { transactionChainId: relatedChainId ?? -1, limit: 20 }],
    queryFn: async () => (await fetchTransactions({ transactionChainId: relatedChainId!, limit: 20 })).data,
    enabled: Boolean(relatedChainId && relatedChainId > 0),
    refetchInterval: relatedChainId ? tierARefetchMs : false,
  });

  if (actionQ.isLoading && !s) {
    return (
      <div>
        <Button size="sm" variant="secondary" onClick={props.onBack}>{i18n.t('common.back')}</Button>
        <div className="flex items-center justify-center py-8"><Spinner /></div>
      </div>
    );
  }

  if (actionQ.isError || !s) {
    return (
      <div>
        <Button size="sm" variant="secondary" onClick={props.onBack}>{i18n.t('common.back')}</Button>
        <div className="mt-3">
          <Alert variant="danger" title={i18n.t('action_state.load_error.title')}>
            {actionQ.isError ? formatErrorMessage(actionQ.error) : i18n.t('action_state.not_found.body')}
          </Alert>
        </div>
      </div>
    );
  }

  const id = Number((s as any).id ?? props.actionStateId);
  const label = (s as any).label ? String((s as any).label) : i18n.t('action_state.title_fallback', { id });
  const badge = actionStateBadge(s);
  const pct = actionStateProgressPercent(s);
  const pLabel = actionStateProgressLabel(s);
  const createdAt = (s as any).created_at ? formatDateTime(String((s as any).created_at)) : null;
  const updatedAt = (s as any).updated_at ? formatDateTime(String((s as any).updated_at)) : null;
  const tracked = chrome.trackedActionStates.some((x) => x.id === id);
  const chain = chainQ.data;

  const renderTx = (tx: Transaction) => {
    const b = transactionBadge(tx);
    const name = tx.name ? String(tx.name) : `#${tx.id}`;
    const input = formatPayload((tx as any).input);
    const output = formatPayload((tx as any).output);

    return (
      <div key={tx.id} className="rounded-md border border-border bg-surface-2 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link className="text-sm font-medium underline" to={`${basePath}/transactions/items/${tx.id}`}>{name}</Link>
            <div className="mt-1 text-xs text-faint">#{tx.id}</div>
          </div>
          <Badge variant={b.variant}>{b.label}</Badge>
        </div>
        {input || output ? (
          <details className="mt-2">
            <summary className="cursor-pointer select-none text-xs font-medium text-muted">{i18n.t('tasks.inspect.payload')}</summary>
            {input ? <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-surface p-2 text-xs text-muted">{input}</pre> : null}
            {output ? <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-surface p-2 text-xs text-muted">{output}</pre> : null}
          </details>
        ) : null}
      </div>
    );
  };

  return (
    <div data-testid={`tasks.inspect.action_state.${id}`}>
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="secondary" onClick={props.onBack} testId="tasks.inspect.back">
          {i18n.t('common.back')}
        </Button>
        <Link className="text-xs font-medium underline" to={`${basePath}/action-states/${id}`}>
          {i18n.t('tasks.inspect.open_full')}
        </Link>
      </div>

      <div className="mt-3 rounded-md border border-border bg-surface p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted">{i18n.t('tasks.inspect.action_state_id')}</div>
            <h3 className="mt-1 text-base font-semibold">#{id}</h3>
            <div className="mt-1 break-words text-sm">{label}</div>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>

        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><div className="text-xs text-muted">{i18n.t('common.state')}</div><div>{badge.label}</div></div>
          <div>
            <div className="text-xs text-muted">{i18n.t('tasks.inspect.success')}</div>
            <div>{isFailingActionState(s) ? i18n.t('common.no') : isFinishedActionState(s) ? i18n.t('common.yes') : i18n.t('state.running')}</div>
          </div>
          {pLabel ? <div><div className="text-xs text-muted">{i18n.t('common.progress')}</div><div>{pct !== null ? `${pLabel} · ${pct}%` : pLabel}</div></div> : null}
          {createdAt ? <div><div className="text-xs text-muted">{i18n.t('common.created')}</div><div>{createdAt}</div></div> : null}
          {updatedAt ? <div><div className="text-xs text-muted">{i18n.t('common.updated')}</div><div>{updatedAt}</div></div> : null}
          {relatedChainId ? (
            <div>
              <div className="text-xs text-muted">{i18n.t('action_state.field.transaction_chain')}</div>
              <Link className="underline" to={`${basePath}/transactions/${relatedChainId}`}>
                {chain?.label ? String(chain.label) : `#${relatedChainId}`}
              </Link>
            </div>
          ) : null}
        </div>

        {pct !== null ? (
          <div className="mt-3 h-2 rounded-full bg-surface-2">
            <div className="h-2 rounded-full bg-fg/60" style={{ width: `${pct}%` }} />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {props.onTogglePin ? (
            <Button size="sm" variant="secondary" onClick={() => props.onTogglePin?.(id)}>
              {props.pinned ? i18n.t('tasks.action.unpin') : i18n.t('tasks.action.pin')}
            </Button>
          ) : null}
          {tracked ? (
            <Button size="sm" variant="secondary" onClick={() => chrome.dismissActionState(id)}>
              {i18n.t('tasks.action.dismiss')}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => chrome.trackActionState(id)}>
              {i18n.t('tasks.action.track')}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-medium text-muted">{i18n.t('tasks.inspect.backend_details')}</div>
        <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-surface p-3 text-xs text-muted">
          {backendDetailPayload(s)}
        </pre>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium text-muted">{i18n.t('tasks.inspect.transactions')}</div>
          {relatedChainId ? (
            <Link className="text-xs underline" to={`${basePath}/transactions/items?transaction_chain=${relatedChainId}`}>
              {i18n.t('tasks.action.view_all')}
            </Link>
          ) : null}
        </div>
        {!relatedChainId ? (
          <div className="mt-2 text-sm text-muted">{i18n.t('tasks.inspect.no_chain')}</div>
        ) : txQ.isLoading ? (
          <div className="flex items-center justify-center py-6"><Spinner /></div>
        ) : txQ.isError ? (
          <Alert variant="danger" title={i18n.t('tasks.error.load_items')}>{formatErrorMessage(txQ.error)}</Alert>
        ) : (txQ.data ?? []).length > 0 ? (
          <div className="mt-2 space-y-2">{(txQ.data ?? []).map(renderTx)}</div>
        ) : (
          <div className="mt-2 text-sm text-muted">{i18n.t('tasks.empty.no_items')}</div>
        )}
      </div>
    </div>
  );
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
  const [selectedActionStateId, setSelectedActionStateId] = useState<number | null>(null);

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

  const selectedRow = selectedActionStateId !== null
    ? merged.find((x) => Number((x.s as any).id) === selectedActionStateId)
    : undefined;

  if (selectedActionStateId !== null) {
    return (
      <ActionStateInspect
        actionStateId={selectedActionStateId}
        fallback={selectedRow?.s}
        pinned={pinnedSet.has(selectedActionStateId)}
        onTogglePin={props.onTogglePin}
        onBack={() => setSelectedActionStateId(null)}
      />
    );
  }

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
              <button
                type="button"
                className="min-w-0 truncate text-left underline"
                onClick={() => setSelectedActionStateId(id)}
              >
                {label}
              </button>
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
              <Button size="sm" variant="secondary" onClick={() => setSelectedActionStateId(id)} testId={`tasks.inspect.open.${id}`}>
                {i18n.t('tasks.inspect.open')}
              </Button>

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
