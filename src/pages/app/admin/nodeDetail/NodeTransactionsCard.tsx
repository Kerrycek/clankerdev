import React from 'react';
import { Link } from 'react-router-dom';
import type { Transaction } from '../../../../lib/api/transactions';
import { formatDateTime } from '../../../../lib/format';
import { Alert } from '../../../../components/ui/Alert';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { ChipLink, MiniLink } from '../../../../components/ui/ChipLink';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { LinkButton } from '../../../../components/ui/LinkButton';
import { Spinner } from '../../../../components/ui/Spinner';
import { TableRowLink } from '../../../../components/ui/TableRowLink';
import { formatErrorMessage } from '../../../../lib/errors';
import { fmt, resourceId, txBadge, txRowVariant } from './nodeDetailSemantics';

export function NodeTransactionsCard(props: {
  t: (key: any, params?: Record<string, unknown>) => string;
  basePath: string;
  nodeId: number;
  txRows: Transaction[];
  loading: boolean;
  error: unknown;
  fetching: boolean;
  onRefresh: () => void;
  page: number;
  pageCount: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoToPage: (page: number) => void;
  limit: number;
  allowedLimits: readonly number[];
  onLimitChange: (limit: number) => void;
}) {
  const {
    t,
    basePath,
    nodeId,
    txRows,
    loading,
    error,
    fetching,
    onRefresh,
    page,
    pageCount,
    canPrev,
    canNext,
    onPrev,
    onNext,
    onGoToPage,
    limit,
    allowedLimits,
    onLimitChange,
  } = props;

  return (
    <Card testId="admin.node.transactions.list">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{t('admin.node.transactions.title')}</div>
            <div className="mt-1 text-sm text-muted">
              {t('admin.node.transactions.subtitle_prefix', { limit })} <code>{`node=${nodeId}`}</code>.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div data-testid="admin.node.transactions.open_all">
              <LinkButton to={`${basePath}/transactions/items?node=${encodeURIComponent(String(nodeId))}`} variant="secondary" size="sm">
                {t('admin.node.transactions.open_all')}
              </LinkButton>
            </div>
            <Button testId="admin.node.transactions.refresh" variant="secondary" size="sm" onClick={onRefresh} disabled={fetching}>
              {t('common.refresh')}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Spinner /> {t('common.loading')}
          </div>
        ) : error ? (
          <Alert title={t('common.failed')} variant="danger">
            {formatErrorMessage(error)}
          </Alert>
        ) : txRows.length === 0 ? (
          <div className="mt-4 text-sm text-muted">{t('admin.node.transactions.empty')}</div>
        ) : (
          <>
            <div className="mt-4 space-y-3 md:hidden">
              {txRows.map((tx) => {
                const b = txBadge(tx);
                const vpsId = resourceId(tx.vps);
                const chainId = resourceId(tx.transaction_chain);
                return (
                  <div key={tx.id} className="rounded-md border border-border bg-surface-2 p-3" data-testid={`admin.node.transactions.card.${tx.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{formatDateTime(tx.created_at)}</div>
                        <div className="mt-0.5 truncate text-xs text-faint">{tx.name ? fmt(tx.name) : t('admin.node.transactions.transaction_fallback', { id: tx.id })}</div>
                      </div>
                      <Badge variant={b.variant}>{b.label}</Badge>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted">{t('common.vps')}</div>
                        <div className="text-sm">{vpsId ? `#${vpsId}` : '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">{t('common.chain')}</div>
                        <div className="text-sm">{chainId ? `#${chainId}` : '—'}</div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {tx.id ? (
                        <MiniLink to={`${basePath}/transactions/items/${tx.id}`} title={t('common.open_transaction')}>
                          {t('admin.node.transactions.link.tx')}
                        </MiniLink>
                      ) : null}
                      {vpsId ? (
                        <MiniLink to={`${basePath}/vps/${vpsId}`} title={t('common.open_vps')}>
                          {t('admin.node.transactions.link.vps')}
                        </MiniLink>
                      ) : null}
                      {chainId ? (
                        <MiniLink to={`${basePath}/transactions/${chainId}`} title={t('common.open_chain')}>
                          {t('admin.node.transactions.link.chain')}
                        </MiniLink>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 hidden overflow-x-auto md:block" data-testid="admin.node.transactions.table">
              <table className="min-w-full text-sm table-list">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-3 py-2">{t('common.time')}</th>
                    <th className="px-3 py-2">{t('common.state')}</th>
                    <th className="px-3 py-2">{t('common.name')}</th>
                    <th className="px-3 py-2">{t('common.vps')}</th>
                    <th className="px-3 py-2">{t('common.chain')}</th>
                  </tr>
                </thead>
                <tbody>
                  {txRows.map((tx) => {
                    const b = txBadge(tx);
                    const vpsId = resourceId(tx.vps);
                    const chainId = resourceId(tx.transaction_chain);
                    return (
                      <TableRowLink
                        key={tx.id}
                        testId={`admin.node.transactions.row.${tx.id}`}
                        to={tx.id ? `${basePath}/transactions/items/${tx.id}` : undefined}
                        variant={txRowVariant(tx)}
                        className="border-b border-border/60 last:border-b-0"
                      >
                        <td className="px-3 py-2 text-xs text-muted">{formatDateTime(tx.created_at)}</td>
                        <td className="px-3 py-2">
                          <Badge variant={b.variant}>{b.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {tx.id ? (
                            <Link className="font-medium underline" to={`${basePath}/transactions/items/${tx.id}`}>
                              {tx.name ? fmt(tx.name) : t('admin.node.transactions.transaction_fallback', { id: tx.id })}
                            </Link>
                          ) : (
                            <span className="text-muted">{fmt(tx.name)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {vpsId ? (
                            <span className="inline-flex items-center gap-1">
                              <ChipLink to={`${basePath}/transactions/items?node=${encodeURIComponent(String(nodeId))}&vps=${encodeURIComponent(String(vpsId))}`} title={t('admin.node.transactions.filter_by_vps_title', { id: vpsId })}>
                                #{vpsId}
                              </ChipLink>
                              <MiniLink to={`${basePath}/vps/${vpsId}`} title={t('common.open_vps')}>
                                {t('common.open')}
                              </MiniLink>
                            </span>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {chainId ? (
                            <span className="inline-flex items-center gap-1">
                              <ChipLink to={`${basePath}/transactions/items?node=${encodeURIComponent(String(nodeId))}&transaction_chain=${encodeURIComponent(String(chainId))}`} title={t('admin.node.transactions.filter_by_chain_title', { id: chainId })}>
                                #{chainId}
                              </ChipLink>
                              <MiniLink to={`${basePath}/transactions/${chainId}`} title={t('common.open_chain_detail')}>
                                {t('common.open')}
                              </MiniLink>
                            </span>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                      </TableRowLink>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {!loading && !error ? (
        <KeysetPagination
          page={page}
          pageCount={pageCount}
          canPrev={canPrev}
          canNext={canNext}
          onPrev={onPrev}
          onNext={onNext}
          onGoToPage={onGoToPage}
          limit={limit}
          allowedLimits={allowedLimits}
          onLimitChange={onLimitChange}
          testId="admin.node.transactions.pagination"
        />
      ) : null}
    </Card>
  );
}
