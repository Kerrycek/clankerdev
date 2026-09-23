import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CheckCircle2, RefreshCw, TrendingUp, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useAccountTimeZone, useServerTimeZone } from '../../../app/accountTimeZone';
import { useI18n } from '../../../app/i18n';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { StatCard } from '../../../components/ui/StatCard';
import { TableCard } from '../../../components/ui/TableCard';
import { fetchFinanceUsersSnapshot } from '../../../lib/api/finance';
import { fetchSystemConfigs, type SystemConfigItem } from '../../../lib/api/systemConfig';
import type { User } from '../../../lib/api/users';
import { formatDateInTimeZone, formatDateTime } from '../../../lib/format';
import { paidUntilBadgeVariant } from '../../../lib/paymentsBadges';
import { safeInt } from '../../../lib/paymentsFormat';
import { AdminFinanceTabs } from './AdminFinanceTabs';
import {
  classifyFinanceAccount,
  isFinanceAccountInScope,
  summarizeFinanceAccounts,
  type FinanceAccountStatus,
} from './FinanceOverviewModel';

function defaultCurrency(configs: readonly SystemConfigItem[] | undefined): string | undefined {
  const raw = configs?.find((item) => (
    item.category === 'plugin_payments' && item.name === 'default_currency'
  ))?.value;
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toUpperCase();
  return normalized || undefined;
}

function formatAmount(amount: number, locale: string, currency?: string): string {
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);
  return currency ? `${value} ${currency}` : value;
}

function userLabel(user: User): string {
  const identity = String(user.login || user.full_name || user.email || '').trim();
  return identity ? `#${user.id} ${identity}` : `#${user.id}`;
}

function statusPriority(status: FinanceAccountStatus): number {
  if (status === 'invalid') return 0;
  if (status === 'overdue') return 1;
  if (status === 'due_soon') return 2;
  return 3;
}

function financeStatusBadge(status: FinanceAccountStatus) {
  if (status === 'invalid') return 'neutral' as const;
  return paidUntilBadgeVariant(status);
}

const REVIEW_STATUSES = ['overdue', 'due_soon', 'invalid'] as const;
type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const FINANCE_SNAPSHOT_FRESH_MS = 10 * 60_000;
const FINANCE_SNAPSHOT_CACHE_MS = 30 * 60_000;
const REVIEW_PAGE_SIZE = 10;

export function FinanceOverviewPage() {
  const { basePath } = useAppMode();
  const accountTimeZone = useAccountTimeZone();
  const billingTimeZone = useServerTimeZone();
  const { lang, t, tc } = useI18n();
  const locale = lang === 'cs' ? 'cs-CZ' : 'en-US';
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('overdue');

  const snapshotQ = useQuery({
    queryKey: ['finance', 'account_snapshot'],
    queryFn: async ({ signal }) => {
      const startedAt = Date.now();
      const snapshot = await fetchFinanceUsersSnapshot({ signal });
      return {
        snapshot,
        loadedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      };
    },
    retry: false,
    // A global scan currently needs at least three upstream requests at the
    // production-like data volume. Keep a complete snapshot fresh while an
    // administrator moves between Finance and member details; the explicit
    // refresh action remains available for time-sensitive decisions.
    staleTime: FINANCE_SNAPSHOT_FRESH_MS,
    gcTime: FINANCE_SNAPSHOT_CACHE_MS,
    refetchOnWindowFocus: false,
  });

  const configsQ = useQuery({
    queryKey: ['system_configs', 'plugin_payments'],
    queryFn: async ({ signal }) => (await fetchSystemConfigs({ category: 'plugin_payments', signal })).data,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const snapshot = snapshotQ.data?.snapshot;
  const complete = snapshot?.complete === true;
  const users = complete ? snapshot.rows : [];
  const summary = useMemo(
    () => complete ? summarizeFinanceAccounts(users, new Date(), billingTimeZone) : null,
    [billingTimeZone, complete, users],
  );
  const currency = defaultCurrency(configsQ.data);

  const reviewUsers = useMemo(() => users
    .filter(isFinanceAccountInScope)
    .map((user) => ({ user, classification: classifyFinanceAccount(user) }))
    .filter(({ classification }) => classification.status !== 'paid')
    .sort((a, b) => {
      const severity = statusPriority(a.classification.status) - statusPriority(b.classification.status);
      if (severity !== 0) return severity;
      const aDate = typeof a.user.paid_until === 'string' ? Date.parse(a.user.paid_until) : Number.NEGATIVE_INFINITY;
      const bDate = typeof b.user.paid_until === 'string' ? Date.parse(b.user.paid_until) : Number.NEGATIVE_INFINITY;
      return aDate - bDate || a.user.id - b.user.id;
    }), [users]);

  const reviewCounts = useMemo(() => ({
    overdue: reviewUsers.filter(({ classification }) => classification.status === 'overdue').length,
    due_soon: reviewUsers.filter(({ classification }) => classification.status === 'due_soon').length,
    invalid: reviewUsers.filter(({ classification }) => classification.status === 'invalid').length,
  }), [reviewUsers]);

  const visibleReviewUsers = useMemo(() => reviewUsers
    .filter(({ classification }) => classification.status === reviewStatus)
    .slice(0, REVIEW_PAGE_SIZE), [reviewStatus, reviewUsers]);

  const distribution = useMemo(() => {
    const counts = new Map<number, number>();
    for (const user of users) {
      if (!isFinanceAccountInScope(user)) continue;
      const amount = Number(user.monthly_payment);
      counts.set(amount, (counts.get(amount) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([amount, count]) => ({ amount, count }))
      .sort((a, b) => b.count - a.count || b.amount - a.amount)
      .slice(0, 10);
  }, [users]);

  const refresh = () => {
    void snapshotQ.refetch();
    void configsQ.refetch();
  };

  return (
    <ListShell
      testId="admin.finance.overview"
      header={(
        <div className="space-y-4">
          <PageHeader
            title={t('finance.overview.title')}
            description={t('finance.overview.description')}
            actions={(
              <Button
                variant="secondary"
                size="sm"
                loading={snapshotQ.isFetching || configsQ.isFetching}
                onClick={refresh}
                testId="admin.finance.overview.refresh"
              >
                <RefreshCw size={16} aria-hidden="true" />
                {t('finance.overview.refresh')}
              </Button>
            )}
          />
          <AdminFinanceTabs />
        </div>
      )}
    >
      {snapshotQ.isLoading ? (
        <LoadingState
          label={t('finance.overview.loading')}
          testId="admin.finance.overview.loading"
        />
      ) : snapshotQ.isError && !snapshot ? (
        <ErrorState
          title={t('finance.overview.load_error')}
          error={snapshotQ.error}
          onRetry={refresh}
          showBack={false}
          testId="admin.finance.overview.error"
        />
      ) : snapshot && !snapshot.complete ? (
        <ErrorState
          title={t('finance.overview.incomplete.title')}
          error={new Error(t('finance.overview.incomplete.body', { count: snapshot.scannedRows }))}
          onRetry={refresh}
          showBack={false}
          testId="admin.finance.overview.incomplete"
        />
      ) : summary ? (
        <div className="space-y-4">
          {snapshotQ.isError ? (
            <Alert
              variant="warn"
              title={t('finance.overview.stale.title')}
              description={t('finance.overview.stale.body')}
              testId="admin.finance.overview.stale"
            />
          ) : null}
          <Card className="px-4 py-3" testId="admin.finance.overview.scope">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle2 className="shrink-0 text-ok" size={18} aria-hidden="true" />
                <p className="min-w-0 text-sm">
                  <span className="font-semibold">{t('finance.overview.scope.title')}</span>{' '}
                  <span className="text-muted">{t('finance.overview.scope.summary', {
                    count: summary.accountCount,
                    time: formatDateTime(snapshotQ.data?.loadedAt),
                  })}</span>
                </p>
              </div>
              {snapshotQ.isFetching ? (
                <Badge variant="info">{t('finance.overview.scope.refreshing')}</Badge>
              ) : null}
            </div>
            <details className="mt-2 text-xs text-muted">
              <summary className="cursor-pointer select-none font-medium text-fg">
                {t('finance.overview.scope.details')}
              </summary>
              <p className="mt-2 leading-5">
                {t('finance.overview.scope.body', {
                  count: summary.accountCount,
                  excluded: summary.excludedAccountCount,
                  scanned: snapshot?.scannedRows ?? 0,
                  batches: snapshot?.batches ?? 0,
                  duration: Math.max(0.1, (snapshotQ.data?.durationMs ?? 0) / 1_000).toLocaleString(locale, { maximumFractionDigits: 1 }),
                })}
              </p>
            </details>
          </Card>

          {configsQ.isError || (configsQ.isSuccess && !currency) ? (
            <Alert
              variant="warn"
              title={t('finance.overview.currency_error.title')}
              description={t('finance.overview.currency_error.body')}
              testId="admin.finance.overview.currency_error"
            />
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <StatCard
              title={t('finance.overview.summary.monthly_payment')}
              subtitle={t('finance.overview.summary.monthly_payment.subtitle')}
              value={formatAmount(summary.monthlyPayment, locale, currency)}
              icon={<TrendingUp size={18} aria-hidden="true" />}
              variant="featured"
              testId="admin.finance.overview.summary.monthly_payment"
            />
            <StatCard
              title={t('finance.overview.summary.current_month')}
              subtitle={t('finance.overview.summary.current_month.subtitle', { timeZone: billingTimeZone })}
              value={formatAmount(summary.currentMonthExpected, locale, currency)}
              icon={<CalendarClock size={18} aria-hidden="true" />}
              variant="featured"
              testId="admin.finance.overview.summary.current_month"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title={t('finance.overview.summary.paid')}
              subtitle={t('finance.overview.summary.paid.subtitle')}
              value={new Intl.NumberFormat(locale).format(summary.paidCount)}
              icon={<UsersRound size={18} aria-hidden="true" />}
              testId="admin.finance.overview.summary.paid"
            />
            <StatCard
              title={t('finance.overview.summary.due_soon')}
              subtitle={t('finance.overview.summary.due_soon.subtitle')}
              value={new Intl.NumberFormat(locale).format(summary.dueSoonCount)}
              icon={<CalendarClock size={18} aria-hidden="true" />}
              testId="admin.finance.overview.summary.due_soon"
            />
            <StatCard
              title={t('finance.overview.summary.overdue')}
              subtitle={t('finance.overview.summary.overdue.subtitle')}
              value={new Intl.NumberFormat(locale).format(summary.overdueCount)}
              icon={<AlertTriangle size={18} aria-hidden="true" />}
              testId="admin.finance.overview.summary.overdue"
            />
            <StatCard
              title={t('finance.overview.summary.invalid')}
              subtitle={t('finance.overview.summary.invalid.subtitle')}
              value={new Intl.NumberFormat(locale).format(summary.invalidCount)}
              icon={<AlertTriangle size={18} aria-hidden="true" />}
              testId="admin.finance.overview.summary.invalid"
            />
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <section className="min-w-0 space-y-3" aria-labelledby="finance-risk-title">
              <div>
                <h2 id="finance-risk-title" className="text-lg font-semibold">{t('finance.overview.risk.title')}</h2>
                <p className="mt-1 text-sm text-muted">{t('finance.overview.risk.description')}</p>
              </div>

              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={t('finance.overview.risk.filter.label')}
                data-testid="admin.finance.overview.risk.filters"
              >
                {REVIEW_STATUSES.map((status) => (
                  <Button
                    key={status}
                    variant={reviewStatus === status ? 'primary' : 'secondary'}
                    size="sm"
                    aria-pressed={reviewStatus === status}
                    onClick={() => setReviewStatus(status)}
                    testId={`admin.finance.overview.risk.filter.${status}`}
                  >
                    {t(`finance.overview.status.${status}`)}
                    <span aria-hidden="true">·</span>
                    {new Intl.NumberFormat(locale).format(reviewCounts[status])}
                  </Button>
                ))}
              </div>

              {visibleReviewUsers.length > 0 ? (
                <>
                  <div className="space-y-2 md:hidden" data-testid="admin.finance.overview.risk.mobile">
                    {visibleReviewUsers.map(({ user, classification }) => (
                      <TableCard
                        key={user.id}
                        to={`${basePath}/users/${user.id}/payments`}
                        title={userLabel(user)}
                        subtitle={formatAmount(safeInt(user.monthly_payment) ?? 0, locale, currency)}
                        testId={`admin.finance.overview.risk.row.${user.id}.mobile`}
                        rows={[
                          { label: t('finance.overview.risk.col.paid_until'), value: formatDateInTimeZone(user.paid_until, accountTimeZone) },
                          {
                            label: t('common.state'),
                            value: <Badge variant={financeStatusBadge(classification.status)}>{t(`finance.overview.status.${classification.status}`)}</Badge>,
                          },
                        ]}
                      />
                    ))}
                  </div>

                  <TableCard className="hidden md:block" minWidth="sm" tableTestId="admin.finance.overview.risk.table">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted">
                        <th className="px-4 py-3">{t('common.user')}</th>
                        <th className="px-4 py-3 text-right">{t('finance.overview.risk.col.monthly_payment')}</th>
                        <th className="px-4 py-3">{t('finance.overview.risk.col.paid_until')}</th>
                        <th className="px-4 py-3">{t('common.state')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleReviewUsers.map(({ user, classification }) => (
                        <tr key={user.id} className="border-b border-border/60 last:border-b-0" data-testid={`admin.finance.overview.risk.row.${user.id}`}>
                          <td className="px-4 py-3 font-medium">
                            <Link className="text-accent hover:underline" to={`${basePath}/users/${user.id}/payments`}>{userLabel(user)}</Link>
                          </td>
                          <td className="px-4 py-3 text-right">{formatAmount(safeInt(user.monthly_payment) ?? 0, locale, currency)}</td>
                          <td className="px-4 py-3">{formatDateInTimeZone(user.paid_until, accountTimeZone)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={financeStatusBadge(classification.status)}>{t(`finance.overview.status.${classification.status}`)}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </TableCard>
                  <p className="text-xs text-muted" data-testid="admin.finance.overview.risk.result_count">
                    {t('finance.overview.risk.result_count', {
                      shown: visibleReviewUsers.length,
                      total: reviewCounts[reviewStatus],
                    })}
                  </p>
                </>
              ) : (
                <Card className="p-4 text-sm text-muted" testId="admin.finance.overview.risk.empty">
                  {t('finance.overview.risk.filter.empty', { status: t(`finance.overview.status.${reviewStatus}`) })}
                </Card>
              )}
            </section>

            <section className="min-w-0 space-y-3" aria-labelledby="finance-distribution-title">
              <div>
                <h2 id="finance-distribution-title" className="text-lg font-semibold">{t('finance.overview.distribution.title')}</h2>
                <p className="mt-1 text-sm text-muted">{t('finance.overview.distribution.description')}</p>
              </div>
              {distribution.length > 0 ? (
                <Card className="overflow-hidden p-4" testId="admin.finance.overview.distribution">
                  <ol className="space-y-3">
                    {distribution.map((row) => {
                      const maxCount = distribution[0]?.count ?? 1;
                      const percentage = Math.max(4, Math.round((row.count / maxCount) * 100));
                      return (
                        <li key={row.amount} data-testid={`admin.finance.overview.distribution.row.${row.amount}`}>
                          <div className="mb-1.5 flex min-w-0 items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate font-medium" title={formatAmount(row.amount, locale, currency)}>
                              {formatAmount(row.amount, locale, currency)}
                            </span>
                            <span className="shrink-0 text-xs text-muted">
                              {tc('finance.overview.distribution.accounts', row.count, {
                                count: new Intl.NumberFormat(locale).format(row.count),
                              })}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                            <div
                              className="h-full rounded-full bg-accent transition-[width]"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Card>
              ) : (
                <Card className="p-4 text-sm text-muted" testId="admin.finance.overview.distribution.empty">
                  {t('finance.overview.distribution.empty')}
                </Card>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </ListShell>
  );
}
