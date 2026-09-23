import React from 'react';
import { Link } from 'react-router-dom';

import { useAccountTimeZone } from '../../../app/accountTimeZone';
import { useI18n } from '../../../app/i18n';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { StatusDot } from '../../../components/ui/StatusDot';
import { TableCard } from '../../../components/ui/TableCard';
import { TableRowLink } from '../../../components/ui/TableRowLink';
import type { IncomingPayment } from '../../../lib/api/payments';
import { formatDateTimeInTimeZone } from '../../../lib/format';
import type { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import {
  incomingPaymentBadgeVariant,
  incomingPaymentRowVariant,
  incomingPaymentStateLabelKey,
} from '../../../lib/paymentsBadges';
import { dotVariantFromBadgeVariant } from '../../../lib/variantMap';
import {
  incomingPaymentAccountedAmountLabel,
  incomingPaymentReceivedAmountLabel,
} from './IncomingPaymentsModel';

type PaginationController = ReturnType<typeof useKeysetPagination>;

function incomingPaymentDetailHref(basePath: string, paymentId: number, returnTo: string): string {
  const params = new URLSearchParams({ returnTo });
  return `${basePath}/payments/incoming/${paymentId}?${params.toString()}`;
}

export function IncomingPaymentsListContent(props: {
  rows: IncomingPayment[];
  basePath: string;
  returnTo: string;
  reviewableCount: number;
  onStartReview: () => void;
  pagination: PaginationController;
  pageCount?: number;
  totalPagesKnown?: boolean;
  onGoToPage?: (pageNumber: number) => void | Promise<void>;
  maxDirectPage?: number;
  jumpPending?: boolean;
  pageCursor: number | null;
  canNext: boolean;
  selectedIds?: ReadonlySet<number>;
  onToggleSelected?: (id: number, selected: boolean) => void;
  onToggleAllVisible?: (selected: boolean) => void;
}) {
  const accountTimeZone = useAccountTimeZone();
  const { t } = useI18n();
  const selectedIds = props.selectedIds ?? new Set<number>();
  const allVisibleSelected = props.rows.length > 0 && props.rows.every((row) => selectedIds.has(row.id));

  return (
    <>
      {props.reviewableCount > 0 ? (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2" data-testid="admin.payments.incoming.list_actions">
          <Button variant="primary" size="sm" onClick={props.onStartReview} testId="admin.payments.incoming.review.start">
            {t('payments.incoming.review_queue.start')} ({props.reviewableCount})
          </Button>
        </div>
      ) : null}
      <div className="space-y-2 md:hidden">
        {props.rows.map((p) => {
          const st = String(p.state ?? '').trim();
          const primaryVar = incomingPaymentBadgeVariant(st);
          const dotVar = dotVariantFromBadgeVariant(primaryVar);

          const recvAmount = incomingPaymentReceivedAmountLabel(p);
          const acctAmount = incomingPaymentAccountedAmountLabel(p);

          return (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={(event) => props.onToggleSelected?.(p.id, event.target.checked)}
                      aria-label={t('payments.incoming.bulk.select_row', { id: p.id })}
                      data-testid={`admin.payments.incoming.bulk.select.${p.id}.mobile`}
                      className="h-4 w-4 rounded border-border"
                    />
                    <StatusDot variant={dotVar} testId={`admin.payments.incoming.row.${p.id}.dot`} />
                    <div className="text-sm font-semibold">#{p.id}</div>
                    <Badge variant={incomingPaymentBadgeVariant(st)}>{t(incomingPaymentStateLabelKey(st))}</Badge>
                  </div>
                  <div
                    className="mt-1 text-xs text-muted"
                    data-testid={`admin.payments.incoming.row.${p.id}.date.mobile`}
                  >
                    {formatDateTimeInTimeZone(p.date, accountTimeZone)}
                  </div>
                  <div className="mt-2 text-sm font-medium tabular-nums">{recvAmount}</div>
                  {acctAmount ? (
                    <div className="mt-1 text-xs text-muted">
                      {t('payments.incoming.list.accounted')}: {acctAmount}
                    </div>
                  ) : null}
                  <div className="mt-2 text-xs text-muted">
                    <span className="text-faint">VS:</span> {String(p.vs ?? '—')}{' '}
                    <span className="text-faint">TX:</span> {String(p.transaction_id ?? '—')}
                  </div>
                </div>
                <Link className="text-xs font-medium text-accent hover:underline" to={incomingPaymentDetailHref(props.basePath, p.id, props.returnTo)}>
                  {t('common.open')}
                </Link>
              </div>
            </Card>
          );
        })}

        <Card>
          <KeysetPagination
            page={props.pagination.page}
            pageCount={props.pageCount ?? props.pagination.stack.length}
            totalPagesKnown={props.totalPagesKnown}
            canPrev={props.pagination.canPrev}
            canNext={props.canNext}
            onPrev={props.pagination.goPrev}
            onNext={() => props.pagination.goNext(props.pageCursor)}
            onGoToPage={props.onGoToPage ?? props.pagination.goToPage}
            maxDirectPage={props.maxDirectPage}
            jumpPending={props.jumpPending}
            limit={props.pagination.limit}
            allowedLimits={props.pagination.allowedLimits}
            onLimitChange={props.pagination.setLimit}
            testId="admin.payments.incoming.pagination.mobile"
          />
        </Card>
      </div>

      <TableCard
        className="hidden md:block"
        minWidth="lg"
        tableTestId="admin.payments.incoming.table"
        footer={
          <KeysetPagination
            page={props.pagination.page}
            pageCount={props.pageCount ?? props.pagination.stack.length}
            totalPagesKnown={props.totalPagesKnown}
            canPrev={props.pagination.canPrev}
            canNext={props.canNext}
            onPrev={props.pagination.goPrev}
            onNext={() => props.pagination.goNext(props.pageCursor)}
            onGoToPage={props.onGoToPage ?? props.pagination.goToPage}
            maxDirectPage={props.maxDirectPage}
            jumpPending={props.jumpPending}
            limit={props.pagination.limit}
            allowedLimits={props.pagination.allowedLimits}
            onLimitChange={props.pagination.setLimit}
            testId="admin.payments.incoming.pagination.desktop"
          />
        }
      >
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="w-10 px-2 py-2">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(event) => props.onToggleAllVisible?.(event.target.checked)}
                aria-label={t('payments.incoming.bulk.select_visible')}
                data-testid="admin.payments.incoming.bulk.select_all.desktop"
                className="h-4 w-4 rounded border-border"
              />
            </th>
            <th className="px-3 py-2">{t('common.id')}</th>
            <th className="px-3 py-2">{t('common.date')}</th>
            <th className="px-3 py-2">{t('payments.incoming.list.col.amount')}</th>
            <th className="px-3 py-2">{t('payments.incoming.list.col.vs')}</th>
            <th className="px-3 py-2">{t('payments.incoming.list.col.account')}</th>
            <th className="px-3 py-2">{t('common.state')}</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((p) => {
            const st = String(p.state ?? '').trim();
            const rowVar = incomingPaymentRowVariant(st);
            const primaryVar = incomingPaymentBadgeVariant(st);
            const dotVar = dotVariantFromBadgeVariant(primaryVar);

            const recvAmount = incomingPaymentReceivedAmountLabel(p);
            const acctAmount = incomingPaymentAccountedAmountLabel(p);

            return (
              <TableRowLink
                key={p.id}
                testId={`admin.payments.incoming.row.${p.id}`}
                to={incomingPaymentDetailHref(props.basePath, p.id, props.returnTo)}
                variant={rowVar}
                className="border-b border-border/60 last:border-b-0"
              >
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={(event) => props.onToggleSelected?.(p.id, event.target.checked)}
                    aria-label={t('payments.incoming.bulk.select_row', { id: p.id })}
                    data-testid={`admin.payments.incoming.bulk.select.${p.id}`}
                    className="h-4 w-4 rounded border-border"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <StatusDot variant={dotVar} testId={`admin.payments.incoming.row.${p.id}.dot`} />
                    <span className="font-medium text-accent">#{p.id}</span>
                  </div>
                </td>
                <td
                  className="px-3 py-2 text-xs text-muted"
                  data-testid={`admin.payments.incoming.row.${p.id}.date.desktop`}
                >
                  {formatDateTimeInTimeZone(p.date, accountTimeZone)}
                </td>
                <td className="px-3 py-2">
                  <div className="text-sm font-medium tabular-nums">{recvAmount}</div>
                  {acctAmount ? <div className="text-xs text-muted">{acctAmount}</div> : null}
                </td>
                <td className="px-3 py-2 text-xs text-muted tabular-nums">{String(p.vs ?? '—')}</td>
                <td className="px-3 py-2 text-xs text-muted">{String(p.account_name ?? '—')}</td>
                <td className="px-3 py-2">
                  <Badge variant={incomingPaymentBadgeVariant(st)}>{t(incomingPaymentStateLabelKey(st))}</Badge>
                </td>
              </TableRowLink>
            );
          })}
        </tbody>
      </TableCard>
    </>
  );
}
