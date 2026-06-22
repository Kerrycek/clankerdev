import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';

import type { Transaction } from '../../lib/api/transactions';
import { useI18n } from '../../app/i18n';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { TransactionInlineDetails } from '../../components/ui/TransactionInlineDetails';
import { formatDateTime } from '../../lib/format';
import {
  classifyTransaction,
  operationBadgeVariant,
  operationCategoryLabel,
  operationLabel,
  operationSeverityLabel,
} from '../../lib/operationTaxonomy';
import { resourceId, refLabel } from '../../lib/resources';
import { transactionBadge } from '../../lib/taskStatus';

export function ActionStateTransactionsTable(props: {
  transactions: Transaction[];
  basePath: string;
  expandedTx: Set<number>;
  currentTxId: number | null;
  failedTxId: number | null;
  onToggleExpandedTx: (txId: number) => void;
}) {
  const { t } = useI18n();

  return (
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
          {props.transactions.map((tx: Transaction) => {
            const txId = Number(tx.id);
            const hasTxId = Number.isFinite(txId) && txId > 0;
            const badge = transactionBadge(tx);
            const txOp = classifyTransaction(tx);
            const rawName = tx.name ? String(tx.name) : t('transactions.items.row.fallback_name');
            const name = txOp.key.endsWith('.unknown') ? rawName : operationLabel(txOp, t);
            const rawNameDiffers = txOp.rawLabel && txOp.rawLabel !== name;
            const nodeId = resourceId(tx.node);
            const vpsId = resourceId(tx.vps);
            const started = tx.started_at;
            const finished = tx.finished_at;
            const expanded = hasTxId && props.expandedTx.has(txId);
            const success = typeof tx.success === 'number' ? String(tx.success) : null;
            const isCurrent = hasTxId && props.currentTxId === txId;
            const isFailed = hasTxId && props.failedTxId === txId;

            return (
              <React.Fragment key={hasTxId ? txId : name}>
                <tr className="border-b border-border">
                  <td className="px-4 py-2 text-xs text-muted">
                    {hasTxId ? (
                      <Link className="text-accent hover:underline" to={`${props.basePath}/transactions/items/${txId}`}>
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
                      <Badge variant={operationBadgeVariant(txOp)}>{operationSeverityLabel(txOp, t)}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{name}</div>
                    <div className="mt-1 text-xs text-muted">
                      {operationCategoryLabel(txOp, t)}
                      {rawNameDiffers ? ` · ${t('operation.raw_name', { name: txOp.rawLabel })}` : null}
                      {typeof tx.type === 'number' ? ` · ${t('transactions.items.row.type_chip', { type: tx.type })}` : null}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {nodeId && props.basePath === '/admin' ? (
                      <Link className="text-accent hover:underline" to={`${props.basePath}/nodes/${nodeId}`}>
                        {refLabel(tx.node) || `#${nodeId}`}
                      </Link>
                    ) : nodeId ? (
                      <span className="text-muted">{refLabel(tx.node) || `#${nodeId}`}</span>
                    ) : (
                      <span className="text-faint">{t('common.na')}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {vpsId ? (
                      <Link className="text-accent hover:underline" to={`${props.basePath}/vps/${vpsId}`}>
                        {refLabel(tx.vps) || `#${vpsId}`}
                      </Link>
                    ) : (
                      <span className="text-faint">{t('common.na')}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">{formatDateTime(tx.created_at)}</td>
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
                        onClick={() => props.onToggleExpandedTx(txId)}
                      >
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    ) : null}
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-b border-border bg-surface-2" data-testid={`action_state.detail.tx.expanded.${txId}`}>
                    <td colSpan={10} className="px-4 py-4">
                      <TransactionInlineDetails tx={tx} t={t} basePath={props.basePath} raw={tx} maxHeightClass="max-h-80" />
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
