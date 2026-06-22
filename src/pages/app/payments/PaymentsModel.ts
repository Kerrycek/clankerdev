import type { ResourceRef } from '../../../lib/api/payments';
import type { PaidUntilStatus } from '../../../lib/paymentsBadges';

export type PaymentSubtitleToken =
  | { kind: 'text'; key: string }
  | { kind: 'plural'; key: string; count: number };

export function parsePositiveInt(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function paidUntilSubtitleToken(status: { status: PaidUntilStatus; days?: number }): PaymentSubtitleToken {
  if (status.status === 'overdue' && status.days === undefined) {
    return { kind: 'text', key: 'payments.my.stat.paid_until.missing' };
  }

  if (status.status === 'unknown' || status.days === undefined) {
    return { kind: 'text', key: 'common.na' };
  }

  if (status.status === 'overdue') {
    const overdueDays = Math.max(0, Math.abs(status.days));
    if (overdueDays === 0) return { kind: 'text', key: 'payments.my.stat.paid_until.today' };
    return { kind: 'plural', key: 'payments.my.stat.paid_until.expired', count: overdueDays };
  }

  const daysLeft = Math.max(0, status.days);
  if (daysLeft === 0) return { kind: 'text', key: 'payments.my.stat.paid_until.today' };
  return { kind: 'plural', key: 'payments.my.stat.paid_until.in_days', count: daysLeft };
}

export function resourceRefLabel(ref: ResourceRef | null | undefined): string {
  if (!ref) return '—';

  const primary = [ref.login, ref.label, ref.name]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);

  if (primary && typeof ref.id === 'number') return `${primary} (#${ref.id})`;
  if (primary) return primary;
  if (typeof ref.id === 'number') return `#${ref.id}`;

  return '—';
}

export function normalizePaymentInstructions(data: { instructions?: string | null } | undefined): string {
  return String(data?.instructions ?? '').trim();
}

function timestampOrNull(value: unknown): number | null {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

export type PaymentSettingsReview = {
  monthlyChanged: boolean;
  paidUntilChanged: boolean;
  hasChanges: boolean;
  clearsPaidUntil: boolean;
  movesPaidUntilBackward: boolean;
};

export function buildPaymentSettingsReview(input: {
  currentMonthly?: number;
  nextMonthly: number | null;
  currentPaidUntil: unknown;
  nextPaidUntilIso: string | null;
}): PaymentSettingsReview {
  const monthlyChanged = input.nextMonthly !== null && input.currentMonthly !== input.nextMonthly;
  const currentPaidUntilTs = timestampOrNull(input.currentPaidUntil);
  const nextPaidUntilTs = timestampOrNull(input.nextPaidUntilIso);
  const paidUntilChanged = currentPaidUntilTs !== nextPaidUntilTs;

  return {
    monthlyChanged,
    paidUntilChanged,
    hasChanges: monthlyChanged || paidUntilChanged,
    clearsPaidUntil: currentPaidUntilTs !== null && nextPaidUntilTs === null,
    movesPaidUntilBackward: currentPaidUntilTs !== null && nextPaidUntilTs !== null && nextPaidUntilTs < currentPaidUntilTs,
  };
}

export type ManualPaymentPreview = {
  months: number | null;
  amount?: number;
  canSubmit: boolean;
  validationKey?: string;
};

export function buildManualPaymentPreview(input: {
  monthlyPayment?: number;
  rawMonths: string;
}): ManualPaymentPreview {
  if (!input.monthlyPayment) {
    return {
      months: null,
      canSubmit: false,
      validationKey: 'admin.user.payments.add_payment.validation.no_monthly_payment',
    };
  }

  const months = parsePositiveInt(input.rawMonths);
  if (!months) {
    return {
      months,
      canSubmit: false,
      validationKey: 'admin.user.payments.add_payment.validation.months',
    };
  }

  return {
    months,
    amount: input.monthlyPayment * months,
    canSubmit: true,
  };
}
