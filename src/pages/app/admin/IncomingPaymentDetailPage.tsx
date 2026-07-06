import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { useChrome } from '../../../components/layout/ChromeContext';

import {
  createUserPayment,
  fetchIncomingPayment,
  type IncomingPayment,
  updateIncomingPaymentState,
} from '../../../lib/api/payments';
import { getMetaActionStateId } from '../../../lib/api/haveapi';

import { formatDateTime } from '../../../lib/format';
import { formatErrorMessage } from '../../../lib/errors';
import {
  getPaidUntilStatus,
  incomingPaymentBadgeVariant,
  incomingPaymentPrimaryVariant,
  incomingPaymentStateLabelKey,
  paidUntilBadgeVariant,
  paidUntilStatusLabelKey,
} from '../../../lib/paymentsBadges';
import { dotVariantFromBadgeVariant } from '../../../lib/variantMap';

import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';

import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { StatusDot } from '../../../components/ui/StatusDot';
import { IncomingPaymentAssignReviewCard, IncomingPaymentStateReviewCard } from './IncomingPaymentReviewCards';
import { IncomingPaymentReconciliationCard } from './IncomingPaymentsReconciliationCards';
import {
  buildIncomingPaymentAssignReview,
  buildIncomingPaymentStateReview,
  incomingPaymentAccountedAmountLabel,
  incomingPaymentReceivedAmountLabel,
  incomingPaymentStateOptions,
  incomingPaymentUserLabel,
  parsePositivePaymentId,
} from './IncomingPaymentsModel';

export function IncomingPaymentDetailPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const toasts = useToasts();
  const chrome = useChrome();
  const qc = useQueryClient();

  const params = useParams();
  const paymentId = parsePositivePaymentId(params['paymentId']);

  const q = useQuery({
    queryKey: ['incoming_payments', 'show', paymentId],
    enabled: Boolean(paymentId),
    queryFn: async () => {
      if (!paymentId) throw new Error('invalid payment');
      return (await fetchIncomingPayment(paymentId)).data;
    },
  });

  const payment = q.data as IncomingPayment | undefined;

  const st = String(payment?.state ?? '').trim();
  const acctStatus = payment?.user ? getPaidUntilStatus(payment.user_paid_until) : null;
  const primaryVar = incomingPaymentPrimaryVariant({
    state: st,
    user: payment?.user,
    user_paid_until: payment?.user_paid_until,
  });
  const dotVar = dotVariantFromBadgeVariant(primaryVar);

  const [stateEdit, setStateEdit] = useState('');
  const [stateConfirm, setStateConfirm] = useState('');
  const effectiveStateEdit = stateEdit || st;

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');

  const isAssigned = Boolean(payment?.user);

  const recvAmount = useMemo(() => incomingPaymentReceivedAmountLabel(payment), [payment]);
  const acctAmount = useMemo(() => incomingPaymentAccountedAmountLabel(payment), [payment]);

  const stateReview = useMemo(
    () => buildIncomingPaymentStateReview({ payment, nextState: effectiveStateEdit, confirmationText: stateConfirm }),
    [effectiveStateEdit, payment, stateConfirm]
  );

  const assignReview = useMemo(
    () => buildIncomingPaymentAssignReview({ payment, rawUserId: assignUserId }),
    [assignUserId, payment]
  );

  async function saveState() {
    if (!paymentId || !stateReview.canSubmit) return;

    const next = String(stateReview.nextState).trim();
    if (!next) return;

    try {
      await updateIncomingPaymentState(paymentId, next);

      toasts.pushToast({
        variant: 'ok',
        title: t('payments.incoming.detail.toast.state_updated.title'),
        body: t('payments.incoming.detail.toast.state_updated.message'),
      });

      setStateEdit('');
      setStateConfirm('');
      q.refetch();
      qc.invalidateQueries({ queryKey: ['incoming_payments', 'index'] });
    } catch (e: unknown) {
      toasts.pushToast({
        variant: 'danger',
        title: t('payments.incoming.detail.toast.state_updated.error.title'),
        body: formatErrorMessage(e),
      });
    }
  }

  async function submitAssign() {
    if (!paymentId) return;

    const userId = assignReview.userId;
    if (!assignReview.canSubmit || !userId) {
      toasts.pushToast({
        variant: 'danger',
        title: t('payments.incoming.assign.toast.invalid_user.title'),
        body: t(assignReview.validationKey ?? 'payments.incoming.assign.toast.invalid_user.message'),
      });
      return;
    }

    try {
      const res = await createUserPayment({ incoming_payment: paymentId, user: userId });
      const asId = getMetaActionStateId(res.meta);
      if (asId) chrome.trackActionState(asId);

      // After matching, default to marking the incoming payment as processed.
      if (String(st).trim() !== 'processed') {
        try {
          await updateIncomingPaymentState(paymentId, 'processed');
        } catch (e: unknown) {
          toasts.pushToast({
            variant: 'warn',
            title: t('payments.incoming.assign.toast.state_update_failed.title'),
            body: `${t('payments.incoming.assign.toast.state_update_failed.message')} (${formatErrorMessage(e)})`,
          });
        }
      }

      toasts.pushToast({
        variant: 'ok',
        title: t('payments.incoming.assign.toast.title'),
        body: t('payments.incoming.assign.toast.message'),
      });

      setAssignOpen(false);
      setAssignUserId('');
      setStateEdit('');
      setStateConfirm('');

      await q.refetch();
      qc.invalidateQueries({ queryKey: ['incoming_payments', 'index'] });
    } catch (e: unknown) {
      toasts.pushToast({
        variant: 'danger',
        title: t('payments.incoming.assign.toast.error.title'),
        body: formatErrorMessage(e),
      });
    }
  }

  if (!paymentId) {
    return (
      <ListShell>
        <ErrorState title={t('payments.incoming.detail.invalid')} error={{ message: t('payments.incoming.detail.invalid.body') }} />
      </ListShell>
    );
  }

  if (q.isLoading) {
    return (
      <ListShell>
        <LoadingState />
      </ListShell>
    );
  }

  if (q.isError) {
    return (
      <ListShell>
        <ErrorState title={t('payments.incoming.detail.load_error.title')} error={q.error} />
      </ListShell>
    );
  }

  if (!payment) {
    return (
      <ListShell>
        <ErrorState title={t('payments.incoming.detail.load_error.title')} error={{ message: t('payments.incoming.detail.not_found') }} />
      </ListShell>
    );
  }

  return (
    <ListShell>
      <PageHeader
        title={`${t('payments.incoming.detail.title')} #${paymentId}`}
        description={
          <span className="inline-flex items-center gap-2">
            <StatusDot variant={dotVar} testId={`admin.payments.incoming.detail.${paymentId}.dot`} />
            <Badge variant={incomingPaymentBadgeVariant(st)} testId={`admin.payments.incoming.detail.${paymentId}.state`}>{t(incomingPaymentStateLabelKey(st))}</Badge>
            {acctStatus && (acctStatus.status === 'due_soon' || acctStatus.status === 'overdue') ? (
              <Badge variant={paidUntilBadgeVariant(acctStatus.status)}>{t(paidUntilStatusLabelKey(acctStatus.status))}</Badge>
            ) : null}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link className="text-sm text-accent hover:underline" to={`${basePath}/payments/incoming`}>
              {t('common.back')}
            </Link>
            <Button
              variant="primary"
              onClick={() => setAssignOpen(true)}
              disabled={isAssigned}
              testId="admin.payments.incoming.assign.open"
            >
              {t('payments.incoming.assign.button')}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Card>
          <CardHeader title={t('payments.incoming.detail.card.payment')} />
          <CardBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-muted">{t('common.date')}</div>
                <div className="text-sm">{formatDateTime(payment.date)}</div>
              </div>
              <div>
                <div className="text-xs text-muted">{t('payments.incoming.detail.transaction_id')}</div>
                <div className="text-sm tabular-nums">{String(payment.transaction_id ?? '—')}</div>
              </div>
              <div>
                <div className="text-xs text-muted">{t('payments.incoming.detail.received_amount')}</div>
                <div className="text-lg font-semibold tabular-nums">{recvAmount}</div>
                {acctAmount ? <div className="text-xs text-muted">{t('payments.incoming.detail.accounted_amount')}: {acctAmount}</div> : null}
              </div>
              <div>
                <div className="text-xs text-muted">{t('payments.incoming.detail.account')}</div>
                <div className="text-sm">{String(payment.account_name ?? '—')}</div>
              </div>
              <div>
                <div className="text-xs text-muted">VS</div>
                <div className="text-sm tabular-nums">{String(payment.vs ?? '—')}</div>
              </div>
              <div>
                <div className="text-xs text-muted">KS</div>
                <div className="text-sm tabular-nums">{String(payment.ks ?? '—')}</div>
              </div>
              <div>
                <div className="text-xs text-muted">SS</div>
                <div className="text-sm tabular-nums">{String(payment.ss ?? '—')}</div>
              </div>
              <div>
                <div className="text-xs text-muted">{t('payments.incoming.detail.user_ident')}</div>
                <div className="text-sm">{String(payment.user_ident ?? '—')}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-muted">{t('payments.incoming.detail.user_message')}</div>
                <div className="text-sm whitespace-pre-line">{String(payment.user_message ?? '—')}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-muted">{t('payments.incoming.detail.comment')}</div>
                <div className="text-sm whitespace-pre-line">{String(payment.comment ?? '—')}</div>
              </div>
            </div>
          </CardBody>
          </Card>

          <IncomingPaymentReconciliationCard payment={payment} basePath={basePath} />
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader title={t('payments.incoming.detail.card.user')} />
            <CardBody>
              <div className="text-xs text-muted">{t('common.user')}</div>
              <div className="text-sm">
                {payment.user ? (
                  <Link className="text-accent hover:underline" to={`${basePath}/users/${payment.user.id}`}>
                    {incomingPaymentUserLabel(payment.user)}
                  </Link>
                ) : (
                  '—'
                )}
              </div>

              <div className="mt-3 text-xs text-muted">{t('payments.incoming.detail.paid_until')}</div>
              <div className="text-sm">{payment.user_paid_until ? formatDateTime(payment.user_paid_until) : '—'}</div>
              {acctStatus ? (
                <div className="mt-1">
                  <Badge variant={paidUntilBadgeVariant(acctStatus.status)}>{t(paidUntilStatusLabelKey(acctStatus.status))}</Badge>
                </div>
              ) : null}

              {isAssigned ? null : (
                <div className="mt-4 text-xs text-muted">{t('payments.incoming.detail.unassigned_hint')}</div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('payments.incoming.detail.card.state')} />
            <CardBody>
              <div className="flex items-center gap-2">
                <StatusDot variant={dotVar} />
                <Badge variant={incomingPaymentBadgeVariant(st)} testId={`admin.payments.incoming.detail.${paymentId}.state.card`}>{t(incomingPaymentStateLabelKey(st))}</Badge>
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-xs text-muted">{t('payments.incoming.detail.change_state')}</div>
                  <Select
                    value={effectiveStateEdit}
                    onChange={(e) => {
                      setStateEdit(e.target.value);
                      setStateConfirm('');
                    }}
                    testId="admin.payments.incoming.state.select"
                  >
                    {incomingPaymentStateOptions().map((s) => (
                      <option key={s} value={s}>
                        {t(incomingPaymentStateLabelKey(s))}
                      </option>
                    ))}
                  </Select>
                </div>

                <IncomingPaymentStateReviewCard payment={payment} review={stateReview} />

                {stateReview.requiresConfirmation ? (
                  <div>
                    <div className="text-xs text-muted">
                      {t('payments.incoming.review.state.confirm.label', { target: stateReview.confirmationTarget })}
                    </div>
                    <Input
                      value={stateConfirm}
                      onChange={(e) => setStateConfirm(e.target.value)}
                      placeholder={stateReview.confirmationTarget}
                      testId="admin.payments.incoming.state.confirm"
                    />
                    <div className="mt-1 text-xs text-muted">
                      {t('payments.incoming.review.state.confirm.hint', { target: stateReview.confirmationTarget })}
                    </div>
                  </div>
                ) : null}

                <div>
                  <Button
                    variant="secondary"
                    onClick={saveState}
                    disabled={!stateReview.canSubmit}
                    testId="admin.payments.incoming.state.save"
                  >
                    {t('common.save')}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={t('payments.incoming.assign.modal.title')}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={submitAssign}
              disabled={!assignReview.canSubmit}
              testId="admin.payments.incoming.assign.submit"
            >
              {t('payments.incoming.assign.modal.submit')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium">{t('payments.incoming.assign.user_id')}</div>
            <UserLookupInput
              value={assignUserId}
              onChange={setAssignUserId}
              placeholder={t('payments.incoming.assign.user_placeholder')}
              testId="admin.payments.incoming.assign.user_id"
              ariaLabel={t('payments.incoming.assign.user_id')}
              loadingLabel={t('common.loading')}
              noResultsLabel={t('empty.list.no_matches.title')}
            />
          </div>

          <IncomingPaymentAssignReviewCard payment={payment} review={assignReview} />

          <div className="rounded-md border border-border bg-surface-2 p-3 text-xs text-muted">
            <div>{t('payments.incoming.assign.hint.title')}</div>
            <ul className="mt-2 list-disc pl-5">
              <li>{t('payments.incoming.assign.hint.item1')}</li>
              <li>{t('payments.incoming.assign.hint.item2')}</li>
              <li>{t('payments.incoming.assign.hint.item3')}</li>
            </ul>
          </div>
        </div>
      </Modal>
    </ListShell>
  );
}
