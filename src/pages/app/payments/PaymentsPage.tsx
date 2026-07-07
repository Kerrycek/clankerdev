import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../../app/auth';
import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useTierBIntervalMs } from '../../../lib/refreshTiers';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';

import { fetchPaymentInstructions, fetchUserPayments } from '../../../lib/api/payments';
import { formatDateTime } from '../../../lib/format';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { getPaidUntilStatus, paidUntilBadgeVariant, paidUntilStatusLabelKey } from '../../../lib/paymentsBadges';
import { formatMoneyLike, safeInt } from '../../../lib/paymentsFormat';
import { normalizePaymentInstructions, paidUntilSubtitleToken } from './PaymentsModel';

import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';

import { Badge } from '../../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { CopyButton } from '../../../components/ui/CopyButton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../components/ui/LoadingState';
import { StatCard } from '../../../components/ui/StatCard';

export function PaymentsPage() {
  const auth = useAuth();
  const { basePath } = useAppMode();
  const { t, tc } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();

  const tierBRefetchMs = useTierBIntervalMs();

  const userId = auth.user?.id;
  const monthlyPayment = safeInt(auth.user?.monthly_payment);
  const paidUntil = auth.user?.paid_until as unknown;

  const now = new Date();
  const status = getPaidUntilStatus(paidUntil, now);

  const paidUntilSubtitle = (() => {
    const token = paidUntilSubtitleToken(status);
    return token.kind === 'plural' ? tc(token.key, token.count) : t(token.key);
  })();

  const pagination = useKeysetPagination({
    id: 'payments.my.history',
    filterKey: JSON.stringify({ scope: basePath, mineUserId: userId }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const instructionsQ = useQuery({
    queryKey: ['users', 'payment_instructions', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) throw new Error('missing user id');
      return (await fetchPaymentInstructions(userId)).data;
    },
    staleTime: 10 * 60_000,
  });

  const historyQ = useQuery({
    queryKey: ['user_payments', 'list', { limit: pagination.limit, fromId: pagination.fromId, userId }],
    queryFn: async () => (await fetchUserPayments({ limit: pagination.limit, fromId: pagination.fromId, userId })).data,
    enabled: Boolean(userId),
    refetchInterval: tierBRefetchMs,
  });

  const canNext = (historyQ.data?.length ?? 0) >= pagination.limit;
  const cursor = cursorFromDescendingPage(historyQ.data);

  const instructions = normalizePaymentInstructions(instructionsQ.data);

  return (
    <ListShell>
      <PageHeader title={t('payments.my.title')} description={t('payments.my.description')} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <StatCard
          title={t('payments.my.stat.paid_until')}
          value={formatDateTime(typeof paidUntil === 'string' ? paidUntil : null)}
          description={paidUntilSubtitle}
          footer={
            <Badge variant={paidUntilBadgeVariant(status.status)}>{t(paidUntilStatusLabelKey(status.status))}</Badge>
          }
          testId="payments.my.stat.paid_until"
        />

        <StatCard
          title={t('payments.my.stat.monthly_payment')}
          value={formatMoneyLike(monthlyPayment)}
          description={t('payments.my.stat.monthly_payment.subtitle')}
          testId="payments.my.stat.monthly_payment"
        />

        <StatCard
          title={t('payments.my.stat.payment_id')}
          value={userId ?? '—'}
          description={t('payments.my.stat.payment_id.subtitle')}
          testId="payments.my.stat.payment_id"
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t('payments.my.instructions.title')}
            actions={instructions ? <CopyButton text={instructions} testId="payments.my.instructions.copy" /> : null}
          />
          <CardBody>
            {instructionsQ.isLoading ? <LoadingState /> : null}
            {instructionsQ.isError ? (
              <ErrorState title={t('payments.my.instructions.load_error.title')} error={instructionsQ.error} />
            ) : null}
            {!instructionsQ.isLoading && !instructionsQ.isError ? (
              instructions ? (
                <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-surface-2 p-3 text-sm" data-testid="payments.my.instructions.text">{instructions}</pre>
              ) : (
                <div className="text-sm text-muted" data-testid="payments.my.instructions.empty">{t('common.na')}</div>
              )
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('payments.my.history.title')} subtitle={t('payments.my.history.description')} />
          <CardBody>
            {historyQ.isLoading ? <LoadingState /> : null}
            {historyQ.isError ? (
              <ErrorState title={t('payments.my.history.load_error.title')} error={historyQ.error} />
            ) : null}

            {!historyQ.isLoading && !historyQ.isError ? (
              historyQ.data && historyQ.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-list" data-testid="payments.my.history.table">
                    <thead className="bg-surface-2">
                      <tr className="text-left text-xs text-muted">
                        <th className="px-3 py-2">{t('payments.my.history.col.created')}</th>
                        <th className="px-3 py-2 text-right">{t('payments.my.history.col.amount')}</th>
                        <th className="px-3 py-2">{t('payments.my.history.col.period')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {historyQ.data.map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2 font-medium tabular-nums">{formatDateTime(p.created_at)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatMoneyLike(safeInt(p.amount))}</td>
                          <td className="px-3 py-2 text-xs text-muted">
                            <span className="tabular-nums">{formatDateTime(p.from_date)}</span> →{' '}
                            <span className="tabular-nums">{formatDateTime(p.to_date)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-3">
                    <KeysetPagination
                      testId="payments.my.history.pagination"
                      page={pagination.page}
                      pageCount={pagination.pageCount}
                      canPrev={pagination.canPrev}
                      canNext={canNext}
                      onPrev={pagination.goPrev}
                      onNext={() => pagination.goNext(cursor)}
                      onGoToPage={pagination.goToPage}
                      limit={pagination.limit}
                      allowedLimits={pagination.allowedLimits}
                      onLimitChange={pagination.setLimit}
                    />
                  </div>
                </div>
              ) : (
                <EmptyState title={t('payments.my.history.empty')} />
              )
            ) : null}
          </CardBody>
        </Card>
      </div>
    </ListShell>
  );
}
