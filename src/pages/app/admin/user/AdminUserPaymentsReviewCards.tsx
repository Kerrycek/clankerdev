import React from 'react';

import { useI18n } from '../../../../app/i18n';
import { Alert } from '../../../../components/ui/Alert';
import { Badge } from '../../../../components/ui/Badge';
import { formatDateTime } from '../../../../lib/format';
import { formatMoneyLike } from '../../../../lib/paymentsFormat';
import type { ManualPaymentPreview, PaymentSettingsReview } from '../../payments/PaymentsModel';

function ReviewRow(props: { label: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <div data-testid={props.testId}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{props.label}</div>
      <div className="mt-1 text-sm text-fg">{props.children}</div>
    </div>
  );
}

function DateChange(props: { current: unknown; next: string | null }) {
  const { t } = useI18n();
  return (
    <span className="tabular-nums">
      {formatDateTime(typeof props.current === 'string' ? props.current : null)} →{' '}
      {props.next ? formatDateTime(props.next) : t('common.none')}
    </span>
  );
}

export function PaymentSettingsReviewCard(props: {
  userLabel: string;
  userId: number;
  currentMonthly?: number;
  nextMonthly: number | null;
  currentPaidUntil: unknown;
  nextPaidUntilIso: string | null;
  review: PaymentSettingsReview;
}) {
  const { t } = useI18n();

  return (
    <div
      className="space-y-3 rounded-lg border border-border bg-surface-2 p-3"
      data-testid="admin.user.payments.settings.review"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{t('admin.user.payments.review.settings.title')}</div>
          <div className="mt-1 text-xs text-muted">{t('admin.user.payments.review.settings.subtitle')}</div>
        </div>
        <Badge variant={props.review.hasChanges ? 'warn' : 'neutral'}>
          {props.review.hasChanges
            ? t('admin.user.payments.review.badge.pending_change')
            : t('admin.user.payments.review.badge.no_change')}
        </Badge>
      </div>

      {props.review.movesPaidUntilBackward ? (
        <Alert
          variant="warn"
          title={t('admin.user.payments.review.settings.backward.title')}
          testId="admin.user.payments.settings.review.backward"
        >
          {t('admin.user.payments.review.settings.backward.body')}
        </Alert>
      ) : null}

      {props.review.clearsPaidUntil ? (
        <Alert
          variant="danger"
          title={t('admin.user.payments.review.settings.clear.title')}
          testId="admin.user.payments.settings.review.clear"
        >
          {t('admin.user.payments.review.settings.clear.body')}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ReviewRow label={t('admin.user.payments.review.target')} testId="admin.user.payments.settings.review.target">
          {props.userLabel} <span className="text-muted">#{props.userId}</span>
        </ReviewRow>
        <ReviewRow label={t('admin.user.payments.review.impact')} testId="admin.user.payments.settings.review.impact">
          {props.review.hasChanges
            ? t('admin.user.payments.review.settings.impact')
            : t('admin.user.payments.review.settings.no_changes')}
        </ReviewRow>
        <ReviewRow label={t('admin.user.payments.settings.field.monthly_payment')} testId="admin.user.payments.settings.review.monthly">
          <span className="tabular-nums">
            {formatMoneyLike(props.currentMonthly)} → {props.nextMonthly !== null ? formatMoneyLike(props.nextMonthly) : t('common.na')}
          </span>
        </ReviewRow>
        <ReviewRow label={t('admin.user.payments.settings.field.paid_until')} testId="admin.user.payments.settings.review.paid_until">
          <DateChange current={props.currentPaidUntil} next={props.nextPaidUntilIso} />
        </ReviewRow>
      </div>
    </div>
  );
}

export function ManualPaymentReviewCard(props: {
  userLabel: string;
  userId: number;
  monthlyPayment?: number;
  preview: ManualPaymentPreview;
}) {
  const { t } = useI18n();

  return (
    <div
      className="space-y-3 rounded-lg border border-border bg-surface-2 p-3"
      data-testid="admin.user.payments.add.review"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{t('admin.user.payments.review.add.title')}</div>
          <div className="mt-1 text-xs text-muted">{t('admin.user.payments.review.add.subtitle')}</div>
        </div>
        <Badge variant={props.preview.canSubmit ? 'warn' : 'neutral'}>
          {props.preview.canSubmit
            ? t('admin.user.payments.review.badge.pending_change')
            : t('admin.user.payments.review.badge.incomplete')}
        </Badge>
      </div>

      {props.preview.validationKey ? (
        <Alert variant="warn" title={t('admin.user.payments.review.add.validation.title')}>
          {t(props.preview.validationKey)}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ReviewRow label={t('admin.user.payments.review.target')} testId="admin.user.payments.add.review.target">
          {props.userLabel} <span className="text-muted">#{props.userId}</span>
        </ReviewRow>
        <ReviewRow label={t('admin.user.payments.review.impact')} testId="admin.user.payments.add.review.impact">
          {t('admin.user.payments.review.add.impact')}
        </ReviewRow>
        <ReviewRow label={t('admin.user.payments.add_payment.field.months')} testId="admin.user.payments.add.review.months">
          <span className="tabular-nums">{props.preview.months ?? t('common.na')}</span>
        </ReviewRow>
        <ReviewRow label={t('admin.user.payments.add_payment.field.amount')} testId="admin.user.payments.add.review.amount">
          <span className="tabular-nums">{formatMoneyLike(props.preview.amount)}</span>
        </ReviewRow>
      </div>

      <div className="border-t border-border pt-2 text-xs text-muted">
        {props.monthlyPayment
          ? t('admin.user.payments.review.add.queue')
          : t('admin.user.payments.add_payment.validation.no_monthly_payment')}
      </div>
    </div>
  );
}
