import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';

import { useChrome } from '../../../../components/layout/ChromeContext';

import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Modal } from '../../../../components/ui/Modal';
import { StatCard } from '../../../../components/ui/StatCard';

import { createUserPayment, fetchPaymentInstructions, fetchUserPayments } from '../../../../lib/api/payments';
import { fetchUserAccount, updateUserAccount } from '../../../../lib/api/userAccounts';
import { getMetaActionStateId } from '../../../../lib/api/haveapi';
import { objectRef } from '../../../../lib/objectRef';

import { localInputToIso, isoToLocalInput } from '../../../../lib/datetimeLocal';
import { formatErrorMessage } from '../../../../lib/errors';
import { formatDateTime } from '../../../../lib/format';
import { cursorFromDescendingPage } from '../../../../lib/lockIndex';
import { getPaidUntilStatus, paidUntilBadgeVariant, paidUntilStatusLabelKey } from '../../../../lib/paymentsBadges';
import { formatMoneyLike, safeInt } from '../../../../lib/paymentsFormat';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';

import { useAdminUserContext } from './AdminUserLayout';

function parsePositiveInt(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function AdminUserPaymentsPage() {
  const { t, tc } = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();
  const chrome = useChrome();

  const { userId, user, refetch } = useAdminUserContext();

  const [searchParams, setSearchParams] = useSearchParams();

  const accountQ = useQuery({
    queryKey: ['user_accounts', userId],
    queryFn: async () => (await fetchUserAccount(userId)).data,
    staleTime: 30_000,
  });

  const monthlyPayment = safeInt(accountQ.data?.monthly_payment ?? user.monthly_payment);
  const paidUntil = (accountQ.data?.paid_until ?? user.paid_until) as unknown;

  const now = new Date();
  const status = getPaidUntilStatus(paidUntil, now);

  const paidUntilSubtitle = (() => {
    if (status.status === 'overdue' && status.days === undefined) return t('payments.my.stat.paid_until.missing');
    if (status.status === 'unknown' || status.days === undefined) return t('common.na');

    if (status.status === 'overdue') {
      const overdueDays = Math.max(0, Math.abs(status.days));
      if (overdueDays === 0) return t('payments.my.stat.paid_until.today');
      return tc('payments.my.stat.paid_until.expired', overdueDays);
    }

    const daysLeft = Math.max(0, status.days);
    if (daysLeft === 0) return t('payments.my.stat.paid_until.today');
    return tc('payments.my.stat.paid_until.in_days', daysLeft);
  })();

  const pagination = useKeysetPagination({
    id: 'admin.user.payments.history',
    filterKey: JSON.stringify({ userId }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100, 200],
  });

  const instructionsQ = useQuery({
    queryKey: ['users', 'payment_instructions', userId],
    queryFn: async () => (await fetchPaymentInstructions(userId)).data,
    staleTime: 10 * 60_000,
  });

  const historyQ = useQuery({
    queryKey: ['user_payments', 'list', { userId, limit: pagination.limit, fromId: pagination.fromId }],
    queryFn: async () =>
      (
        await fetchUserPayments({
          userId,
          limit: pagination.limit,
          fromId: pagination.fromId ?? undefined,
        })
      ).data,
    staleTime: 15_000,
  });

  const canNext = (historyQ.data?.length ?? 0) >= pagination.limit;
  const cursor = useMemo(() => cursorFromDescendingPage(historyQ.data as any), [historyQ.data]);

  const instructions = String((instructionsQ.data as any)?.instructions ?? '').trim();

  // -----------------------
  // Edit payment settings
  // -----------------------

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMonthly, setSettingsMonthly] = useState('');
  const [settingsPaidUntilLocal, setSettingsPaidUntilLocal] = useState('');

  const openSettings = () => {
    const mp = monthlyPayment ?? safeInt(user.monthly_payment) ?? undefined;
    setSettingsMonthly(mp !== undefined ? String(mp) : '');
    setSettingsPaidUntilLocal(isoToLocalInput(paidUntil));
    setSettingsOpen(true);
  };

  const settingsMonthlyParsed = parsePositiveInt(settingsMonthly);
  const settingsPaidUntilParsed = useMemo(() => localInputToIso(settingsPaidUntilLocal), [settingsPaidUntilLocal]);

  const settingsM = useMutation({
    mutationFn: async () => {
      if (settingsMonthlyParsed === null) throw new Error(t('admin.user.payments.settings.validation.monthly_payment'));
      if (!settingsPaidUntilParsed.valid) throw new Error(t('admin.user.payments.settings.validation.paid_until'));

      await updateUserAccount(userId, {
        monthly_payment: settingsMonthlyParsed,
        paid_until: settingsPaidUntilParsed.iso,
      });
    },
    onSuccess: () => {
      toasts.pushToast({ variant: 'ok', title: t('admin.user.payments.settings.toast.saved') });
      setSettingsOpen(false);
      void qc.invalidateQueries({ queryKey: ['user_accounts', userId] });
      void qc.invalidateQueries({ queryKey: ['user_payments'] });
      refetch();
    },
    onError: (e) => {
      const msg = formatErrorMessage(e);
      toasts.pushToast({ variant: 'danger', title: t('common.error'), body: msg, autoDismissMs: false });
    },
  });

  // -----------------------
  // Add manual payment
  // -----------------------

  const [addOpen, setAddOpen] = useState(false);
  const [addMonths, setAddMonths] = useState('1');

  const addMonthsParsed = parsePositiveInt(addMonths);
  const addAmount = useMemo(() => {
    if (!monthlyPayment) return undefined;
    if (!addMonthsParsed) return undefined;
    return monthlyPayment * addMonthsParsed;
  }, [addMonthsParsed, monthlyPayment]);

  const addM = useMutation({
    mutationFn: async () => {
      if (!monthlyPayment) throw new Error(t('admin.user.payments.add_payment.validation.no_monthly_payment'));
      if (!addMonthsParsed) throw new Error(t('admin.user.payments.add_payment.validation.months'));

      const amount = monthlyPayment * addMonthsParsed;
      const res = await createUserPayment({ user: userId, amount });

      const asId = getMetaActionStateId(res.meta);
      if (asId) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.user_payment.create.label',
          objectLabel: user.login,
          object: objectRef('User', userId),
        });
      }
    },
    onMutate: () => {
      const ref = objectRef('User', userId);
      chrome.acquireLocalLock(ref);
      return { lockRef: ref };
    },
    onSettled: (_data, _err, _vars, ctx) => {
      if ((ctx as any)?.lockRef) chrome.releaseLocalLock((ctx as any).lockRef);
    },
    onSuccess: () => {
      toasts.pushToast({ variant: 'ok', title: t('admin.user.payments.add_payment.toast.created') });
      setAddOpen(false);
      setAddMonths('1');
      void qc.invalidateQueries({ queryKey: ['user_payments'] });
      void qc.invalidateQueries({ queryKey: ['user_accounts', userId] });
      refetch();
    },
    onError: (e) => {
      const msg = formatErrorMessage(e);
      toasts.pushToast({ variant: 'danger', title: t('common.error'), body: msg, autoDismissMs: false });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={openSettings}
          disabled={accountQ.isLoading}
          testId="admin.user.payments.settings.open"
        >
          {t('admin.user.payments.settings.edit')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setAddOpen(true)}
          disabled={!monthlyPayment}
          testId="admin.user.payments.add.open"
        >
          {t('admin.user.payments.add_payment')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <StatCard
          title={t('payments.my.stat.paid_until')}
          value={formatDateTime(typeof paidUntil === 'string' ? paidUntil : null)}
          description={paidUntilSubtitle}
          footer={<Badge variant={paidUntilBadgeVariant(status.status)}>{t(paidUntilStatusLabelKey(status.status))}</Badge>}
          testId="admin.user.payments.stat.paid_until"
        />

        <StatCard
          title={t('payments.my.stat.monthly_payment')}
          value={formatMoneyLike(monthlyPayment)}
          description={t('payments.my.stat.monthly_payment.subtitle')}
          testId="admin.user.payments.stat.monthly_payment"
        />

        <StatCard
          title={t('payments.my.stat.payment_id')}
          value={userId}
          description={t('payments.my.stat.payment_id.subtitle')}
          testId="admin.user.payments.stat.payment_id"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t('payments.my.instructions.title')}
            actions={instructions ? <CopyButton text={instructions} testId="admin.user.payments.instructions.copy" /> : null}
          />
          <CardBody>
            {instructionsQ.isLoading ? <LoadingState /> : null}
            {instructionsQ.isError ? (
              <ErrorState title={t('payments.my.instructions.load_error.title')} error={instructionsQ.error as any} />
            ) : null}
            {!instructionsQ.isLoading && !instructionsQ.isError ? (
              instructions ? (
                <pre
                  className="whitespace-pre-wrap break-words rounded-md border border-border bg-surface-2 p-3 text-sm"
                  data-testid="admin.user.payments.instructions.text"
                >
                  {instructions}
                </pre>
              ) : (
                <div className="text-sm text-muted" data-testid="admin.user.payments.instructions.empty">
                  {t('common.na')}
                </div>
              )
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('payments.my.history.title')} subtitle={t('payments.my.history.description')} />
          <CardBody>
            {historyQ.isLoading ? <LoadingState /> : null}
            {historyQ.isError ? <ErrorState title={t('payments.my.history.load_error.title')} error={historyQ.error as any} /> : null}

            {!historyQ.isLoading && !historyQ.isError ? (
              historyQ.data && historyQ.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-list" data-testid="admin.user.payments.history.table">
                    <thead className="bg-surface-2">
                      <tr className="text-left text-xs text-muted">
                        <th className="px-3 py-2">{t('payments.my.history.col.created')}</th>
                        <th className="px-3 py-2 text-right">{t('payments.my.history.col.amount')}</th>
                        <th className="px-3 py-2">{t('payments.my.history.col.period')}</th>
                        <th className="px-3 py-2">{t('admin.user.payments.history.col.accounted_by')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {historyQ.data.map((p) => (
                        <tr key={p.id} data-testid={`admin.user.payments.history.row.${p.id}`}>
                          <td className="px-3 py-2 font-medium tabular-nums">{formatDateTime(p.created_at)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatMoneyLike(safeInt(p.amount))}</td>
                          <td className="px-3 py-2 text-xs text-muted">
                            <span className="tabular-nums">{formatDateTime(p.from_date)}</span> →{' '}
                            <span className="tabular-nums">{formatDateTime(p.to_date)}</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted">
                            {typeof (p as any).accounted_by === 'object' && (p as any).accounted_by ? (
                              <span className="tabular-nums">
                                {String((p as any).accounted_by.login ?? '')}
                                {typeof (p as any).accounted_by.id === 'number' ? ` (#${(p as any).accounted_by.id})` : ''}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-3">
                    <KeysetPagination
                      testId="admin.user.payments.history.pagination"
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

      {/* Edit settings modal */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={t('admin.user.payments.settings.modal.title')}
        testId="admin.user.payments.settings.modal"
      >
        <div className="space-y-3">
          {accountQ.isError ? (
            <ErrorState
              title={t('admin.user.payments.settings.load_error.title')}
              error={accountQ.error as any}
              showDetails
            />
          ) : null}

          <div>
            <div className="text-xs font-medium text-muted">{t('admin.user.payments.settings.field.monthly_payment')}</div>
            <div className="mt-1">
              <Input
                testId="admin.user.payments.settings.monthly_payment"
                type="number"
                inputMode="numeric"
                value={settingsMonthly}
                onChange={(e) => setSettingsMonthly(e.target.value)}
                placeholder={monthlyPayment !== undefined ? String(monthlyPayment) : '0'}
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted">{t('admin.user.payments.settings.field.paid_until')}</div>
            <div className="mt-1">
              <Input
                testId="admin.user.payments.settings.paid_until"
                type="datetime-local"
                value={settingsPaidUntilLocal}
                onChange={(e) => setSettingsPaidUntilLocal(e.target.value)}
              />
            </div>
            <div className="mt-1 text-xs text-muted">{t('admin.user.payments.settings.hint.paid_until')}</div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setSettingsOpen(false)} testId="admin.user.payments.settings.cancel">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => settingsM.mutate()}
              loading={settingsM.isPending}
              disabled={settingsMonthlyParsed === null || !settingsPaidUntilParsed.valid}
              testId="admin.user.payments.settings.save"
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add manual payment modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('admin.user.payments.add_payment.modal.title')}
        testId="admin.user.payments.add.modal"
      >
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-muted">{t('admin.user.payments.add_payment.field.months')}</div>
            <div className="mt-1">
              <Input
                testId="admin.user.payments.add.months"
                type="number"
                inputMode="numeric"
                min={1}
                value={addMonths}
                onChange={(e) => setAddMonths(e.target.value)}
              />
            </div>
            <div className="mt-1 text-xs text-muted">
              {monthlyPayment
                ? t('admin.user.payments.add_payment.hint.multiple', { monthly: formatMoneyLike(monthlyPayment) })
                : t('admin.user.payments.add_payment.validation.no_monthly_payment')}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted">{t('admin.user.payments.add_payment.field.amount')}</div>
            <div className="mt-1 text-sm tabular-nums" data-testid="admin.user.payments.add.amount">
              {addAmount !== undefined ? formatMoneyLike(addAmount) : '—'}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)} testId="admin.user.payments.add.cancel">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => addM.mutate()}
              loading={addM.isPending}
              disabled={!monthlyPayment || !addMonthsParsed}
              testId="admin.user.payments.add.save"
            >
              {t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
