import React from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import type { IncomingPayment, IncomingPaymentState } from '../../../lib/api/payments';
import type { User } from '../../../lib/api/users';
import { incomingPaymentBadgeVariant, incomingPaymentStateLabelKey } from '../../../lib/paymentsBadges';
import type { IncomingPaymentAssignReview, IncomingPaymentStateReview } from './IncomingPaymentsModel';

function ReviewRow(props: { label: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <div data-testid={props.testId}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{props.label}</div>
      <div className="mt-1 text-sm text-fg">{props.children}</div>
    </div>
  );
}

function stateLabel(t: (key: string) => string, state: IncomingPaymentState | ''): string {
  if (!state) return t('common.na');
  return t(incomingPaymentStateLabelKey(state));
}

function compactUserLabel(user: User): string {
  const login = String(user.login ?? '').trim();
  const name = String(user.full_name ?? '').trim();
  if (login && name && login !== name) return `${login} · ${name}`;
  return login || name || `#${user.id}`;
}

export function IncomingPaymentAssignReviewCard(props: {
  payment: IncomingPayment;
  review: IncomingPaymentAssignReview;
  targetUser?: User;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-3" data-testid="admin.payments.incoming.assign.review">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{t('payments.incoming.review.assign.title')}</div>
          <div className="mt-1 text-xs text-muted">{t('payments.incoming.review.assign.subtitle')}</div>
        </div>
        <Badge variant={props.review.canSubmit ? 'warn' : 'neutral'}>
          {props.review.canSubmit
            ? t('payments.incoming.review.badge.ready')
            : t('payments.incoming.review.badge.incomplete')}
        </Badge>
      </div>

      {props.review.validationKey ? (
        <Alert variant="warn" title={t('payments.incoming.review.assign.validation.title')} testId="admin.payments.incoming.assign.review.validation">
          {t(props.review.validationKey)}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ReviewRow label={t('payments.incoming.review.target_payment')} testId="admin.payments.incoming.assign.review.target">
          #{props.payment.id}
        </ReviewRow>
        <ReviewRow label={t('payments.incoming.review.target_user')} testId="admin.payments.incoming.assign.review.user">
          {props.targetUser ? (
            <span>
              <span className="font-medium">{compactUserLabel(props.targetUser)}</span>
              <span className="ml-2 text-xs text-muted">#{props.targetUser.id}</span>
              {props.targetUser.email ? <span className="mt-1 block text-xs text-muted">{props.targetUser.email}</span> : null}
            </span>
          ) : props.review.userId ? (
            `#${props.review.userId}`
          ) : (
            t('common.na')
          )}
        </ReviewRow>
        <ReviewRow label={t('payments.incoming.detail.received_amount')} testId="admin.payments.incoming.assign.review.amount">
          <span className="tabular-nums">{props.review.receivedAmountLabel}</span>
          {props.review.accountedAmountLabel ? (
            <span className="ml-2 text-xs text-muted">
              {t('payments.incoming.detail.accounted_amount')}: {props.review.accountedAmountLabel}
            </span>
          ) : null}
        </ReviewRow>
        <ReviewRow label={t('payments.incoming.review.assign.result_state')} testId="admin.payments.incoming.assign.review.state">
          <span className="inline-flex items-center gap-2">
            <Badge variant={incomingPaymentBadgeVariant('processed')}>{t(incomingPaymentStateLabelKey('processed'))}</Badge>
            <span className="text-muted">
              {props.review.marksProcessed
                ? t('payments.incoming.review.assign.result_state.set_processed')
                : t('payments.incoming.review.assign.result_state.already_processed')}
            </span>
          </span>
        </ReviewRow>
      </div>

      <div className="border-t border-border pt-2 text-xs text-muted">
        {t('payments.incoming.review.assign.queue_note')}
      </div>
    </div>
  );
}

export function IncomingPaymentStateReviewCard(props: {
  payment: IncomingPayment;
  review: IncomingPaymentStateReview;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-3" data-testid="admin.payments.incoming.state.review">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{t('payments.incoming.review.state.title')}</div>
          <div className="mt-1 text-xs text-muted">{t('payments.incoming.review.state.subtitle')}</div>
        </div>
        <Badge variant={props.review.badgeVariant}>
          {props.review.hasChange
            ? t('payments.incoming.review.badge.pending_change')
            : t('payments.incoming.review.badge.no_change')}
        </Badge>
      </div>

      {props.review.warningKey ? (
        <Alert variant="warn" title={t('payments.incoming.review.state.warning.title')} testId="admin.payments.incoming.state.review.warning">
          {t(props.review.warningKey)}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ReviewRow label={t('payments.incoming.review.target_payment')} testId="admin.payments.incoming.state.review.target">
          #{props.payment.id}
        </ReviewRow>
        <ReviewRow label={t('payments.incoming.review.state.change')} testId="admin.payments.incoming.state.review.change">
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant={incomingPaymentBadgeVariant(props.review.currentState)}>{stateLabel(t, props.review.currentState)}</Badge>
            <span className="text-muted">→</span>
            <Badge variant={incomingPaymentBadgeVariant(props.review.nextState)}>{stateLabel(t, props.review.nextState)}</Badge>
          </span>
        </ReviewRow>
        <ReviewRow label={t('payments.incoming.review.impact')} testId="admin.payments.incoming.state.review.impact">
          {t(props.review.impactKey)}
        </ReviewRow>
        <ReviewRow label={t('payments.incoming.review.assignment')} testId="admin.payments.incoming.state.review.assignment">
          {props.payment.user ? t('payments.incoming.review.assignment.assigned') : t('payments.incoming.review.assignment.unassigned')}
        </ReviewRow>
      </div>
    </div>
  );
}
