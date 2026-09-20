import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import { useAccountTimeZone } from '../../../app/accountTimeZone';
import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { FilterBar } from '../../../components/layout/FilterBar';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../components/ui/LoadingState';
import { TableCard } from '../../../components/ui/TableCard';
import { fetchUserPayments, type ResourceRef, type UserPayment } from '../../../lib/api/payments';
import { formatDateInTimeZone, formatDateTime } from '../../../lib/format';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { formatMoneyLike, safeInt } from '../../../lib/paymentsFormat';
import { useTierSlowIntervalMs } from '../../../lib/refreshTiers';
import { resourceRefLabel } from '../payments/PaymentsModel';
import { AdminFinanceTabs } from './AdminFinanceTabs';
import {
  parsePaymentHistoryId,
  paymentHistoryDateBoundary,
  paymentHistoryMonths,
} from './PaymentHistoryModel';

function resourceHref(basePath: string, resource: ResourceRef | undefined): string | undefined {
  return resource?.id ? `${basePath}/users/${resource.id}` : undefined;
}

function ResourceLink(props: { basePath: string; resource?: ResourceRef }) {
  const label = resourceRefLabel(props.resource);
  const href = resourceHref(props.basePath, props.resource);
  return href ? <Link className="text-accent hover:underline" to={href}>{label}</Link> : <>{label}</>;
}

function sourceLabel(payment: UserPayment, basePath: string, manualLabel: string) {
  const incomingId = payment.incoming_payment?.id;
  return incomingId ? (
    <Link className="text-accent hover:underline" to={`${basePath}/payments/incoming/${incomingId}`}>
      #{incomingId}
    </Link>
  ) : manualLabel;
}

export function PaymentHistoryPage() {
  const accountTimeZone = useAccountTimeZone();
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const tierSlowMs = useTierSlowIntervalMs();
  const [searchParams, setSearchParams] = useSearchParams();

  const userRaw = searchParams.get('user') ?? '';
  const accountedByRaw = searchParams.get('accounted_by') ?? '';
  const createdFromRaw = searchParams.get('created_from') ?? '';
  const createdToRaw = searchParams.get('created_to') ?? '';
  const [draftUser, setDraftUser] = useState(userRaw);
  const [draftAccountedBy, setDraftAccountedBy] = useState(accountedByRaw);
  const [draftCreatedFrom, setDraftCreatedFrom] = useState(createdFromRaw);
  const [draftCreatedTo, setDraftCreatedTo] = useState(createdToRaw);
  const [validationError, setValidationError] = useState(false);

  useEffect(() => {
    setDraftUser(userRaw);
    setDraftAccountedBy(accountedByRaw);
    setDraftCreatedFrom(createdFromRaw);
    setDraftCreatedTo(createdToRaw);
  }, [accountedByRaw, createdFromRaw, createdToRaw, userRaw]);

  const userId = userRaw ? parsePaymentHistoryId(userRaw) : undefined;
  const accountedById = accountedByRaw ? parsePaymentHistoryId(accountedByRaw) : undefined;
  const createdFrom = createdFromRaw ? paymentHistoryDateBoundary(createdFromRaw) : undefined;
  const createdTo = createdToRaw ? paymentHistoryDateBoundary(createdToRaw, true) : undefined;
  const urlFiltersValid = (
    (!userRaw || userId !== undefined)
    && (!accountedByRaw || accountedById !== undefined)
    && (!createdFromRaw || createdFrom !== undefined)
    && (!createdToRaw || createdTo !== undefined)
    && (!createdFromRaw || !createdToRaw || createdFromRaw <= createdToRaw)
  );

  const filterKey = JSON.stringify({ userId, accountedById, createdFromRaw, createdToRaw });
  const pagination = useKeysetPagination({
    id: 'admin.payments.history',
    filterKey,
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100, 200],
  });

  const historyQ = useQuery({
    queryKey: ['user_payments', 'history', {
      limit: pagination.limit + 1,
      fromId: pagination.fromId,
      userId,
      accountedById,
      createdFrom,
      createdTo,
    }],
    queryFn: async () => (await fetchUserPayments({
      limit: pagination.limit + 1,
      fromId: pagination.fromId,
      userId,
      accountedById,
      createdFrom,
      createdTo,
      includes: 'user,accounted_by',
    })).data,
    enabled: urlFiltersValid,
    refetchInterval: tierSlowMs,
  });

  const historyPage = historyQ.data ?? [];
  const visibleHistory = useMemo(
    () => historyPage.slice(0, pagination.limit),
    [historyPage, pagination.limit],
  );
  const cursor = useMemo(() => cursorFromDescendingPage(visibleHistory), [visibleHistory]);
  const canNext = pagination.hasForward || (historyPage.length > pagination.limit && cursor !== null);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedUser = draftUser.trim().replace(/^#/, '');
    const normalizedAccountedBy = draftAccountedBy.trim().replace(/^#/, '');
    const normalizedFrom = draftCreatedFrom.trim();
    const normalizedTo = draftCreatedTo.trim();
    const valid = (
      (!normalizedUser || parsePaymentHistoryId(normalizedUser) !== undefined)
      && (!normalizedAccountedBy || parsePaymentHistoryId(normalizedAccountedBy) !== undefined)
      && (!normalizedFrom || paymentHistoryDateBoundary(normalizedFrom) !== undefined)
      && (!normalizedTo || paymentHistoryDateBoundary(normalizedTo, true) !== undefined)
      && (!normalizedFrom || !normalizedTo || normalizedFrom <= normalizedTo)
    );
    setValidationError(!valid);
    if (!valid) return;

    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const key of ['user', 'accounted_by', 'created_from', 'created_to', 'from_id', 'page']) next.delete(key);
      if (normalizedUser) next.set('user', normalizedUser);
      if (normalizedAccountedBy) next.set('accounted_by', normalizedAccountedBy);
      if (normalizedFrom) next.set('created_from', normalizedFrom);
      if (normalizedTo) next.set('created_to', normalizedTo);
      return next;
    });
  };

  const clearFilters = () => {
    setValidationError(false);
    setDraftUser('');
    setDraftAccountedBy('');
    setDraftCreatedFrom('');
    setDraftCreatedTo('');
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const key of ['user', 'accounted_by', 'created_from', 'created_to', 'from_id', 'page']) next.delete(key);
      return next;
    });
  };

  const period = (payment: UserPayment) => (
    <>
      <span className="tabular-nums">{formatDateInTimeZone(payment.from_date, accountTimeZone)}</span>
      <span className="mx-2 text-muted">→</span>
      <span className="tabular-nums">{formatDateInTimeZone(payment.to_date, accountTimeZone)}</span>
    </>
  );

  return (
    <ListShell
      testId="admin.finance.history"
      header={(
        <div className="space-y-4">
          <PageHeader
            title={t('finance.history.title')}
            description={t('finance.history.description')}
            actions={(
              <Button
                variant="secondary"
                size="sm"
                loading={historyQ.isFetching}
                disabled={!urlFiltersValid}
                onClick={() => void historyQ.refetch()}
                testId="admin.finance.history.refresh"
              >
                {t('common.refresh')}
              </Button>
            )}
          />
          <AdminFinanceTabs />
        </div>
      )}
    >
      <Card className="p-4">
        <form onSubmit={applyFilters}>
          <FilterBar testId="admin.finance.history.filters">
            <Input
              label={t('finance.history.filter.user')}
              value={draftUser}
              onChange={(event) => setDraftUser(event.target.value)}
              inputMode="numeric"
              placeholder="#123"
              ariaInvalid={validationError}
              testId="admin.finance.history.filter.user"
            />
            <Input
              label={t('finance.history.filter.accounted_by')}
              value={draftAccountedBy}
              onChange={(event) => setDraftAccountedBy(event.target.value)}
              inputMode="numeric"
              placeholder="#456"
              ariaInvalid={validationError}
              testId="admin.finance.history.filter.accounted_by"
            />
            <Input
              label={t('finance.history.filter.created_from')}
              value={draftCreatedFrom}
              onChange={(event) => setDraftCreatedFrom(event.target.value)}
              type="date"
              ariaInvalid={validationError}
              testId="admin.finance.history.filter.created_from"
            />
            <Input
              label={t('finance.history.filter.created_to')}
              value={draftCreatedTo}
              onChange={(event) => setDraftCreatedTo(event.target.value)}
              type="date"
              ariaInvalid={validationError}
              testId="admin.finance.history.filter.created_to"
            />
            <Button type="submit" size="sm" testId="admin.finance.history.filter.apply">
              {t('common.search')}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={clearFilters} testId="admin.finance.history.filter.clear">
              {t('common.clear')}
            </Button>
          </FilterBar>
        </form>
      </Card>

      {validationError || !urlFiltersValid ? (
        <Alert variant="danger" title={t('finance.history.filter.invalid')} testId="admin.finance.history.filter.error" />
      ) : historyQ.isLoading ? (
        <LoadingState testId="admin.finance.history.loading" />
      ) : historyQ.isError ? (
        <ErrorState
          title={t('finance.history.load_error')}
          error={historyQ.error}
          onRetry={() => void historyQ.refetch()}
          showBack={false}
          testId="admin.finance.history.error"
        />
      ) : visibleHistory.length === 0 ? (
        <EmptyState title={t('finance.history.empty')} />
      ) : (
        <div className="space-y-3">
          <div className="space-y-2 md:hidden" data-testid="admin.finance.history.mobile">
            {visibleHistory.map((payment) => (
              <TableCard
                key={payment.id}
                testId={`admin.finance.history.row.${payment.id}.mobile`}
                title={<ResourceLink basePath={basePath} resource={payment.user} />}
                subtitle={formatMoneyLike(safeInt(payment.amount))}
                rows={[
                  { label: t('finance.history.col.accepted_at'), value: formatDateTime(payment.created_at) },
                  { label: t('finance.history.col.accounted_by'), value: <ResourceLink basePath={basePath} resource={payment.accounted_by} /> },
                  { label: t('finance.history.col.period'), value: period(payment) },
                  { label: t('finance.history.col.months'), value: paymentHistoryMonths(payment.from_date, payment.to_date) ?? '—' },
                  { label: t('finance.history.col.source'), value: sourceLabel(payment, basePath, t('finance.history.source.manual')) },
                ]}
              />
            ))}
          </div>

          <TableCard className="hidden md:block" minWidth="lg" tableTestId="admin.finance.history.table">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3">{t('finance.history.col.accepted_at')}</th>
                <th className="px-4 py-3">{t('common.user')}</th>
                <th className="px-4 py-3">{t('finance.history.col.accounted_by')}</th>
                <th className="px-4 py-3 text-right">{t('finance.history.col.amount')}</th>
                <th className="px-4 py-3">{t('finance.history.col.period')}</th>
                <th className="px-4 py-3 text-right">{t('finance.history.col.months')}</th>
                <th className="px-4 py-3">{t('finance.history.col.source')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleHistory.map((payment) => (
                <tr key={payment.id} className="border-b border-border/60 last:border-b-0" data-testid={`admin.finance.history.row.${payment.id}`}>
                  <td className="px-4 py-3 tabular-nums">{formatDateTime(payment.created_at)}</td>
                  <td className="px-4 py-3 font-medium"><ResourceLink basePath={basePath} resource={payment.user} /></td>
                  <td className="px-4 py-3"><ResourceLink basePath={basePath} resource={payment.accounted_by} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoneyLike(safeInt(payment.amount))}</td>
                  <td className="px-4 py-3">{period(payment)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{paymentHistoryMonths(payment.from_date, payment.to_date) ?? '—'}</td>
                  <td className="px-4 py-3">{sourceLabel(payment, basePath, t('finance.history.source.manual'))}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>

          <KeysetPagination
            testId="admin.finance.history.pagination"
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
      )}
    </ListShell>
  );
}

export default PaymentHistoryPage;
