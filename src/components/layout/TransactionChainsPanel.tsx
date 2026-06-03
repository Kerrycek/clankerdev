import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Pin, PinOff } from 'lucide-react';

import { fetchTransactionChain, fetchTransactionChains, fetchTransactions, type Transaction, type TransactionChain } from '../../lib/api/transactions';
import { extractConcernRefs } from '../../lib/concerns';
import { shortConcernClassName } from '../../lib/concernLinks';
import { Spinner } from '../ui/Spinner';
import { clsx } from '../ui/clsx';
import { Badge } from '../ui/Badge';
import { StatusDot } from '../ui/StatusDot';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { toneProgressFillClass, toneSurfaceClass, type ToneVariant } from '../ui/tone';
import { useAppMode } from '../../app/appMode';
import { useI18n } from '../../app/i18n';
import { formatDateTime } from '../../lib/format';
import { useTierAIntervalMs } from '../../lib/refreshTiers';
import { durationSec, formatPayload, transactionErrorText } from '../../lib/txFormat';
import {
  chainBadgeFromState,
  chainProgressLabel,
  chainProgressPercent,
  isFailedChainState,
  isFinishedChainState,
  transactionBadge,
} from '../../lib/taskStatus';
import { resourceId, refLabel } from '../../lib/resources';
import { TransactionPayloadPanels } from '../ui/TransactionPayloadPanels';

function formatConcerns(chain: TransactionChain): string | null {
  const c = chain.concerns as any;
  const type = c && typeof c === 'object' && typeof c.type === 'string' ? c.type : null;

  const refs = extractConcernRefs(chain.concerns, { maxDepth: 3 });
  const parts = refs
    .slice(0, 3)
    .map((r) => `${shortConcernClassName(r.class_name)}#${r.row_id}`)
    .join(', ');

  if (!type && !parts) return null;
  if (type && parts) return `${type}: ${parts}`;
  return type ?? parts;
}

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

export function TransactionChainsPanel(props: {
  limit?: number;
  filterText?: string;
  pinnedIds?: number[];
  onTogglePin?: (chainId: number) => void;
}) {
  const { basePath } = useAppMode();
  const i18n = useI18n();
  const tierARefetchMs = useTierAIntervalMs();
  const [expandedChainId, setExpandedChainId] = useState<number | null>(null);
  const [expandedTransactionIds, setExpandedTransactionIds] = useState<Set<number>>(() => new Set());

  const pinnedIds = useMemo(() => parseIds(props.pinnedIds, 50), [props.pinnedIds]);
  const pinnedSet = useMemo(() => new Set<number>(pinnedIds), [pinnedIds]);

  const pinnedQs = useQueries({
    queries: pinnedIds.map((id) => ({
      queryKey: ['transaction_chains', 'show', { id }],
      queryFn: async () => (await fetchTransactionChain(id)).data,
      enabled: Number.isFinite(id) && id > 0,
      refetchInterval: tierARefetchMs,
    })),
  });

  const txQ = useQuery({
    queryKey: ['transactions', 'list', { transactionChainId: expandedChainId, limit: 100 }],
    queryFn: async () => {
      if (expandedChainId === null) return [] as Transaction[];
      return (await fetchTransactions({ transactionChainId: expandedChainId, limit: 100 })).data;
    },
    enabled: expandedChainId !== null,
    refetchInterval: expandedChainId !== null ? tierARefetchMs : false,
  });

  const toggleChain = (chainId: number, expanded: boolean) => {
    setExpandedChainId(expanded ? null : chainId);
    setExpandedTransactionIds(new Set());
  };

  const toggleTransaction = (txId: number) => {
    setExpandedTransactionIds((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  };

  const q = useQuery({
    queryKey: ['transaction_chains', 'list', { limit: props.limit ?? 10 }],
    queryFn: async () => (await fetchTransactionChains({ limit: props.limit ?? 10 })).data,
    refetchInterval: tierARefetchMs,
  });

  const needle = (props.filterText ?? '').trim().toLowerCase();

  const mergedRows = useMemo(() => {
    const map = new Map<number, { c: TransactionChain; pinned: boolean }>();

    for (let i = 0; i < pinnedIds.length; i++) {
      const requestedId = pinnedIds[i];
      const q2 = pinnedQs[i];
      if (q2?.data) {
        const id = Number((q2.data as any).id ?? requestedId);
        if (!Number.isFinite(id) || id <= 0) continue;
        map.set(id, { c: q2.data as any, pinned: true });
      }
    }

    for (const c of q.data ?? []) {
      const id = Number((c as any)?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (map.has(id)) continue;
      map.set(id, { c: c as any, pinned: pinnedSet.has(id) });
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      const aCreated = Date.parse(String((a.c as any).created_at ?? ''));
      const bCreated = Date.parse(String((b.c as any).created_at ?? ''));
      if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) {
        return bCreated - aCreated;
      }
      return Number((b.c as any).id ?? 0) - Number((a.c as any).id ?? 0);
    });

    if (!needle) return arr;

    return arr.filter(({ c }) => {
      const id = Number((c as any).id);
      const label = c.label ? String(c.label) : `#${id}`;
      const concerns = formatConcerns(c);
      const hay = `${label} ${id} ${concerns ?? ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [needle, pinnedIds, pinnedQs, pinnedSet, q.data]);

  const pinned = mergedRows.filter((x) => x.pinned);
  const rest = mergedRows.filter((x) => !x.pinned);

  const failed = rest.filter((x) => isFailedChainState(x.c.state));
  const active = rest.filter((x) => !isFinishedChainState(x.c.state));
  const recent = rest.filter((x) => isFinishedChainState(x.c.state) && !isFailedChainState(x.c.state));

  const anyLoading = q.isLoading && mergedRows.length === 0 && pinnedQs.every((x) => x.isLoading || !x.data);
  const anyError = q.isError && mergedRows.length === 0;

  const title = i18n.t('nav.transactions');
  const showViewAll = true;

  const header = (
    <div className="flex items-center justify-between">
      <div className="text-xs text-muted">
        {title}
        {needle ? <span className="text-faint"> · {i18n.t('tasks.meta.filtered')}</span> : null}
      </div>

      {showViewAll ? (
        <Link className="text-xs font-medium underline" to={`${basePath}/transactions`}>
          {i18n.t('tasks.action.view_all')}
        </Link>
      ) : null}
    </div>
  );

  if (anyLoading) {
    return (
      <div>
        {header}
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      </div>
    );
  }

  if (anyError) {
    return (
      <div>
        {header}
        <div className="mt-2 text-sm font-medium">{i18n.t('tasks.error.load_chains')}</div>
        <div className="mt-1 text-sm text-muted">{String((q.error as any)?.message ?? q.error)}</div>
      </div>
    );
  }

  if (mergedRows.length === 0) {
    return (
      <div>
        {header}
        <div className="mt-2 text-sm text-muted">
          {needle ? i18n.t('tasks.empty.no_chains_filtered') : i18n.t('tasks.empty.no_chains')}
        </div>
      </div>
    );
  }

  const renderChain = (x: { c: TransactionChain; pinned: boolean }) => {
    const c = x.c;
    const badge = chainBadgeFromState(c.state);
    const toneVariant: ToneVariant | undefined = ((): ToneVariant | undefined => {
      const v = badge.variant;
      if (v === 'ok' || v === 'warn' || v === 'danger' || v === 'info' || v === 'neutral') return v;
      return undefined;
    })();
    const dotVariant = toneVariant && toneVariant !== 'muted' ? toneVariant : 'neutral';
    const label = c.label ? String(c.label) : `#${c.id}`;
    const concerns = formatConcerns(c);

    const pct = chainProgressPercent(c);
    const countLabel = chainProgressLabel(c);

    const expanded = expandedChainId === c.id;

    const createdAt = formatDateTime(c.created_at);
    const meta: React.ReactNode[] = [];
    meta.push(<span key="id">#{c.id}</span>);
    meta.push(<span key="created">{i18n.t('tasks.meta.created', { time: createdAt })}</span>);

    return (
      <div
        key={c.id}
        className={clsx('rounded-md border p-3', toneSurfaceClass(toneVariant))}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <StatusDot variant={dotVariant} title={badge.label} />
              <Link className="underline" to={`${basePath}/transactions/${c.id}`}>
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
            </div>
            {concerns ? <div className="mt-1 text-xs text-faint">{concerns}</div> : null}
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {pct !== null ? (
              <div className="text-xs text-faint">{countLabel ? `${countLabel} · ${pct}%` : `${pct}%`}</div>
            ) : null}

            <div className="flex items-center gap-2">
              {props.onTogglePin ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => props.onTogglePin?.(c.id)}
                  title={x.pinned ? i18n.t('tasks.action.unpin') : i18n.t('tasks.action.pin')}
                  ariaLabel={x.pinned ? i18n.t('transactions.chains.unpin.aria') : i18n.t('transactions.chains.pin.aria')}
                >
                  {x.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                </Button>
              ) : null}

              <Button
                size="sm"
                variant="secondary"
                onClick={() => toggleChain(c.id, expanded)}
                title={expanded ? i18n.t('tasks.action.hide_items') : i18n.t('tasks.action.items')}
              >
                {expanded ? i18n.t('tasks.action.hide_items') : i18n.t('tasks.action.items')}
              </Button>
            </div>
          </div>
        </div>

        {pct !== null ? (
          <div className="mt-3 h-2 rounded-full bg-surface-2">
            <div className={clsx('h-2 rounded-full', toneProgressFillClass(toneVariant))} style={{ width: `${pct}%` }} />
          </div>
        ) : null}

        {expanded ? (
          <div className="mt-3 border-t border-border pt-3">
            {txQ.isLoading || txQ.isFetching ? (
              <div className="text-xs text-muted">
                <Spinner label={i18n.t('common.loading')} />
              </div>
            ) : txQ.isError ? (
              <div className="text-xs text-danger">{i18n.t('tasks.error.load_items')}</div>
            ) : (txQ.data ?? []).length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted">
                    {i18n.t('tasks.inspect.transactions')} · {(txQ.data ?? []).length}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setExpandedTransactionIds(
                          new Set(
                            (txQ.data ?? [])
                              .map((tx) => Number(tx.id))
                              .filter((id) => Number.isFinite(id) && id > 0)
                          )
                        )
                      }
                    >
                      {i18n.t('tasks.inspect.expand_all')}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setExpandedTransactionIds(new Set())}>
                      {i18n.t('tasks.inspect.collapse_all')}
                    </Button>
                  </div>
                </div>

                {(txQ.data ?? []).map((tx) => {
                  const b = transactionBadge(tx);
                  const name = tx.name ? String(tx.name) : `#${tx.id}`;
                  const txId = Number(tx.id);
                  const hasTxId = Number.isFinite(txId) && txId > 0;
                  const txExpanded = hasTxId && expandedTransactionIds.has(txId);
                  const nodeId = resourceId((tx as any).node);
                  const vpsId = resourceId((tx as any).vps);
                  const type = typeof (tx as any).type === 'number' ? Number((tx as any).type) : null;
                  const priority = typeof (tx as any).priority === 'number' ? Number((tx as any).priority) : null;
                  const started = (tx as any).started_at as string | null | undefined;
                  const finished = (tx as any).finished_at as string | null | undefined;
                  const sec = durationSec(started, finished);
                  const input = formatPayload((tx as any).input);
                  const output = formatPayload((tx as any).output);
                  const errorText = transactionErrorText(tx);
                  const hasPayload = Boolean(input || output);

                  return (
                    <div key={tx.id} className="rounded-md border border-border bg-surface p-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link className="text-xs font-medium underline" to={`${basePath}/transactions/items/${tx.id}`}>
                            {name}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-faint">
                            <span>#{tx.id}</span>
                            <span>{i18n.t('tasks.meta.created', { time: formatDateTime(tx.created_at) })}</span>
                            {type !== null ? <span>{i18n.t('transactions.items.row.type_chip', { type })}</span> : null}
                            {priority !== null ? <span>{i18n.t('transactions.tx.prio', { prio: priority })}</span> : null}
                            {nodeId ? <span>{refLabel((tx as any).node) || i18n.t('transactions.tx.node', { id: nodeId })}</span> : null}
                            {vpsId ? <span>{i18n.t('transactions.tx.vps', { id: vpsId })}</span> : null}
                            {sec !== null ? <span>{i18n.t('transactions.tx.duration', { sec })}</span> : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <Badge variant={b.variant}>{b.label}</Badge>
                          {hasTxId ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => toggleTransaction(txId)}
                              testId={`tasks.chain.tx.toggle.${txId}`}
                            >
                              {txExpanded ? i18n.t('common.collapse') : i18n.t('common.expand')}
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      {txExpanded ? (
                        <div className="mt-2">
                          {errorText ? (
                            <div className="mb-3">
                              <Alert variant="danger" title={i18n.t('transactions.tx.error_title')}>
                                <pre className="whitespace-pre-wrap break-words text-xs">{errorText}</pre>
                              </Alert>
                            </div>
                          ) : null}
                          {hasPayload ? (
                            <TransactionPayloadPanels
                              t={i18n.t}
                              input={input}
                              output={output}
                              maxHeightClass="max-h-72"
                              layout="stacked"
                            />
                          ) : (
                            <div className="rounded-md border border-border bg-surface-2 p-2 text-xs text-muted">
                              {i18n.t('transactions.tx.no_payload')}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-muted">{i18n.t('tasks.empty.no_items')}</div>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div>
      {header}

      <div className="mt-3 space-y-3">
      {pinned.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-faint">{i18n.t('tasks.section.pinned')}</div>
          {pinned.map(renderChain)}
        </div>
      ) : null}

      {failed.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-faint">{i18n.t('tasks.section.failed')}</div>
          {failed.map(renderChain)}
        </div>
      ) : null}

      {active.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-faint">{i18n.t('tasks.section.active')}</div>
          {active.map(renderChain)}
        </div>
      ) : null}

      {recent.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-faint">{i18n.t('tasks.section.recent')}</div>
          {recent.map(renderChain)}
        </div>
      ) : null}
      </div>
    </div>
  );
}
