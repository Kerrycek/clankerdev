import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Pin, PinOff } from 'lucide-react';

import { cancelActionState, fetchActionState, type ActionState } from '../../lib/api/actionStates';
import { fetchTransactionChain, fetchTransactions, type Transaction } from '../../lib/api/transactions';
import { useAppMode } from '../../app/appMode';
import { useI18n } from '../../app/i18n';
import { DetailShell } from '../../components/layout/DetailShell';
import { useChrome } from '../../components/layout/ChromeContext';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ErrorState } from '../../components/ui/ErrorState';
import { LinkButton } from '../../components/ui/LinkButton';
import { LoadingState } from '../../components/ui/LoadingState';
import { ObjectHeader } from '../../components/ui/ObjectHeader';
import { Table } from '../../components/ui/Table';
import { TransactionInlineDetails } from '../../components/ui/TransactionInlineDetails';
import { formatDateTime } from '../../lib/format';
import { formatErrorMessage } from '../../lib/errors';
import { resourceId, refLabel } from '../../lib/resources';
import { durationSec, safeJson, transactionErrorText } from '../../lib/txFormat';
import { extractRelatedTransactionChainIdFromActionState } from '../../lib/taskLinks';
import {
  actionStateBadge,
  actionStateProgressLabel,
  actionStateProgressPercent,
  isFinishedActionState,
  transactionBadge,
} from '../../lib/taskStatus';
import { useActionStatePollIntervalMs, useTierAIntervalMs } from '../../lib/refreshTiers';

function pickedActionStateDebugPayload(s: ActionState): string {
  const keys = ['error', 'errors', 'exception', 'message', 'output', 'result', 'response', 'stderr', 'stdout', 'backtrace'];
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(s as any, key)) picked[key] = (s as any)[key];
  }
  return Object.keys(picked).length > 0 ? safeJson(picked) : safeJson(s);
}

function firstCurrentTransactionId(transactions: Transaction[] | undefined): number | null {
  for (const tx of transactions ?? []) {
    const txId = Number((tx as any).id);
    if (!Number.isFinite(txId) || txId <= 0) continue;
    if (String((tx as any).done ?? '') !== 'done') return txId;
  }
  return null;
}

function firstFailedTransactionId(transactions: Transaction[] | undefined): number | null {
  for (const tx of transactions ?? []) {
    const txId = Number((tx as any).id);
    if (!Number.isFinite(txId) || txId <= 0) continue;
    if (transactionBadge(tx).variant === 'danger') return txId;
  }
  return null;
}

export function ActionStateDetailPage() {
  const { basePath } = useAppMode();
  const chrome = useChrome();
  const { t } = useI18n();

  const actionPollMs = useActionStatePollIntervalMs();
  const tierARefetchMs = useTierAIntervalMs();
  const params = useParams();
  const id = Number(params['actionStateId']);
  const [expandedTx, setExpandedTx] = useState<Set<number>>(() => new Set());

  const q = useQuery({
    queryKey: ['action_state', 'show', { id }],
    queryFn: async () => (await fetchActionState(id)).data,
    enabled: Number.isFinite(id) && id > 0,
    refetchInterval: (data) => (data && isFinishedActionState(data as any) ? false : actionPollMs),
  });

  const s = q.data as any as ActionState | undefined;
  const relatedChainId = s ? extractRelatedTransactionChainIdFromActionState(s) : null;

  const chainQ = useQuery({
    queryKey: ['transaction_chains', 'show', { id: relatedChainId ?? -1 }],
    queryFn: async () => (await fetchTransactionChain(relatedChainId!)).data,
    enabled: Boolean(relatedChainId && relatedChainId > 0),
    refetchInterval: relatedChainId ? tierARefetchMs : false,
  });

  const txQ = useQuery({
    queryKey: ['transactions', 'list', { transactionChainId: relatedChainId ?? -1, limit: 500 }],
    queryFn: async () => (await fetchTransactions({ transactionChainId: relatedChainId!, limit: 500 })).data,
    enabled: Boolean(relatedChainId && relatedChainId > 0),
    refetchInterval: relatedChainId ? tierARefetchMs : false,
  });

  const tracked = useMemo(
    () => chrome.trackedActionStates.some((x) => x.id === id),
    [chrome.trackedActionStates, id]
  );
  const pinned = useMemo(() => chrome.pinnedActionStates.includes(id), [chrome.pinnedActionStates, id]);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelM = useMutation({
    mutationFn: async () => cancelActionState(id),
    onMutate: () => setCancelError(null),
    onSuccess: () => {
      setConfirmCancel(false);
      setCancelError(null);
      void q.refetch();
    },
    onError: (err: any) => {
      setCancelError(String(err?.message ?? err));
    },
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <DetailShell testId="action_state.detail">
        <ErrorState
          testId="action_state.detail.invalid_id"
          kindOverride="not_found"
          title={t('action_state.invalid_id.title')}
          body={t('action_state.invalid_id.body')}
          backTo={`${basePath}/action-states`}
          showStatusLink={false}
          showDetails={false}
          detailsExtra={{ page: 'action_state.detail', actionStateId: params['actionStateId'] }}
        />
      </DetailShell>
    );
  }

  if (q.isLoading && !s) {
    return (
      <DetailShell testId="action_state.detail">
        <LoadingState testId="action_state.detail.loading" />
      </DetailShell>
    );
  }

  if (q.isError) {
    return (
      <DetailShell testId="action_state.detail">
        <ErrorState
          testId="action_state.detail.error"
          title={t('action_state.load_error.title')}
          error={q.error}
          onRetry={() => void q.refetch()}
          backTo={`${basePath}/action-states`}
          detailsExtra={{ page: 'action_state.detail', actionStateId: id }}
        />
      </DetailShell>
    );
  }

  if (!s) {
    return (
      <DetailShell testId="action_state.detail">
        <ErrorState
          testId="action_state.detail.not_found"
          kindOverride="not_found"
          title={t('action_state.not_found.title')}
          body={t('action_state.not_found.body')}
          onRetry={() => void q.refetch()}
          backTo={`${basePath}/action-states`}
          showDetails={false}
          detailsExtra={{ page: 'action_state.detail', actionStateId: id }}
        />
      </DetailShell>
    );
  }

  const badge = actionStateBadge(s);
  const pct = actionStateProgressPercent(s);
  const pLabel = actionStateProgressLabel(s);

  const pinLabel = pinned ? t('tasks.action.unpin') : t('tasks.action.pin');

  const createdAt = (s as any).created_at ? formatDateTime(String((s as any).created_at)) : null;
  const updatedAt = (s as any).updated_at ? formatDateTime(String((s as any).updated_at)) : null;
  const transactionIds = (txQ.data ?? [])
    .map((tx) => Number((tx as any).id))
    .filter((txId) => Number.isFinite(txId) && txId > 0);
  const currentTxId = firstCurrentTransactionId(txQ.data);
  const failedTxId = firstFailedTransactionId(txQ.data);

  const toggleExpandedTx = (txId: number) => {
    setExpandedTx((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  };

  const expandAllTx = () => setExpandedTx(new Set(transactionIds));
  const collapseAllTx = () => setExpandedTx(new Set());

  return (
    <DetailShell testId="action_state.detail">
      <ObjectHeader
        testId="action_state.detail.header"
        title={s.label ? String(s.label) : t('action_state.title_fallback', { id })}
        kicker={
          <>
            <Link className="underline" to={`${basePath}/action-states`}>
              {t('nav.action_states')}
            </Link>
            {` / #${id}`}
          </>
        }
        badges={<Badge variant={badge.variant}>{badge.label}</Badge>}
        meta={
          <>
            {createdAt ? <span>{t('tasks.meta.created', { time: createdAt })}</span> : null}
            {createdAt && updatedAt ? <span> · </span> : null}
            {updatedAt ? <span>{t('tasks.meta.updated', { time: updatedAt })}</span> : null}
            <span className="ml-2 text-faint">· {t('tasks.meta.auto_refreshing')}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => q.refetch()} testId="action_state.detail.refresh">
              {t('common.refresh')}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => chrome.togglePinnedActionState(id)}
              title={pinLabel}
              ariaLabel={pinLabel}
              testId="action_state.detail.pin"
            >
              {pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </Button>

            {tracked ? (
              <Button variant="secondary" onClick={() => chrome.dismissActionState(id)} testId="action_state.detail.dismiss">
                {t('tasks.action.dismiss')}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => chrome.trackActionState(id)} testId="action_state.detail.track">
                {t('tasks.action.track')}
              </Button>
            )}

            <Button variant="secondary" onClick={() => chrome.openTasks()} testId="action_state.detail.open_tasks">
              {t('common.open_tasks')}
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader
          title={t('common.details')}
          subtitle={
            relatedChainId ? (
              <>
                {t('action_state.field.transaction_chain')}: {' '}
                <Link className="underline" to={`${basePath}/transactions/${relatedChainId}`}>
                  {chainQ.data?.label ? String(chainQ.data.label) : `#${relatedChainId}`}
                </Link>
              </>
            ) : undefined
          }
        />
        <CardBody>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <DebugSummaryTile label={t('common.state')} value={<Badge variant={badge.variant}>{badge.label}</Badge>} />
            <DebugSummaryTile label={t('common.progress')} value={pLabel ? `${pLabel}${pct !== null ? ` · ${pct}%` : ''}` : t('common.na')} />
            <DebugSummaryTile
              label={failedTxId ? t('transactions.tx.failed_here') : t('transactions.tx.current_step')}
              value={
                failedTxId ? (
                  <Link className="text-danger hover:underline" to={`${basePath}/transactions/items/${failedTxId}`}>
                    #{failedTxId}
                  </Link>
                ) : currentTxId ? (
                  <Link className="text-accent hover:underline" to={`${basePath}/transactions/items/${currentTxId}`}>
                    #{currentTxId}
                  </Link>
                ) : relatedChainId ? (
                  t('common.na')
                ) : (
                  t('tasks.inspect.no_chain')
                )
              }
            />
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted">{t('common.id')}:</span> <span className="font-medium">#{id}</span>
            </div>
            <div>
              <span className="text-muted">{t('action_state.field.can_cancel')}:</span>{' '}
              {Boolean((s as any).can_cancel) ? t('common.yes') : t('common.no')}
            </div>
            {createdAt ? (
              <div>
                <span className="text-muted">{t('common.created')}:</span> {createdAt}
              </div>
            ) : null}
            {updatedAt ? (
              <div>
                <span className="text-muted">{t('common.updated')}:</span> {updatedAt}
              </div>
            ) : null}
            {pLabel ? (
              <div className="sm:col-span-2">
                <span className="text-muted">{t('common.progress')}:</span> {pLabel}
              </div>
            ) : null}
          </div>

          {pct !== null ? (
            <div className="mt-4">
              <div className="h-2 rounded-full bg-surface-2">
                <div className="h-2 rounded-full bg-fg/60" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 text-xs text-faint">{pct}%</div>
            </div>
          ) : null}

          {Boolean((s as any).can_cancel) && !isFinishedActionState(s) ? (
            <div className="pt-4">
              <Button
                variant="danger"
                onClick={() => {
                  setCancelError(null);
                  setConfirmCancel(true);
                }}
                loading={cancelM.isPending}
                testId="action_state.detail.cancel"
              >
                {t('tasks.action.cancel')}
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card testId="action_state.detail.debug">
        <CardHeader title={t('action_state.section.debug')} subtitle={t('action_state.section.debug_subtitle')} />
        <CardBody>
          <pre className="max-h-80 overflow-auto rounded-md border border-border bg-surface-2 p-3 text-xs text-muted">
            {pickedActionStateDebugPayload(s)}
          </pre>
        </CardBody>
      </Card>

      <Card testId="action_state.detail.transactions">
        <CardHeader
          title={t('action_state.section.transactions')}
          subtitle={
            relatedChainId
              ? t('action_state.section.transactions_subtitle', { id: relatedChainId })
              : t('action_state.section.transactions_subtitle_empty')
          }
          actions={
            <div className="flex flex-wrap gap-2">
              {transactionIds.length > 0 ? (
                <>
                  <Button size="sm" variant="secondary" onClick={expandAllTx}>
                    {t('transactions.chain.detail.expand_all')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={collapseAllTx}>
                    {t('transactions.chain.detail.collapse_all')}
                  </Button>
                </>
              ) : null}
              {relatedChainId ? (
                <>
                  <LinkButton to={`${basePath}/transactions/${relatedChainId}`} variant="secondary" size="sm">
                    {t('tasks.inspect.open_chain')}
                  </LinkButton>
                  <LinkButton
                    to={`${basePath}/transactions/items?transaction_chain=${relatedChainId}`}
                    variant="secondary"
                    size="sm"
                    testId="action_state.detail.transactions.view_all"
                  >
                    {t('tasks.action.view_all')}
                  </LinkButton>
                </>
              ) : null}
            </div>
          }
        />
        <CardBody>
          {!relatedChainId ? (
            <div className="text-sm text-muted">{t('tasks.inspect.no_chain')}</div>
          ) : txQ.isLoading ? (
            <LoadingState testId="action_state.detail.transactions.loading" />
          ) : txQ.isError ? (
            <Alert variant="danger" title={t('tasks.error.load_items')}>
              {formatErrorMessage(txQ.error)}
            </Alert>
          ) : (txQ.data ?? []).length === 0 ? (
            <div>
              <div className="text-sm font-medium">{t('transactions.chain.detail.empty.title')}</div>
              <div className="mt-1 text-sm text-muted">{t('transactions.chain.detail.empty.body')}</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table testId="action_state.detail.transactions.table" minWidth="lg" variant="list">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-2">{t('common.id')}</th>
                    <th className="px-4 py-2">{t('common.state')}</th>
                    <th className="px-4 py-2">{t('common.name')}</th>
                    <th className="px-4 py-2">{t('common.node')}</th>
                    <th className="px-4 py-2">{t('common.vps')}</th>
                    <th className="px-4 py-2">{t('common.created')}</th>
                    <th className="px-4 py-2">{t('common.started')}</th>
                    <th className="px-4 py-2">{t('common.finished')}</th>
                    <th className="px-4 py-2">{t('transactions.tx.success_label')}</th>
                    <th className="px-4 py-2">
                      <span className="sr-only">{t('transactions.tx.details')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(txQ.data ?? []).map((tx: Transaction) => {
                    const txId = Number((tx as any).id);
                    const hasTxId = Number.isFinite(txId) && txId > 0;
                    const badge = transactionBadge(tx);
                    const name = tx.name ? String(tx.name) : t('transactions.items.row.fallback_name');
                    const nodeId = resourceId((tx as any).node);
                    const vpsId = resourceId((tx as any).vps);
                    const started = (tx as any).started_at as string | null | undefined;
                    const finished = (tx as any).finished_at as string | null | undefined;
                    const sec = durationSec(started, finished);
                    const expanded = hasTxId && expandedTx.has(txId);
                    const success = typeof (tx as any).success === 'number' ? String((tx as any).success) : null;
                    const isCurrent = hasTxId && currentTxId === txId;
                    const isFailed = hasTxId && failedTxId === txId;

                    return (
                      <React.Fragment key={hasTxId ? txId : name}>
                        <tr className="border-b border-border">
                          <td className="px-4 py-2 text-xs text-muted">
                            {hasTxId ? (
                              <Link className="text-accent hover:underline" to={`${basePath}/transactions/items/${txId}`}>
                                #{txId}
                              </Link>
                            ) : (
                              t('common.na')
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={badge.variant}>{badge.label}</Badge>
                              {isFailed ? <Badge variant="danger">{t('transactions.tx.failed_here')}</Badge> : null}
                              {!isFailed && isCurrent ? <Badge variant="warn">{t('transactions.tx.current_step')}</Badge> : null}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="font-medium">{name}</div>
                            <div className="mt-1 text-xs text-muted">
                              {typeof (tx as any).type === 'number' ? t('transactions.items.row.type_chip', { type: (tx as any).type }) : null}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {nodeId && basePath === '/admin' ? (
                              <Link className="text-accent hover:underline" to={`${basePath}/nodes/${nodeId}`}>
                                {refLabel((tx as any).node) || `#${nodeId}`}
                              </Link>
                            ) : nodeId ? (
                              <span className="text-muted">{refLabel((tx as any).node) || `#${nodeId}`}</span>
                            ) : (
                              <span className="text-faint">{t('common.na')}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {vpsId ? (
                              <Link className="text-accent hover:underline" to={`${basePath}/vps/${vpsId}`}>
                                {refLabel((tx as any).vps) || `#${vpsId}`}
                              </Link>
                            ) : (
                              <span className="text-faint">{t('common.na')}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs text-muted">{formatDateTime((tx as any).created_at)}</td>
                          <td className="px-4 py-2 text-xs text-muted">{formatDateTime(started)}</td>
                          <td className="px-4 py-2 text-xs text-muted">{formatDateTime(finished)}</td>
                          <td className="px-4 py-2 text-xs text-muted">{success ?? t('common.na')}</td>
                          <td className="px-4 py-2">
                            {hasTxId ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 px-0"
                                ariaLabel={expanded ? t('common.collapse') : t('common.expand')}
                                title={t('transactions.tx.details')}
                                testId={`action_state.detail.tx.toggle.${txId}`}
                                onClick={() => toggleExpandedTx(txId)}
                              >
                                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            ) : null}
                          </td>
                        </tr>

                        {expanded ? (
                          <tr className="border-b border-border bg-surface-2" data-testid={`action_state.detail.tx.expanded.${txId}`}>
                            <td colSpan={10} className="px-4 py-4">
                              <TransactionInlineDetails
                                tx={tx}
                                t={t}
                                basePath={basePath}
                                raw={tx}
                                maxHeightClass="max-h-80"
                              />
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        testId="tasks.cancel_dialog"
        open={confirmCancel}
        title={t('tasks.cancel_dialog.title')}
        description={s.label ? String(s.label) : t('tasks.cancel_dialog.description_default')}
        danger
        confirmLabel={t('tasks.cancel_dialog.confirm')}
        confirmLoading={cancelM.isPending}
        onCancel={() => {
          setConfirmCancel(false);
          setCancelError(null);
        }}
        onConfirm={() => cancelM.mutate()}
      >
        {cancelError ? (
          <Alert variant="danger" title={t('tasks.cancel_dialog.failed_title')}>
            {cancelError}
          </Alert>
        ) : null}
      </ConfirmDialog>
    </DetailShell>
  );
}

function DebugSummaryTile(props: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="text-xs text-muted">{props.label}</div>
      <div className="mt-1 text-sm font-medium">{props.value}</div>
    </div>
  );
}
