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
import { durationSec, formatPayload, safeJson, transactionErrorText } from '../../lib/txFormat';
import {
  actionStateBadge,
  actionStateProgressLabel,
  actionStateProgressPercent,
  isFailingActionState,
  isFinishedActionState,
  transactionBadge,
} from '../../lib/taskStatus';
import { resourceId, refLabel } from '../../lib/resources';
import { clsx } from '../ui/clsx';
import { toneProgressFillClass, toneSurfaceClass, type ToneVariant } from '../ui/tone';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { StatusDot } from '../ui/StatusDot';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';
import { TransactionPayloadPanels } from '../ui/TransactionPayloadPanels';
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

function compactActionTarget(s: ActionState): string | null {
  const row = s as any;
  const keys = ['object', 'vps', 'dataset', 'dns_zone', 'user', 'node', 'network', 'migration_plan', 'ip_address'];
  for (const key of keys) {
    const value = row[key];
    const id = resourceId(value);
    const label = refLabel(value);
    if (label) return label;
    if (id) return `#${id}`;
  }

  const kind = typeof row.object_type === 'string' ? row.object_type : typeof row.class_name === 'string' ? row.class_name : null;
  const rowId = resourceId(row.object_id ?? row.row_id);
  if (kind && rowId) return `${kind} #${rowId}`;
  if (rowId) return `#${rowId}`;
  return null;
}

function compactFailureSummary(value: unknown, maxLength = 180): string | null {
  const text = transactionErrorText(value).trim();
  if (!text) return null;
  const singleLine = text.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 1)}…`;
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
  const [expandedTx, setExpandedTx] = useState<Set<number>>(() => new Set());

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
    queryKey: ['transactions', 'list', { transactionChainId: relatedChainId ?? -1, limit: 100 }],
    queryFn: async () => (await fetchTransactions({ transactionChainId: relatedChainId!, limit: 100 })).data,
    enabled: Boolean(relatedChainId && relatedChainId > 0),
    refetchInterval: relatedChainId ? tierARefetchMs : false,
  });

  const transactionRows = txQ.data ?? [];
  const transactionIds = transactionRows
    .map((tx) => Number((tx as any).id))
    .filter((txId) => Number.isFinite(txId) && txId > 0);

  const toggleTx = (txId: number) => {
    setExpandedTx((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  };

  const expandAllTx = () => setExpandedTx(new Set(transactionIds));
  const collapseAllTx = () => setExpandedTx(new Set());

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
  const target = compactActionTarget(s);
  const failureSummary = compactFailureSummary(s);

  const renderTxCard = (tx: Transaction) => {
    const b = transactionBadge(tx);
    const name = tx.name ? String(tx.name) : `#${tx.id}`;
    const input = formatPayload((tx as any).input);
    const output = formatPayload((tx as any).output);
    const errorText = transactionErrorText(tx);
    const txId = Number((tx as any).id);
    const hasTxId = Number.isFinite(txId) && txId > 0;
    const expanded = hasTxId && expandedTx.has(txId);
    const nodeId = resourceId((tx as any).node);
    const vpsId = resourceId((tx as any).vps);
    const type = typeof (tx as any).type === 'number' ? Number((tx as any).type) : null;
    const priority = typeof (tx as any).priority === 'number' ? Number((tx as any).priority) : null;
    const started = (tx as any).started_at as string | null | undefined;
    const finished = (tx as any).finished_at as string | null | undefined;
    const sec = durationSec(started, finished);
    const dotVariant =
      b.variant === 'danger' || b.variant === 'warn' || b.variant === 'ok' || b.variant === 'info'
        ? b.variant
        : 'neutral';
    const meta: React.ReactNode[] = [];
    if (hasTxId) meta.push(<span key="id">#{txId}</span>);
    if (type !== null) meta.push(<span key="type">{i18n.t('transactions.items.row.type_chip', { type })}</span>);
    if (priority !== null) meta.push(<span key="priority">{i18n.t('transactions.tx.prio', { prio: priority })}</span>);
    if (nodeId) meta.push(<span key="node">{refLabel((tx as any).node) || `#${nodeId}`}</span>);
    if (vpsId) {
      meta.push(
        <Link key="vps" className="underline" to={`${basePath}/vps/${vpsId}`}>
          #{vpsId}
        </Link>
      );
    }
    if (started) meta.push(<span key="started">{i18n.t('common.started')}: {formatDateTime(started)}</span>);
    if (sec !== null) meta.push(<span key="duration">{i18n.t('transactions.tx.duration', { sec })}</span>);

    return (
      <div
        key={(tx as any).id ?? name}
        className="rounded-md border border-border bg-surface p-3"
        data-testid={hasTxId ? `tasks.inspect.tx.card.${txId}` : undefined}
      >
        <div className="space-y-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <StatusDot variant={dotVariant} title={b.label} />
                <div className="min-w-0 break-words text-sm font-medium">{name}</div>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-faint">
                {meta.map((p, i) => (
                  <React.Fragment key={i}>{p}</React.Fragment>
                ))}
              </div>
            </div>

            <Badge variant={b.variant}>{b.label}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasTxId ? (
              <Link className="text-xs font-medium underline" to={`${basePath}/transactions/items/${txId}`}>
                {i18n.t('transactions.tx.details')}
              </Link>
            ) : null}
            {hasTxId ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => toggleTx(txId)}
                testId={`tasks.inspect.tx.toggle.${txId}`}
              >
                {expanded ? i18n.t('common.collapse') : i18n.t('common.expand')}
              </Button>
            ) : null}
          </div>
        </div>

        {expanded ? (
          <div className="mt-3 border-t border-border pt-3" data-testid={`tasks.inspect.tx.expanded.${txId}`}>
            {errorText ? (
              <div className="mb-3">
                <Alert variant="danger" title={i18n.t('transactions.tx.error_title')}>
                  <pre className="whitespace-pre-wrap break-words text-xs">{errorText}</pre>
                </Alert>
              </div>
            ) : null}
            <TransactionPayloadPanels
              t={i18n.t}
              input={input}
              output={output}
              maxHeightClass="max-h-80"
              layout="stacked"
            />
          </div>
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
        <Link
          className="text-xs font-medium underline"
          to={`${basePath}/action-states/${id}`}
          data-testid="tasks.inspect.open_full"
        >
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
          {target ? <div><div className="text-xs text-muted">{i18n.t('tasks.meta.object')}</div><div>{target}</div></div> : null}
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

        {failureSummary ? (
          <div className="mt-3 rounded-md border border-danger-border bg-danger-bg p-2 text-xs text-muted" data-testid="tasks.inspect.failure_summary">
            <span className="font-medium text-danger">{i18n.t('tasks.meta.failure_summary')}:</span> {failureSummary}
          </div>
        ) : null}

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
        <pre
          className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-surface p-3 text-xs text-muted"
          data-testid="tasks.inspect.backend_details"
        >
          {backendDetailPayload(s)}
        </pre>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-medium text-muted">{i18n.t('tasks.inspect.transactions')}</div>
          <div className="flex flex-wrap items-center gap-2">
            {transactionIds.length > 0 ? (
              <>
                <Button size="sm" variant="secondary" onClick={expandAllTx}>
                  {i18n.t('tasks.inspect.expand_all')}
                </Button>
                <Button size="sm" variant="secondary" onClick={collapseAllTx}>
                  {i18n.t('tasks.inspect.collapse_all')}
                </Button>
              </>
            ) : null}
            {relatedChainId ? (
              <>
                <Link className="text-xs underline" to={`${basePath}/transactions/${relatedChainId}`} data-testid="tasks.inspect.open_chain">
                  {i18n.t('tasks.inspect.open_chain')}
                </Link>
                <Link
                  className="text-xs underline"
                  to={`${basePath}/transactions/items?transaction_chain=${relatedChainId}`}
                  data-testid="tasks.inspect.view_all"
                >
                  {i18n.t('tasks.action.view_all')}
                </Link>
              </>
            ) : null}
          </div>
        </div>
        {!relatedChainId ? (
          <div className="mt-2 text-sm text-muted">{i18n.t('tasks.inspect.no_chain')}</div>
        ) : txQ.isLoading ? (
          <div className="flex items-center justify-center py-6"><Spinner /></div>
        ) : txQ.isError ? (
          <Alert variant="danger" title={i18n.t('tasks.error.load_items')}>{formatErrorMessage(txQ.error)}</Alert>
        ) : transactionRows.length > 0 ? (
          <div className="mt-2 space-y-2">{transactionRows.map(renderTxCard)}</div>
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
    const target = compactActionTarget(s);
    const failureSummary = compactFailureSummary(s);

    const meta: React.ReactNode[] = [];
    meta.push(<span key="id">#{id}</span>);
    if (target) meta.push(<span key="target">{i18n.t('tasks.meta.object')}: {target}</span>);
    if (createdAt) meta.push(<span key="created">{i18n.t('tasks.meta.created', { time: createdAt })}</span>);
    if (updatedAt) meta.push(<span key="updated">{i18n.t('tasks.meta.updated', { time: updatedAt })}</span>);

    return (
      <div
        key={id}
        className={clsx('rounded-md border p-3', toneSurfaceClass(toneVariant), highlight ? 'ring-1 ring-warn-border' : null)}
        data-testid={`tasks.row.${id}`}
      >
        <div className="space-y-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2 text-sm font-medium">
              <StatusDot variant={dotVariant} title={badge.label} />
              <button
                type="button"
                className="min-w-0 flex-1 break-words text-left underline"
                onClick={() => setSelectedActionStateId(id)}
              >
                {label}
              </button>
            </div>

            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>

          {meta.length > 0 || relatedChainId ? (
            <div className="space-y-1 text-xs text-faint">
              {meta.map((p, i) => (
                <div key={i} className="break-words">
                  {p}
                </div>
              ))}

              {relatedChainId ? (
                <Link className="block break-words underline" to={`${basePath}/transactions/${relatedChainId}`}>
                  {i18n.t('tasks.meta.chain', { id: relatedChainId })}
                </Link>
              ) : null}
            </div>
          ) : null}

          {pLabel ? <div className="text-xs text-faint">{i18n.t('tasks.meta.progress', { progress: pLabel })}</div> : null}

          {failureSummary ? (
            <div className="rounded-md border border-danger-border bg-danger-bg p-2 text-xs text-muted" data-testid={`tasks.row.failure.${id}`}>
              <span className="font-medium text-danger">{i18n.t('tasks.meta.failure_summary')}:</span> {failureSummary}
            </div>
          ) : null}

          <div className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid={`tasks.row.actions.${id}`}>
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
