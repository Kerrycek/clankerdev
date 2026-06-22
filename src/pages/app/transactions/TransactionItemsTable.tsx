import React from 'react';
import { Link } from 'react-router-dom';

import { formatDateTime } from '../../../lib/format';
import type { KeysetPaginationState } from '../../../lib/hooks/useKeysetPagination';
import { Badge } from '../../../components/ui/Badge';
import { ChipLink, MiniLink } from '../../../components/ui/ChipLink';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { StatusDot } from '../../../components/ui/StatusDot';
import { TableCard } from '../../../components/ui/TableCard';
import { TableRowLink } from '../../../components/ui/TableRowLink';
import { operationBadgeVariant, operationCategoryLabel, operationSeverityLabel, operationVisibilityLabel } from '../../../lib/operationTaxonomy';

import {
  buildTransactionItemsFilterHref,
  type TransactionItemRow,
  type TransactionItemsFilterHrefArgs,
  type TransactionItemsTranslator,
} from './transactionItemSemantics';

interface TransactionItemsTableProps {
  rows: TransactionItemRow[];
  basePath: string;
  t: TransactionItemsTranslator;
  mode: 'app' | 'admin';
  pagination: KeysetPaginationState;
  canNext: boolean;
  pageCursor: number | null;
  filterHrefArgs: Omit<TransactionItemsFilterHrefArgs, 'overrides'>;
}

export function TransactionItemsTable({ rows, basePath, t, mode, pagination, canNext, pageCursor, filterHrefArgs }: TransactionItemsTableProps) {
  const buildFilterHref = (overrides: TransactionItemsFilterHrefArgs['overrides']) => buildTransactionItemsFilterHref({ ...filterHrefArgs, overrides });

  return (
    <TableCard
      testId="transactions.items.table"
      minWidth="lg"
      footer={
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
          testId="transactions.items.pagination"
        />
      }
    >
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted">
          <th className="px-3 py-2">
            <span className="sr-only">{t('common.state')}</span>
          </th>
          <th className="px-4 py-2">{t('common.id')}</th>
          <th className="px-4 py-2">{t('common.state')}</th>
          <th className="px-4 py-2">{t('common.name')}</th>
          {mode === 'admin' ? <th className="px-4 py-2">{t('common.user')}</th> : null}
          <th className="px-4 py-2">{t('common.node')}</th>
          <th className="px-4 py-2">{t('common.vps')}</th>
          <th className="px-4 py-2">{t('common.chain')}</th>
          <th className="px-4 py-2">{t('common.created')}</th>
          <th className="px-4 py-2">{t('common.started')}</th>
          <th className="px-4 py-2">{t('common.finished')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <TableRowLink
            key={row.id ?? row.name}
            testId={row.id ? `transactions.items.row.${row.id}` : undefined}
            to={row.id ? `${basePath}/transactions/items/${row.id}` : undefined}
            variant={row.rowVariant}
            className="border-b border-border last:border-b-0"
          >
            <td className="px-3 py-2">
              <StatusDot
                variant={row.dotVariant}
                ariaLabel={row.badgeLabel}
                title={row.badgeLabel}
                testId={row.id ? `transactions.items.row.${row.id}.dot` : undefined}
              />
            </td>
            <td className="px-4 py-2 text-xs text-muted">
              {row.id ? (
                <Link className="text-accent hover:underline" to={`${basePath}/transactions/items/${row.id}`}>
                  {row.id}
                </Link>
              ) : (
                t('common.na')
              )}
            </td>
            <td className="px-4 py-2">
              <Badge variant={row.badgeVariant}>{row.badgeLabel}</Badge>
            </td>
            <td className="px-4 py-2">
              <div className="font-medium">
                {row.id ? (
                  <Link className="text-accent hover:underline" to={`${basePath}/transactions/items/${row.id}`}>
                    {row.displayName}
                  </Link>
                ) : (
                  row.name
                )}
              </div>
              {row.name !== row.displayName ? (
                <div className="mt-1 text-xs text-faint">{t('operation.raw_name', { name: row.name })}</div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant={operationBadgeVariant(row.operation)}>{operationCategoryLabel(row.operation, t)}</Badge>
                {row.operation.severity !== 'normal' ? <Badge variant={operationBadgeVariant(row.operation)}>{operationSeverityLabel(row.operation, t)}</Badge> : null}
                {row.operation.visibility !== 'user' ? <Badge variant="info">{operationVisibilityLabel(row.operation, t)}</Badge> : null}
              </div>
              {typeof row.type === 'number' ? (
                <div className="mt-1">
                  <ChipLink
                    to={buildFilterHref({ type: row.type })}
                    title={t('transactions.filter.title', { text: t('transactions.items.row.type_chip', { type: row.type }) })}
                  >
                    {t('transactions.items.row.type_chip', { type: row.type })}
                  </ChipLink>
                </div>
              ) : null}
            </td>

            {mode === 'admin' ? (
              <td className="px-4 py-2 text-xs text-muted">
                {row.userId ? (
                  <ChipLink to={buildFilterHref({ user: row.userId })} title={t('filters.smart.suggest.user_id', { id: row.userId })}>
                    {row.userLabel || `#${row.userId}`}
                  </ChipLink>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
            ) : null}
            <td className="px-4 py-2 text-xs text-muted">
              {row.nodeId ? (
                <span className="inline-flex items-center gap-1">
                  <ChipLink to={buildFilterHref({ node: row.nodeId })} title={t('transactions.filter.title', { text: row.nodeLabel ?? `#${row.nodeId}` })}>
                    {row.nodeLabel ?? `#${row.nodeId}`}
                  </ChipLink>
                  {mode === 'admin' ? (
                    <MiniLink to={`${basePath}/nodes/${row.nodeId}`} title={t('common.open_node')}>
                      {t('common.open')}
                    </MiniLink>
                  ) : null}
                </span>
              ) : (
                <span className="text-faint">{t('common.na')}</span>
              )}
            </td>
            <td className="px-4 py-2 text-xs">
              {row.vpsId ? (
                <span className="inline-flex items-center gap-1">
                  <ChipLink
                    to={buildFilterHref({ vps: row.vpsId })}
                    title={t('transactions.filter.title', { text: t('transactions.items.row.vps_chip', { id: row.vpsId }) })}
                  >
                    #{row.vpsId}
                  </ChipLink>
                  <MiniLink to={`${basePath}/vps/${row.vpsId}`} title={t('common.open_vps')}>
                    {t('common.open')}
                  </MiniLink>
                </span>
              ) : (
                <span className="text-faint">{t('common.na')}</span>
              )}
            </td>
            <td className="px-4 py-2 text-xs">
              {row.chainId ? (
                <span className="inline-flex items-center gap-1">
                  <ChipLink
                    to={buildFilterHref({ transaction_chain: row.chainId })}
                    title={t('transactions.filter.title', { text: t('transactions.items.row.chain_chip', { id: row.chainId }) })}
                  >
                    #{row.chainId}
                  </ChipLink>
                  <MiniLink to={`${basePath}/transactions/${row.chainId}`} title={t('common.open_chain_detail')}>
                    {t('common.open')}
                  </MiniLink>
                </span>
              ) : (
                <span className="text-faint">{t('common.na')}</span>
              )}
            </td>
            <td className="px-4 py-2 text-xs text-muted">{formatDateTime(row.createdAt)}</td>
            <td className="px-4 py-2 text-xs text-muted">{formatDateTime(row.startedAt)}</td>
            <td className="px-4 py-2 text-xs text-muted">{formatDateTime(row.finishedAt)}</td>
          </TableRowLink>
        ))}
      </tbody>
    </TableCard>
  );
}
