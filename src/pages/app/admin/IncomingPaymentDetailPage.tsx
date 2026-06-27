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
  fetchPaymentInstructions,
  type IncomingPayment,
  type IncomingPaymentState,
  updateIncomingPaymentState,
} from '../../../lib/api/payments';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { fetchUser, type User } from '../../../lib/api/users';
import { fetchUserAccount } from '../../../lib/api/userAccounts';

import { formatErrorMessage } from '../../../lib/errors';
import { formatDateTime } from '../../../lib/format';
import { parseLookupIdLike } from '../../../lib/lookupInput';
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
import { CopyButton } from '../../../components/ui/CopyButton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { StatusDot } from '../../../components/ui/StatusDot';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';

function safeNumber(value: string | undefined): number | undefined {
  const t = String(value ?? '').trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i <= 0) return undefined;
  return i;
}

function safePositiveInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return undefined;
}

function formatMoney(amount?: number | null, currency?: string | null): string {
  if (amount === undefined || amount === null) return '—';
  const c = String(currency ?? '').trim();

  try {
    if (c) return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(amount);
  } catch {
    // ignore Intl formatting errors
  }

  const fixed = Math.abs(amount) >= 10 ? amount.toFixed(0) : amount.toFixed(2);
  return c ? `${fixed} ${c}` : fixed;
}

function userLabel(u: any): string {
  if (!u) return '—';
  if (typeof u.login === 'string') return u.login;
  if (typeof u.label === 'string') return u.label;
  if (typeof u.name === 'string') return u.name;
  if (typeof u.id === 'number') return `#${u.id}`;
  return String(u);
}

function userSecondaryLabel(user: User | undefined): string {
  if (!user) return '—';
  const parts = [user.full_name, user.email].filter((v) => typeof v === 'string' && v.trim());
  return parts.length ? parts.join(' · ') : `#${user.id}`;
}

function stateOptions(): IncomingPaymentState[] {
  return ['queued', 'unmatched', 'processed', 'ignored'];
}

function candidateUserIdFromVs(payment: IncomingPayment | undefined): number | undefined {
  const parsed = parseLookupIdLike(String(payment?.vs ?? ''));
  return parsed ?? undefined;
}

export function IncomingPaymentDetailPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const toasts = useToasts();
  const chrome = useChrome();
  const qc = useQueryClient();

  const params = useParams();
  const paymentId = safeNumber(params['paymentId']);

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
  const acctStatus = (payment as LegacyAny)?.user ? getPaidUntilStatus((payment as LegacyAny)?.user_paid_until) : null;
  const primaryVar = incomingPaymentPrimaryVariant({
    state: st,
    user: (payment as LegacyAny)?.user,
    user_paid_until: (payment as LegacyAny)?.user_paid_until,
  });
  const dotVar = dotVariantFromBadgeVariant(primaryVar);

  const [stateEdit, setStateEdit] = useState('');
  const effectiveStateEdit = stateEdit || st;

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const isAssigned = Boolean((payment as LegacyAny)?.user);
  const isProcessed = st === 'processed';
  const canAssign = Boolean(paymentId) && !isAssigned && !isProcessed;
  const vsCandidateUserId = candidateUserIdFromVs(payment);
  const selectedUserId = parseLookupIdLike(assignUserId) ?? undefined;

  const assignUserQ = useQuery({
    queryKey: ['users', 'show', selectedUserId],
    enabled: assignOpen && selectedUserId !== undefined,
    queryFn: async () => {
      if (selectedUserId === undefined) throw new Error('missing user id');
      return (await fetchUser(selectedUserId)).data;
    },
    staleTime: 30_000,
  });

  const assignAccountQ = useQuery({
    queryKey: ['user_accounts', selectedUserId],
    enabled: assignOpen && selectedUserId !== undefined && Boolean(assignUserQ.data),
    queryFn: async () => {
      if (selectedUserId === undefined) throw new Error('missing user id');
      return (await fetchUserAccount(selectedUserId)).data;
    },
    staleTime: 30_000,
  });

  const assignInstructionsQ = useQuery({
    queryKey: ['users', 'payment_instructions', selectedUserId],
    enabled: assignOpen && selectedUserId !== undefined && Boolean(assignUserQ.data),
    queryFn: async () => {
      if (selectedUserId === undefined) throw new Error('missing user id');
      return (await fetchPaymentInstructions(selectedUserId)).data;
    },
    staleTime: 10 * 60_000,
  });

  const assignUser = assignUserQ.data;
  const assignInstructions = String(assignInstructionsQ.data?.instructions ?? '').trim();
  const assignMonthlyPayment = safePositiveInt(assignAccountQ.data?.monthly_payment ?? assignUser?.monthly_payment);
  const assignPaidUntil = assignAccountQ.data?.paid_until ?? assignUser?.paid_until;
  const assignedAmount = safePositiveInt(payment?.amount);
  const estimatedMonths =
    assignedAmount !== undefined && assignMonthlyPayment !== undefined && assignMonthlyPayment > 0
      ? Math.floor(assignedAmount / assignMonthlyPayment)
      : undefined;

  const recvAmount = useMemo(() => {
    if (!payment) return '—';
    return formatMoney(payment.src_amount ?? payment.amount, payment.src_currency ?? payment.currency);
  }, [payment]);

  const acctAmount = useMemo(() => {
    if (!payment) return null;
    if (payment.src_amount === undefined || payment.src_amount === null) return null;
    return formatMoney(payment.amount, payment.currency);
  }, [payment]);

  const openAssign = () => {
    if (!canAssign) return;
    if (!assignUserId.trim() && vsCandidateUserId !== undefined) {
      setAssignUserId(String(vsCandidateUserId));
    }
    setAssignOpen(true);
  };

  async function saveState() {
    if (!paymentId) return;

    const next = String(effectiveStateEdit).trim();
    if (!next) return;

    try {
      await updateIncomingPaymentState(paymentId, next);

      toasts.pushToast({
        variant: 'ok',
        title: t('payments.incoming.detail.toast.state_updated.title'),
        body: t('payments.incoming.detail.toast.state_updated.message'),
      });

      setStateEdit('');
      q.refetch();
      qc.invalidateQueries({ queryKey: ['incoming_payments', 'index'] });
    } catch (e: any) {
      toasts.pushToast({
        variant: 'danger',
        title: t('payments.incoming.detail.toast.state_updated.error.title'),
        body: formatErrorMessage(e),
      });
    }
  }

  async function submitAssign() {
    if (!paymentId) return;

    if (!canAssign) {
      toasts.pushToast({
        variant: 'danger',
        title: t('payments.incoming.assign.toast.error.title'),
        body: t('payments.incoming.assign.toast.unavailable.message'),
      });
      return;
    }

    if (!selectedUserId) {
      toasts.pushToast({
        variant: 'danger',
        title: t('payments.incoming.assign.toast.invalid_user.title'),
        body: t('payments.incoming.assign.toast.invalid_user.message'),
      });
      return;
    }

    let verifiedUser = assignUser;
    if (!verifiedUser) {
      const refetched = await assignUserQ.refetch();
      verifiedUser = refetched.data;
    }

    if (!verifiedUser) {
      toasts.pushToast({
        variant: 'danger',
        title: t('payments.incoming.assign.toast.verify_user_failed.title'),
        body: t('payments.incoming.assign.toast.verify_user_failed.message'),
      });
      return;
    }

    setAssignSubmitting(true);
    try {
      const res = await createUserPayment({ incoming_payment: paymentId, user: selectedUserId });
      const asId = getMetaActionStateId(res.meta);
      if (asId) chrome.trackActionState(asId);

      toasts.pushToast({
        variant: 'ok',
        title: t('payments.incoming.assign.toast.title'),
        body: t('payments.incoming.assign.toast.message'),
      });

      setAssignOpen(false);
      setAssignUserId('');

      await q.refetch();
      qc.invalidateQueries({ queryKey: ['incoming_payments', 'index'] });
      qc.invalidateQueries({ queryKey: ['user_payments'] });
      qc.invalidateQueries({ queryKey: ['user_accounts', selectedUserId] });
    } catch (e: any) {
      toasts.pushToast({
        variant: 'danger',
        title: t('payments.incoming.assign.toast.error.title'),
        body: formatErrorMessage(e),
        autoDismissMs: false,
      });
    } finally {
      setAssignSubmitting(false);
    }
  }

  if (!paymentId) {
    return (
      <ListShell>
        <ErrorState title={t('payments.incoming.detail.invalid')} error={{ message: t('payments.incoming.detail.invalid.body') } as LegacyAny} />
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
        <ErrorState title={t('payments.incoming.detail.load_error.title')} error={q.error as LegacyAny} />
      </ListShell>
    );
  }

  if (!payment) {
    return (
      <ListShell>
        <ErrorState title={t('payments.incoming.detail.load_error.title')} error={{ message: t('payments.incoming.detail.not_found') } as LegacyAny} />
      </ListShell>
    );
  }

  const assignSubmitDisabled =
    assignSubmitting || !selectedUserId || assignUserQ.isLoading || assignUserQ.isFetching || assignUserQ.isError || !assignUser;

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
              onClick={openAssign}
              disabled={!canAssign}
              disabledReason={isProcessed ? t('payments.incoming.assign.unavailable.processed') : isAssigned ? t('payments.incoming.assign.unavailable.assigned') : undefined}
              testId="admin.payments.incoming.assign.open"
            >
              {t('payments.incoming.assign.button')}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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

        <div className="space-y-3">
          <Card>
            <CardHeader title={t('payments.incoming.detail.card.user')} />
            <CardBody>
              <div className="text-xs text-muted">{t('common.user')}</div>
              <div className="text-sm">
                {(payment as LegacyAny).user ? (
                  <Link className="text-accent hover:underline" to={`${basePath}/users/${(payment as LegacyAny).user.id}`}>
                    {userLabel((payment as LegacyAny).user)}
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

              {canAssign ? (
                <div className="mt-4 text-xs text-muted">{t('payments.incoming.detail.unassigned_hint')}</div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('payments.incoming.detail.card.state')} />
            <CardBody>
              <div className="flex items-center gap-2">
                <StatusDot variant={dotVar} />
                <Badge variant={incomingPaymentBadgeVariant(st)} testId={`admin.payments.incoming.detail.${paymentId}.state.card`}>{t(incomingPaymentStateLabelKey(st))}</Badge>
              </div>

              <div className="mt-3">
                <div className="text-xs text-muted">{t('payments.incoming.detail.change_state')}</div>
                <Select value={effectiveStateEdit} onChange={(e) => setStateEdit(e.target.value)}>
                  {stateOptions().map((s) => (
                    <option key={s} value={s}>
                      {t(incomingPaymentStateLabelKey(s))}
                    </option>
                  ))}
                </Select>
                <div className="mt-2">
                  <Button variant="secondary" onClick={saveState} testId="admin.payments.incoming.state.save">
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
        size="lg"
        testId="admin.payments.incoming.assign.modal"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={submitAssign}
              disabled={assignSubmitDisabled}
              loading={assignSubmitting}
              testId="admin.payments.incoming.assign.submit"
            >
              {t('payments.incoming.assign.modal.submit')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium">{t('payments.incoming.assign.user_id')}</div>
            <div className="mt-1">
              <UserLookupInput
                value={assignUserId}
                onChange={setAssignUserId}
                onPick={(u) => setAssignUserId(String(u.id))}
                placeholder={t('payments.incoming.assign.user_placeholder')}
                testId="admin.payments.incoming.assign.user_id"
                ariaLabel={t('payments.incoming.assign.user_id')}
                loadingLabel={t('common.loading')}
                noResultsLabel={t('empty.list.no_matches.title')}
              />
            </div>
            {vsCandidateUserId !== undefined ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
                <span>{t('payments.incoming.assign.vs_candidate', { userId: vsCandidateUserId })}</span>
                {selectedUserId !== vsCandidateUserId ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setAssignUserId(String(vsCandidateUserId))}
                    testId="admin.payments.incoming.assign.use_vs"
                  >
                    {t('payments.incoming.assign.use_vs')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-md border border-border bg-surface-2 p-3" data-testid="admin.payments.incoming.assign.recap.payment">
              <div className="text-sm font-semibold">{t('payments.incoming.assign.recap.payment.title')}</div>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t('payments.incoming.detail.received_amount')}</dt>
                  <dd className="text-right font-medium tabular-nums">{recvAmount}</dd>
                </div>
                {acctAmount ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t('payments.incoming.detail.accounted_amount')}</dt>
                    <dd className="text-right font-medium tabular-nums">{acctAmount}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t('common.date')}</dt>
                  <dd className="text-right tabular-nums">{formatDateTime(payment.date)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">VS</dt>
                  <dd className="text-right tabular-nums">{String(payment.vs ?? '—')}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t('payments.incoming.detail.transaction_id')}</dt>
                  <dd className="text-right tabular-nums">{String(payment.transaction_id ?? '—')}</dd>
                </div>
              </dl>
              <div className="mt-3 text-xs text-muted whitespace-pre-line">
                {String(payment.user_message || payment.comment || '—')}
              </div>
            </div>

            <div className="rounded-md border border-border bg-surface-2 p-3" data-testid="admin.payments.incoming.assign.recap.user">
              <div className="text-sm font-semibold">{t('payments.incoming.assign.recap.user.title')}</div>
              {!selectedUserId ? (
                <div className="mt-3 text-xs text-muted">{t('payments.incoming.assign.recap.user.empty')}</div>
              ) : assignUserQ.isLoading || assignUserQ.isFetching ? (
                <div className="mt-3 text-xs text-muted">{t('common.loading')}</div>
              ) : assignUserQ.isError ? (
                <div className="mt-3 rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-xs text-danger">
                  {t('payments.incoming.assign.recap.user.error')}: {formatErrorMessage(assignUserQ.error)}
                </div>
              ) : assignUser ? (
                <div className="mt-3 space-y-2 text-xs">
                  <div>
                    <div className="text-muted">{t('common.user')}</div>
                    <Link className="text-sm font-medium text-accent hover:underline" to={`${basePath}/users/${assignUser.id}`}>
                      {userLabel(assignUser)} <span className="text-faint">#{assignUser.id}</span>
                    </Link>
                    <div className="mt-0.5 text-muted">{userSecondaryLabel(assignUser)}</div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <div className="text-muted">{t('payments.my.stat.monthly_payment')}</div>
                      <div className="tabular-nums">{assignMonthlyPayment !== undefined ? String(assignMonthlyPayment) : '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted">{t('payments.incoming.detail.paid_until')}</div>
                      <div className="tabular-nums">{assignPaidUntil ? formatDateTime(String(assignPaidUntil)) : '—'}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {assignUser ? (
            <div className="rounded-md border border-border bg-surface-2 p-3" data-testid="admin.payments.incoming.assign.instructions">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{t('payments.incoming.assign.instructions.title')}</div>
                  <div className="mt-1 text-xs text-muted">{t('payments.incoming.assign.instructions.description')}</div>
                </div>
                {assignInstructions ? <CopyButton text={assignInstructions} testId="admin.payments.incoming.assign.instructions.copy" /> : null}
              </div>
              {assignInstructionsQ.isLoading || assignInstructionsQ.isFetching ? (
                <div className="mt-3 text-xs text-muted">{t('common.loading')}</div>
              ) : assignInstructionsQ.isError ? (
                <div className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
                  {t('payments.incoming.assign.instructions.error')}: {formatErrorMessage(assignInstructionsQ.error)}
                </div>
              ) : assignInstructions ? (
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-md border border-border bg-surface p-3 text-xs">{assignInstructions}</pre>
              ) : (
                <div className="mt-3 text-xs text-muted">{t('payments.incoming.assign.instructions.empty')}</div>
              )}
            </div>
          ) : null}

          <div className="rounded-md border border-border bg-surface-2 p-3" data-testid="admin.payments.incoming.assign.impact">
            <div className="text-sm font-semibold">{t('payments.incoming.assign.impact.title')}</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
              <li>{t('payments.incoming.assign.impact.create_user_payment')}</li>
              <li>{t('payments.incoming.assign.impact.state')}</li>
              {estimatedMonths !== undefined && estimatedMonths > 0 ? (
                <li>{t('payments.incoming.assign.impact.estimated_extension', { months: estimatedMonths })}</li>
              ) : (
                <li>{t('payments.incoming.assign.impact.backend_computes')}</li>
              )}
            </ul>
          </div>
        </div>
      </Modal>
    </ListShell>
  );
}
