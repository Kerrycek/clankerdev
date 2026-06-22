import React from 'react';
import { Link } from 'react-router-dom';

import type { Transaction } from '../../lib/api/transactions';
import { formatDateTime } from '../../lib/format';
import { resourceId, refLabel } from '../../lib/resources';
import { durationSec, formatPayload, transactionErrorText } from '../../lib/txFormat';
import { transactionBadge } from '../../lib/taskStatus';
import {
  classifyTransaction,
  operationBadgeVariant,
  operationCategoryLabel,
  operationLabel,
  operationSeverityLabel,
  operationVisibilityLabel,
} from '../../lib/operationTaxonomy';

import { Badge } from './Badge';
import { TransactionDebugSections } from './TransactionPayloadPanels';

export function TransactionInlineDetails(props: {
  tx: Transaction;
  t: (k: any, vars?: any) => string;
  basePath: string;
  maxHeightClass?: string;
  payloadLayout?: 'grid' | 'stacked';
  raw?: unknown;
  testId?: string;
}) {
  const { tx, t, basePath } = props;
  const row = tx as any;
  const badge = transactionBadge(tx);
  const operation = classifyTransaction(tx);
  const operationName = operationLabel(operation, t);
  const rawName = tx.name ? String(tx.name) : '';
  const txId = Number(row.id);
  const chainId = resourceId(row.transaction_chain);
  const nodeId = resourceId(row.node);
  const vpsId = resourceId(row.vps);
  const userId = resourceId(row.user);
  const type = typeof row.type === 'number' ? Number(row.type) : null;
  const priority = typeof row.priority === 'number' ? Number(row.priority) : null;
  const progress = typeof row.progress === 'number' ? String(row.progress) : null;
  const success = typeof row.success === 'number' ? String(row.success) : null;
  const done = row.done ? String(row.done) : null;
  const created = row.created_at as string | null | undefined;
  const started = row.started_at as string | null | undefined;
  const finished = row.finished_at as string | null | undefined;
  const sec = durationSec(started, finished);
  const objectValue = row.object ?? row.object_ref ?? row.object_reference ?? null;
  const objectText = objectValue
    ? refLabel(objectValue) || formatPayload(objectValue)
    : vpsId
      ? refLabel(row.vps) || `#${vpsId}`
      : '';
  const deps = Array.isArray(row.depends_on) ? (row.depends_on as any[]) : [];

  return (
    <div className="space-y-4" data-testid={props.testId}>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Meta label={t('common.id')} value={Number.isFinite(txId) && txId > 0 ? `#${txId}` : t('common.na')} />
        <Meta label={t('common.state')} value={<Badge variant={badge.variant}>{badge.label}</Badge>} />
        <Meta
          label={t('common.name')}
          value={
            <span className="space-y-1">
              <span className="block">{operationName}</span>
              <span className="flex flex-wrap gap-1">
                <Badge variant={operationBadgeVariant(operation)}>{operationCategoryLabel(operation, t)}</Badge>
                {operation.severity !== 'normal' ? <Badge variant={operationBadgeVariant(operation)}>{operationSeverityLabel(operation, t)}</Badge> : null}
                {operation.visibility !== 'user' ? <Badge variant={operationBadgeVariant(operation)}>{operationVisibilityLabel(operation, t)}</Badge> : null}
              </span>
              {rawName && rawName !== operationName ? (
                <span className="block text-xs text-faint">{t('operation.raw_name', { name: rawName })}</span>
              ) : null}
            </span>
          }
        />
        <Meta
          label={t('transactions.tx.type_label')}
          value={type !== null ? t('transactions.items.row.type_chip', { type }) : t('common.na')}
        />
        <Meta label={t('transactions.tx.prio_label')} value={priority !== null ? String(priority) : t('common.na')} />
        <Meta label={t('transactions.tx.done_label')} value={done ?? t('common.na')} />
        <Meta label={t('transactions.tx.success_label')} value={success ?? t('common.na')} />
        <Meta label={t('common.progress')} value={progress ?? t('common.na')} />
        <Meta label={t('transactions.tx.queued_at_label')} value={formatDateTime(created)} />
        <Meta label={t('common.started')} value={formatDateTime(started)} />
        <Meta label={t('common.finished')} value={formatDateTime(finished)} />
        <Meta label={t('transactions.tx.duration_label')} value={sec !== null ? t('transactions.tx.duration', { sec }) : t('common.na')} />
        <Meta
          label={t('common.chain')}
          value={
            chainId ? (
              <Link className="text-accent hover:underline" to={`${basePath}/transactions/${chainId}`}>
                #{chainId}
              </Link>
            ) : (
              t('common.na')
            )
          }
        />
        <Meta
          label={t('common.node')}
          value={
            nodeId && basePath === '/admin' ? (
              <Link className="text-accent hover:underline" to={`${basePath}/nodes/${nodeId}`}>
                {refLabel(row.node) || `#${nodeId}`}
              </Link>
            ) : nodeId ? (
              refLabel(row.node) || `#${nodeId}`
            ) : (
              t('common.na')
            )
          }
        />
        <Meta
          label={t('common.vps')}
          value={
            vpsId ? (
              <Link className="text-accent hover:underline" to={`${basePath}/vps/${vpsId}`}>
                {refLabel(row.vps) || `#${vpsId}`}
              </Link>
            ) : (
              t('common.na')
            )
          }
        />
        <Meta label={t('common.user')} value={userId ? refLabel(row.user) || `#${userId}` : t('common.na')} />
        <Meta label={t('transactions.tx.object_label')} value={objectText || t('common.na')} wide />
        {deps.length ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <div className="text-xs text-muted">{t('transactions.tx.depends_on')}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {deps.map((d, idx) => {
                const id = resourceId(d);
                if (!id) return null;
                return (
                  <Link
                    key={idx}
                    to={`${basePath}/transactions/items/${id}`}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-accent hover:underline"
                  >
                    #{id}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <TransactionDebugSections
        t={t}
        input={formatPayload(row.input)}
        output={formatPayload(row.output)}
        errorText={transactionErrorText(tx)}
        source={row}
        raw={props.raw}
        maxHeightClass={props.maxHeightClass}
        payloadLayout={props.payloadLayout}
      />
    </div>
  );
}

function Meta(props: { label: React.ReactNode; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={props.wide ? 'sm:col-span-2 lg:col-span-4' : undefined}>
      <div className="text-xs text-muted">{props.label}</div>
      <div className="mt-1 break-words text-sm">{props.value}</div>
    </div>
  );
}
