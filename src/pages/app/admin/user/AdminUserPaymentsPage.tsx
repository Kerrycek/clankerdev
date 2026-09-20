import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import { useAccountTimeZone } from '../../../../app/accountTimeZone';
import { useAppMode } from '../../../../app/appMode';
import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';

import { useChrome } from '../../../../components/layout/ChromeContext';

import { Alert } from '../../../../components/ui/Alert';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../../components/ui/LoadingState';

import { createUserPayment, fetchPaymentInstructions, fetchUserPayments } from '../../../../lib/api/payments';
import { fetchUserAccount, updateUserAccount } from '../../../../lib/api/userAccounts';
import { getMetaActionStateId } from '../../../../lib/api/haveapi';
import { objectRef } from '../../../../lib/objectRef';
import type { ObjectRef } from '../../../../lib/objectRef';

import { formatErrorMessage } from '../../../../lib/errors';
import { formatDateInTimeZone, formatDateTimeInTimeZone } from '../../../../lib/format';
import { cursorFromDescendingPage } from '../../../../lib/lockIndex';
import { getPaidUntilStatus, paidUntilBadgeVariant, paidUntilStatusLabelKey } from '../../../../lib/paymentsBadges';
import { formatMoneyLike, safeInt } from '../../../../lib/paymentsFormat';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';

import {
  normalizePaymentInstructions,
  paidUntilSubtitleToken,
  parsePositiveInt,
  paymentInstructionsPlainText,
  resourceRefLabel,
} from '../../payments/PaymentsModel';
import { PaymentInstructionsHtml } from '../../payments/PaymentInstructionsHtml';

import { useAdminUserContext } from './AdminUserLayout';

function isoToDateInput(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const trimmed = value.trim();
    return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : '';
  }
  return d.toISOString().slice(0, 10);
}

function parsePositiveWholeAmount(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

interface ManualPaymentReview {
  amount: number;
  monthlyPayment: number;
  months: number;
}

type PaymentSettingsReview =
  | { kind: 'paid_until'; previous: string; next: string }
  | { kind: 'monthly_payment'; previous: number | null; next: number };

export function AdminUserPaymentsPage() {
  const accountTimeZone = useAccountTimeZone();
  const { basePath } = useAppMode();
  const { lang, t, tc } = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();
  const chrome = useChrome();

  const { userId, user, refetch } = useAdminUserContext();

  const [searchParams, setSearchParams] = useSearchParams();
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const accountQ = useQuery({
    queryKey: ['user_accounts', userId],
    queryFn: async () => (await fetchUserAccount(userId)).data,
    staleTime: 30_000,
    refetchOnWindowFocus: 'always',
  });
  const accountInitialError = accountQ.isError && accountQ.data === undefined;
  const accountDataStale = accountQ.isError && accountQ.data !== undefined;
  const accountReviewBlocked = accountQ.isFetching || accountQ.isError;

  const monthlyPayment = safeInt(accountQ.data?.monthly_payment ?? user.monthly_payment);
  const paidUntil = (accountQ.data?.paid_until ?? user.paid_until) as unknown;

  const now = new Date();
  const status = getPaidUntilStatus(paidUntil, now);

  const paidUntilSubtitle = (() => {
    const token = paidUntilSubtitleToken(status);
    return token.kind === 'plural' ? tc(token.key, token.count) : t(token.key);
  })();

  const pagination = useKeysetPagination({
    id: 'admin.user.payments.history',
    filterKey: JSON.stringify({ userId }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100, 200],
  });

  const historyQ = useQuery({
    queryKey: ['user_payments', 'list', { userId, limit: pagination.limit + 1, fromId: pagination.fromId }],
    queryFn: async () =>
      (
        await fetchUserPayments({
          userId,
          limit: pagination.limit + 1,
          fromId: pagination.fromId ?? undefined,
        })
      ).data,
    staleTime: 15_000,
  });

  const instructionsQ = useQuery({
    queryKey: ['users', 'payment_instructions', userId],
    queryFn: async () => (await fetchPaymentInstructions(userId)).data,
    enabled: instructionsOpen,
    staleTime: 10 * 60_000,
  });

  const instructions = normalizePaymentInstructions(instructionsQ.data);
  const instructionsCopyText = useMemo(
    () => paymentInstructionsPlainText(instructions, lang),
    [instructions, lang],
  );

  const historyPage = historyQ.data ?? [];
  const historyInitialError = historyQ.isError && historyQ.data === undefined;
  const historyDataStale = historyQ.isError && historyQ.data !== undefined;
  const visibleHistory = useMemo(
    () => historyPage.slice(0, pagination.limit),
    [historyPage, pagination.limit]
  );
  const cursor = useMemo(() => cursorFromDescendingPage(visibleHistory), [visibleHistory]);
  const canNext = pagination.hasForward || (historyPage.length > pagination.limit && cursor !== null);

  const [quickPaidUntil, setQuickPaidUntil] = useState('');
  const [quickMonthlyPayment, setQuickMonthlyPayment] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [settingsReview, setSettingsReview] = useState<PaymentSettingsReview | null>(null);
  const [manualPaymentReview, setManualPaymentReview] = useState<ManualPaymentReview | null>(null);
  const settingsInFlightRef = useRef(false);
  const manualPaymentInFlightRef = useRef(false);

  useEffect(() => {
    setQuickPaidUntil(isoToDateInput(paidUntil));
  }, [paidUntil]);

  useEffect(() => {
    setQuickMonthlyPayment(monthlyPayment !== undefined ? String(monthlyPayment) : '');
  }, [monthlyPayment]);

  const monthlyPaymentParsed = parsePositiveInt(quickMonthlyPayment);
  const amountParsed = parsePositiveWholeAmount(quickAmount);
  const activeMonthlyPayment = typeof monthlyPayment === 'number' && monthlyPayment > 0
    ? monthlyPayment
    : null;
  const manualPaymentMonths = amountParsed !== null
    && activeMonthlyPayment !== null
    && amountParsed % activeMonthlyPayment === 0
    ? amountParsed / activeMonthlyPayment
    : null;
  const currentPaidUntilInput = isoToDateInput(paidUntil);
  const paidUntilChanged = quickPaidUntil !== currentPaidUntilInput;
  const monthlyPaymentChanged = monthlyPaymentParsed !== null && monthlyPaymentParsed !== monthlyPayment;

  const paidUntilM = useMutation({
    mutationFn: async (nextPaidUntil: string | null) => {
      await updateUserAccount(userId, {
        paid_until: nextPaidUntil,
      });
    },
    onSettled: () => {
      settingsInFlightRef.current = false;
    },
    onSuccess: () => {
      toasts.pushToast({ variant: 'ok', title: t('admin.user.payments.settings.toast.paid_until_saved') });
      setSettingsReview(null);
      void qc.invalidateQueries({ queryKey: ['user_accounts', userId] });
      void qc.invalidateQueries({ queryKey: ['finance'] });
      void qc.invalidateQueries({ queryKey: ['payment_stats', 'estimate_income'] });
      refetch();
    },
    onError: (e) => {
      const msg = formatErrorMessage(e);
      toasts.pushToast({ variant: 'danger', title: t('common.error'), body: msg, autoDismissMs: false });
    },
  });

  const monthlyPaymentM = useMutation({
    mutationFn: async (nextMonthlyPayment: number) => {
      if (!Number.isSafeInteger(nextMonthlyPayment) || nextMonthlyPayment <= 0) {
        throw new Error(t('admin.user.payments.settings.validation.monthly_payment'));
      }
      await updateUserAccount(userId, {
        monthly_payment: nextMonthlyPayment,
      });
    },
    onSettled: () => {
      settingsInFlightRef.current = false;
    },
    onSuccess: () => {
      toasts.pushToast({ variant: 'ok', title: t('admin.user.payments.settings.toast.monthly_saved') });
      setSettingsReview(null);
      void qc.invalidateQueries({ queryKey: ['user_accounts', userId] });
      void qc.invalidateQueries({ queryKey: ['finance'] });
      void qc.invalidateQueries({ queryKey: ['payment_stats', 'estimate_income'] });
      refetch();
    },
    onError: (e) => {
      const msg = formatErrorMessage(e);
      toasts.pushToast({ variant: 'danger', title: t('common.error'), body: msg, autoDismissMs: false });
    },
  });

  const addM = useMutation({
    mutationFn: async (amount: number) => {
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error(t('admin.user.payments.add_payment.validation.amount'));
      }

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
    onSettled: (_data, _err, _vars, ctx: { lockRef?: ObjectRef } | undefined) => {
      manualPaymentInFlightRef.current = false;
      if (ctx?.lockRef) chrome.releaseLocalLock(ctx.lockRef);
    },
    onSuccess: () => {
      toasts.pushToast({ variant: 'ok', title: t('admin.user.payments.add_payment.toast.created') });
      setQuickAmount('');
      setManualPaymentReview(null);
      void qc.invalidateQueries({ queryKey: ['user_payments'] });
      void qc.invalidateQueries({ queryKey: ['user_accounts', userId] });
      void qc.invalidateQueries({ queryKey: ['finance'] });
      void qc.invalidateQueries({ queryKey: ['payment_stats', 'estimate_income'] });
      refetch();
    },
    onError: (e) => {
      const msg = formatErrorMessage(e);
      toasts.pushToast({ variant: 'danger', title: t('common.error'), body: msg, autoDismissMs: false });
    },
  });

  const submitPaidUntil = (e: React.FormEvent) => {
    e.preventDefault();
    if (accountReviewBlocked) return;
    if (!paidUntilChanged) {
      toasts.pushToast({ variant: 'neutral', title: t('admin.user.payments.settings.validation.no_changes') });
      return;
    }
    setSettingsReview({
      kind: 'paid_until',
      previous: currentPaidUntilInput,
      next: quickPaidUntil,
    });
  };

  const submitMonthlyPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (accountReviewBlocked) return;
    if (!monthlyPaymentChanged) {
      toasts.pushToast({ variant: 'neutral', title: t('admin.user.payments.settings.validation.no_changes') });
      return;
    }
    if (monthlyPaymentParsed !== null) {
      setSettingsReview({
        kind: 'monthly_payment',
        previous: monthlyPayment ?? null,
        next: monthlyPaymentParsed,
      });
    }
  };

  const submitAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (accountReviewBlocked) return;
    if (amountParsed === null || manualPaymentMonths === null || activeMonthlyPayment === null) return;
    setManualPaymentReview({
      amount: amountParsed,
      monthlyPayment: activeMonthlyPayment,
      months: manualPaymentMonths,
    });
  };

  const settingsMutationPending = paidUntilM.isPending || monthlyPaymentM.isPending;
  const paidUntilMovesBackward = settingsReview?.kind === 'paid_until'
    && Boolean(settingsReview.previous)
    && Boolean(settingsReview.next)
    && settingsReview.next < settingsReview.previous;
  const paidUntilClears = settingsReview?.kind === 'paid_until'
    && Boolean(settingsReview.previous)
    && !settingsReview.next;
  const settingsReviewStale = settingsReview !== null && (
    settingsReview.kind === 'paid_until'
      ? settingsReview.previous !== currentPaidUntilInput
      : settingsReview.previous !== (monthlyPayment ?? null)
  );
  const manualPaymentReviewStale = manualPaymentReview !== null
    && manualPaymentReview.monthlyPayment !== activeMonthlyPayment;
  return (
    <div className="space-y-4">
      <Card testId="admin.user.payments.quick.card">
        <CardHeader title={t('admin.user.payments.quick.title')} subtitle={t('admin.user.payments.quick.subtitle')} />
        <CardBody>
          {accountInitialError ? (
            <ErrorState
              testId="admin.user.payments.settings.error"
              title={t('admin.user.payments.settings.load_error.title')}
              error={accountQ.error}
              showDetails
            />
          ) : null}

          {accountDataStale ? (
            <Alert
              variant="warn"
              title={t('admin.user.payments.settings.stale.title')}
              description={t('admin.user.payments.settings.stale.body')}
              testId="admin.user.payments.settings.stale"
            />
          ) : null}

          {!accountInitialError ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <div className="space-y-4 rounded-lg border border-border bg-surface-2 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{t('admin.user.payments.settings.title')}</div>
                  <div className="mt-1 text-xs text-muted">{t('admin.user.payments.settings.description')}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted">{t('payments.my.stat.payment_id')}</div>
                  <div className="text-lg font-semibold tabular-nums text-fg">{userId}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <form className="space-y-2" onSubmit={submitPaidUntil} data-testid="admin.user.payments.paid_until.form">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-muted">{t('admin.user.payments.settings.field.paid_until')}</div>
                    <Badge variant={paidUntilBadgeVariant(status.status)}>{t(paidUntilStatusLabelKey(status.status))}</Badge>
                  </div>
                  <Input
                    testId="admin.user.payments.settings.paid_until"
                    type="date"
                    value={quickPaidUntil}
                    onChange={(e) => setQuickPaidUntil(e.target.value)}
                    disabled={accountReviewBlocked || settingsMutationPending}
                  />
                  <div className="text-xs text-muted">{paidUntilSubtitle}</div>
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    loading={paidUntilM.isPending}
                    disabled={accountReviewBlocked || settingsMutationPending || !paidUntilChanged}
                    testId="admin.user.payments.settings.paid_until.save"
                  >
                    {t('admin.user.payments.settings.save_paid_until')}
                  </Button>
                </form>

                <form className="space-y-2" onSubmit={submitMonthlyPayment} data-testid="admin.user.payments.monthly.form">
                  <Input
                    label={t('admin.user.payments.settings.field.monthly_payment')}
                    testId="admin.user.payments.settings.monthly_payment"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={quickMonthlyPayment}
                    onChange={(e) => setQuickMonthlyPayment(e.target.value)}
                    disabled={accountReviewBlocked || settingsMutationPending}
                  />
                  <div className="text-xs text-muted">{t('admin.user.payments.settings.hint.monthly_payment')}</div>
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    loading={monthlyPaymentM.isPending}
                    disabled={accountReviewBlocked || settingsMutationPending || !monthlyPaymentChanged}
                    testId="admin.user.payments.settings.monthly.save"
                  >
                    {t('common.save')}
                  </Button>
                </form>
              </div>
            </div>

            <form className="space-y-3 rounded-lg border border-border bg-surface-2 p-3" onSubmit={submitAddPayment} data-testid="admin.user.payments.add.form">
              <div>
                <div className="text-sm font-semibold">{t('admin.user.payments.add_payment.title')}</div>
                <div className="mt-1 text-xs text-muted">{t('admin.user.payments.add_payment.description')}</div>
              </div>
              <Input
                label={t('admin.user.payments.add_payment.field.amount')}
                testId="admin.user.payments.add.amount_input"
                type="number"
                inputMode="numeric"
                min={1}
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                placeholder={monthlyPayment !== undefined ? String(monthlyPayment) : undefined}
                disabled={addM.isPending || monthlyPaymentM.isPending || accountReviewBlocked}
              />
              {activeMonthlyPayment === null ? (
                <div className="text-xs text-danger" data-testid="admin.user.payments.add.validation">
                  {t('admin.user.payments.add_payment.validation.no_monthly_payment')}
                </div>
              ) : quickAmount.trim() && amountParsed === null ? (
                <div className="text-xs text-danger" data-testid="admin.user.payments.add.validation">
                  {t('admin.user.payments.add_payment.validation.amount')}
                </div>
              ) : amountParsed !== null && manualPaymentMonths === null ? (
                <div className="text-xs text-danger" data-testid="admin.user.payments.add.validation">
                  {t('admin.user.payments.add_payment.validation.multiple', { monthly: formatMoneyLike(activeMonthlyPayment) })}
                </div>
              ) : activeMonthlyPayment !== null ? (
                <div className="text-xs text-muted" data-testid="admin.user.payments.add.hint">
                  {t('admin.user.payments.add_payment.hint.multiple', { monthly: formatMoneyLike(activeMonthlyPayment) })}
                </div>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={manualPaymentMonths === null || addM.isPending || monthlyPaymentM.isPending || accountReviewBlocked}
                testId="admin.user.payments.add.save"
              >
                {t('admin.user.payments.add_payment')}
              </Button>
            </form>
          </div>
          ) : null}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={settingsReview !== null}
        title={t('admin.user.payments.review.settings.title')}
        description={t('admin.user.payments.review.settings.subtitle')}
        confirmLabel={t('common.save')}
        confirmLoading={settingsMutationPending}
        confirmDisabled={accountReviewBlocked || settingsReviewStale}
        cancelDisabled={settingsMutationPending}
        onCancel={() => {
          if (!settingsMutationPending) setSettingsReview(null);
        }}
        onConfirm={() => {
          if (settingsReview === null || settingsReviewStale || accountReviewBlocked || settingsInFlightRef.current) return;
          settingsInFlightRef.current = true;
          if (settingsReview.kind === 'paid_until') {
            paidUntilM.mutate(settingsReview.next || null);
          } else {
            monthlyPaymentM.mutate(settingsReview.next);
          }
        }}
        testId="admin.user.payments.settings.review"
      >
        {settingsReview ? (
          <div className="space-y-3">
            {settingsReviewStale ? (
              <Alert
                variant="warn"
                title={t('admin.user.payments.review.settings.stale.title')}
                testId="admin.user.payments.settings.review.stale"
              >
                {t('admin.user.payments.review.settings.stale.body')}
              </Alert>
            ) : null}
            {paidUntilMovesBackward ? (
              <Alert
                variant="warn"
                title={t('admin.user.payments.review.settings.backward.title')}
                testId="admin.user.payments.settings.review.backward"
              >
                {t('admin.user.payments.review.settings.backward.body')}
              </Alert>
            ) : null}
            {paidUntilClears ? (
              <Alert
                variant="danger"
                title={t('admin.user.payments.review.settings.clear.title')}
                testId="admin.user.payments.settings.review.clear"
              >
                {t('admin.user.payments.review.settings.clear.body')}
              </Alert>
            ) : null}
            <div className="divide-y divide-border rounded-md border border-border bg-surface-2 text-sm">
              <div className="grid gap-1 p-3 sm:grid-cols-[9rem_minmax(0,1fr)]" data-testid="admin.user.payments.settings.review.target">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('admin.user.payments.review.target')}</div>
                <div className="break-words font-medium">{user.login ? `${user.login} (#${userId})` : `#${userId}`}</div>
              </div>
              <div className="grid gap-1 p-3 sm:grid-cols-[9rem_minmax(0,1fr)]" data-testid="admin.user.payments.settings.review.change">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">
                  {t(settingsReview.kind === 'paid_until'
                    ? 'admin.user.payments.settings.field.paid_until'
                    : 'admin.user.payments.settings.field.monthly_payment')}
                </div>
                <div className="break-words font-medium tabular-nums">
                  {settingsReview.kind === 'paid_until' ? (
                    <>{settingsReview.previous || t('common.none')} → {settingsReview.next || t('common.none')}</>
                  ) : (
                    <>{formatMoneyLike(settingsReview.previous ?? undefined)} → {formatMoneyLike(settingsReview.next)}</>
                  )}
                </div>
              </div>
            </div>
            <Alert variant="info" title={t('admin.user.payments.review.impact')}>
              {t(settingsReview.kind === 'paid_until'
                ? 'admin.user.payments.review.settings.paid_until.impact'
                : 'admin.user.payments.review.settings.monthly_payment.impact')}
            </Alert>
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={manualPaymentReview !== null}
        title={t('admin.user.payments.review.add.title')}
        description={t('admin.user.payments.review.add.subtitle')}
        confirmLabel={t('admin.user.payments.add_payment')}
        confirmLoading={addM.isPending}
        confirmDisabled={accountReviewBlocked || manualPaymentReviewStale}
        cancelDisabled={addM.isPending}
        onCancel={() => {
          if (!addM.isPending) setManualPaymentReview(null);
        }}
        onConfirm={() => {
          if (manualPaymentReview === null || manualPaymentReviewStale || accountReviewBlocked || manualPaymentInFlightRef.current) return;
          manualPaymentInFlightRef.current = true;
          addM.mutate(manualPaymentReview.amount);
        }}
        testId="admin.user.payments.add.review"
      >
        {manualPaymentReview !== null ? (
          <div className="space-y-3">
            {manualPaymentReviewStale ? (
              <Alert
                variant="warn"
                title={t('admin.user.payments.review.add.stale.title')}
                testId="admin.user.payments.add.review.stale"
              >
                {t('admin.user.payments.review.add.stale.body')}
              </Alert>
            ) : null}
            <div className="divide-y divide-border rounded-md border border-border bg-surface-2 text-sm">
              <div className="grid gap-1 p-3 sm:grid-cols-[9rem_minmax(0,1fr)]" data-testid="admin.user.payments.add.review.target">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('admin.user.payments.review.target')}</div>
                <div className="break-words font-medium">{user.login ? `${user.login} (#${userId})` : `#${userId}`}</div>
              </div>
              <div className="grid gap-1 p-3 sm:grid-cols-[9rem_minmax(0,1fr)]" data-testid="admin.user.payments.add.review.monthly">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('admin.user.payments.settings.field.monthly_payment')}</div>
                <div className="font-medium tabular-nums">{formatMoneyLike(manualPaymentReview.monthlyPayment)}</div>
              </div>
              <div className="grid gap-1 p-3 sm:grid-cols-[9rem_minmax(0,1fr)]" data-testid="admin.user.payments.add.review.months">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('admin.user.payments.add_payment.field.months')}</div>
                <div className="font-medium tabular-nums">{manualPaymentReview.months}</div>
              </div>
              <div className="grid gap-1 p-3 sm:grid-cols-[9rem_minmax(0,1fr)]" data-testid="admin.user.payments.add.review.amount">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('admin.user.payments.add_payment.field.amount')}</div>
                <div className="font-medium tabular-nums">{formatMoneyLike(manualPaymentReview.amount)}</div>
              </div>
            </div>
            <Alert variant="info" title={t('admin.user.payments.review.impact')}>
              {t('admin.user.payments.review.add.impact')}
            </Alert>
            <Alert variant="warn" title={t('admin.user.payments.review.add.email.title')}>
              {t('admin.user.payments.review.add.email.body')}
            </Alert>
            <p className="text-xs text-muted">{t('admin.user.payments.review.add.queue')}</p>
          </div>
        ) : null}
      </ConfirmDialog>

      <Card testId="admin.user.payments.instructions.card">
        <CardHeader
          className={instructionsOpen ? undefined : 'border-b-0'}
          title={t('payments.my.instructions.title')}
          subtitle={t('admin.user.payments.instructions.description')}
          actions={(
            <>
              {instructionsOpen && instructions ? (
                <CopyButton
                  text={instructionsCopyText}
                  testId="admin.user.payments.instructions.copy"
                />
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setInstructionsOpen((open) => !open)}
                aria-expanded={instructionsOpen}
                aria-controls="admin-user-payment-instructions-content"
                testId="admin.user.payments.instructions.toggle"
              >
                {t(instructionsOpen ? 'common.collapse' : 'common.expand')}
              </Button>
            </>
          )}
        />
        {instructionsOpen ? (
          <CardBody>
            <div id="admin-user-payment-instructions-content">
              {instructionsQ.isLoading ? <LoadingState /> : null}
              {instructionsQ.isError ? (
                <ErrorState
                  title={t('payments.my.instructions.load_error.title')}
                  error={instructionsQ.error}
                  onRetry={() => void instructionsQ.refetch()}
                  showBack={false}
                />
              ) : null}
              {!instructionsQ.isLoading && !instructionsQ.isError ? (
                instructions ? (
                  <PaymentInstructionsHtml
                    html={instructions}
                    testId="admin.user.payments.instructions.text"
                  />
                ) : (
                  <div className="text-sm text-muted" data-testid="admin.user.payments.instructions.empty">
                    {t('common.na')}
                  </div>
                )
              ) : null}
            </div>
          </CardBody>
        ) : null}
      </Card>

      <div className="space-y-3">
        <Card>
          <CardHeader title={t('admin.user.payments.history.title')} subtitle={t('admin.user.payments.history.description')} />
          <CardBody>
            {historyQ.isLoading ? <LoadingState /> : null}
            {historyInitialError ? (
              <ErrorState
                testId="admin.user.payments.history.error"
                title={t('payments.my.history.load_error.title')}
                error={historyQ.error}
              />
            ) : null}
            {historyDataStale ? (
              <Alert
                variant="warn"
                title={t('admin.user.payments.history.stale.title')}
                description={t('admin.user.payments.history.stale.body')}
                testId="admin.user.payments.history.stale"
              />
            ) : null}

            {!historyQ.isLoading && historyQ.data !== undefined ? (
              visibleHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-list" data-testid="admin.user.payments.history.table">
                    <thead className="bg-surface-2">
                      <tr className="text-left text-xs text-muted">
                        <th className="px-3 py-2">{t('payments.my.history.col.created')}</th>
                        <th className="px-3 py-2 text-right">{t('payments.my.history.col.amount')}</th>
                        <th className="px-3 py-2">{t('payments.my.history.col.period')}</th>
                        <th className="px-3 py-2">{t('admin.user.payments.history.col.source')}</th>
                        <th className="px-3 py-2">{t('admin.user.payments.history.col.accounted_by')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visibleHistory.map((p) => (
                        <tr key={p.id} data-testid={`admin.user.payments.history.row.${p.id}`}>
                          <td
                            className="px-3 py-2 font-medium tabular-nums"
                            data-testid={`admin.user.payments.history.row.${p.id}.accepted_at`}
                          >
                            {formatDateTimeInTimeZone(p.created_at, accountTimeZone)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatMoneyLike(safeInt(p.amount))}</td>
                          <td className="px-3 py-2">
                            <span className="text-sm font-medium tabular-nums text-fg">
                              {formatDateInTimeZone(p.from_date, accountTimeZone)}
                            </span>
                            <span className="mx-2 text-muted">→</span>
                            <span className="text-sm font-medium tabular-nums text-fg">
                              {formatDateInTimeZone(p.to_date, accountTimeZone)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted">
                            {p.incoming_payment?.id ? (
                              <Link
                                className="text-accent hover:underline"
                                to={`${basePath}/payments/incoming/${p.incoming_payment.id}`}
                                data-testid={`admin.user.payments.history.row.${p.id}.source`}
                              >
                                #{p.incoming_payment.id}
                              </Link>
                            ) : (
                              <span className="text-faint" data-testid={`admin.user.payments.history.row.${p.id}.source`}>
                                {t('admin.user.payments.history.source.manual')}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted">
                            <span className="tabular-nums">{resourceRefLabel(p.accounted_by)}</span>
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

    </div>
  );
}
