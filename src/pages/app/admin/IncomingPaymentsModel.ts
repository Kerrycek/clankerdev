import type { IncomingPayment, IncomingPaymentState, ResourceRef } from '../../../lib/api/payments';

export const INCOMING_PAYMENT_STATES = ['queued', 'unmatched', 'processed', 'ignored'] as const;
export type KnownIncomingPaymentState = (typeof INCOMING_PAYMENT_STATES)[number];

export type IncomingPaymentSmartKey = 'id' | 'state' | 'user' | 'q';

export function incomingPaymentStateOptions(): KnownIncomingPaymentState[] {
  return [...INCOMING_PAYMENT_STATES];
}

export function incomingPaymentStateFilterOptions(): string[] {
  return ['', ...INCOMING_PAYMENT_STATES];
}

export function isKnownIncomingPaymentState(value: unknown): value is KnownIncomingPaymentState {
  return INCOMING_PAYMENT_STATES.includes(String(value ?? '').trim().toLowerCase() as KnownIncomingPaymentState);
}

export function normalizeIncomingPaymentState(value: unknown): KnownIncomingPaymentState | '' {
  const v = String(value ?? '').trim().toLowerCase();
  return isKnownIncomingPaymentState(v) ? v : '';
}

export function parseIncomingPaymentStateValue(raw: string): KnownIncomingPaymentState | '' | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'all' || v === 'any' || v === '*') return '';
  return isKnownIncomingPaymentState(v) ? v : null;
}

export function parsePositiveIntInput(value: string | undefined | null): number | undefined {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

export function parsePositivePaymentId(value: string | undefined | null): number | undefined {
  return parsePositiveIntInput(value);
}

export function canonicalIncomingPaymentSmartKey(raw: string): IncomingPaymentSmartKey | null {
  const k = String(raw ?? '').trim().toLowerCase();
  if (!k) return null;

  if (k === 'id') return 'id';
  if (k === 'state' || k === 'st') return 'state';
  if (k === 'user' || k === 'u') return 'user';

  if (
    k === 'q' ||
    k === 'search' ||
    k === 's' ||
    k === 'tx' ||
    k === 'transaction' ||
    k === 'transaction_id' ||
    k === 'vs' ||
    k === 'account' ||
    k === 'acct' ||
    k === 'ident' ||
    k === 'msg' ||
    k === 'message'
  ) {
    return 'q';
  }

  return null;
}

export function formatIncomingPaymentMoney(amount?: number | null, currency?: string | null): string {
  if (amount === undefined || amount === null) return '—';

  const c = String(currency ?? '').trim();
  try {
    if (c) return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(amount);
  } catch {
    // Some API-provided currency values can be non-ISO labels; fall back to plain formatting.
  }

  const fixed = Math.abs(amount) >= 10 ? amount.toFixed(0) : amount.toFixed(2);
  return c ? `${fixed} ${c}` : fixed;
}

export function incomingPaymentUserLabel(user: ResourceRef | null | undefined): string {
  if (!user) return '—';

  const primary = [user.login, user.label, user.name]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);

  if (primary) return primary;
  if (typeof user.id === 'number') return `#${user.id}`;
  return '—';
}

export function incomingPaymentReceivedAmountLabel(payment: IncomingPayment | null | undefined): string {
  if (!payment) return '—';
  return formatIncomingPaymentMoney(payment.src_amount ?? payment.amount, payment.src_currency ?? payment.currency);
}

export function incomingPaymentAccountedAmountLabel(payment: IncomingPayment | null | undefined): string | null {
  if (!payment) return null;
  if (payment.src_amount === undefined || payment.src_amount === null) return null;
  return formatIncomingPaymentMoney(payment.amount, payment.currency);
}

export type IncomingPaymentAssignReview = {
  userId: number | null;
  canSubmit: boolean;
  validationKey?: string;
  alreadyAssigned: boolean;
  marksProcessed: boolean;
  receivedAmountLabel: string;
  accountedAmountLabel: string | null;
};

export function buildIncomingPaymentAssignReview(input: {
  payment: IncomingPayment | null | undefined;
  rawUserId: string;
}): IncomingPaymentAssignReview {
  const userId = parsePositiveIntInput(input.rawUserId) ?? null;
  const alreadyAssigned = Boolean(input.payment?.user);
  const currentState = normalizeIncomingPaymentState(input.payment?.state);

  let validationKey: string | undefined;
  if (!input.payment) validationKey = 'payments.incoming.review.assign.validation.no_payment';
  else if (alreadyAssigned) validationKey = 'payments.incoming.review.assign.validation.already_assigned';
  else if (!String(input.rawUserId ?? '').trim()) validationKey = 'payments.incoming.review.assign.validation.missing_user';
  else if (!userId) validationKey = 'payments.incoming.review.assign.validation.invalid_user';

  return {
    userId,
    canSubmit: Boolean(input.payment && userId && !alreadyAssigned),
    validationKey,
    alreadyAssigned,
    marksProcessed: currentState !== 'processed',
    receivedAmountLabel: incomingPaymentReceivedAmountLabel(input.payment),
    accountedAmountLabel: incomingPaymentAccountedAmountLabel(input.payment),
  };
}

export type IncomingPaymentStateReview = {
  currentState: IncomingPaymentState | '';
  nextState: IncomingPaymentState | '';
  hasChange: boolean;
  canSubmit: boolean;
  badgeVariant: 'neutral' | 'ok' | 'warn' | 'danger' | 'info';
  impactKey: string;
  warningKey?: string;
};

export function buildIncomingPaymentStateReview(input: {
  payment: IncomingPayment | null | undefined;
  nextState: IncomingPaymentState | '';
}): IncomingPaymentStateReview {
  const currentState = normalizeIncomingPaymentState(input.payment?.state);
  const nextState = normalizeIncomingPaymentState(input.nextState) || currentState;
  const hasChange = Boolean(currentState && nextState && currentState !== nextState);
  const hasAssignedUser = Boolean(input.payment?.user);

  if (!input.payment) {
    return {
      currentState,
      nextState,
      hasChange: false,
      canSubmit: false,
      badgeVariant: 'neutral',
      impactKey: 'payments.incoming.review.state.no_payment',
    };
  }

  if (!hasChange) {
    return {
      currentState,
      nextState,
      hasChange,
      canSubmit: false,
      badgeVariant: 'neutral',
      impactKey: 'payments.incoming.review.state.no_change',
    };
  }

  if (nextState === 'processed') {
    return {
      currentState,
      nextState,
      hasChange,
      canSubmit: true,
      badgeVariant: hasAssignedUser ? 'ok' : 'warn',
      impactKey: hasAssignedUser
        ? 'payments.incoming.review.state.impact.processed'
        : 'payments.incoming.review.state.impact.processed_without_user',
      warningKey: hasAssignedUser ? undefined : 'payments.incoming.review.state.warning.processed_without_user',
    };
  }

  if (nextState === 'ignored') {
    return {
      currentState,
      nextState,
      hasChange,
      canSubmit: true,
      badgeVariant: 'warn',
      impactKey: 'payments.incoming.review.state.impact.ignored',
      warningKey: 'payments.incoming.review.state.warning.ignored',
    };
  }

  if (nextState === 'unmatched') {
    return {
      currentState,
      nextState,
      hasChange,
      canSubmit: true,
      badgeVariant: 'danger',
      impactKey: 'payments.incoming.review.state.impact.unmatched',
    };
  }

  if (nextState === 'queued') {
    return {
      currentState,
      nextState,
      hasChange,
      canSubmit: true,
      badgeVariant: 'warn',
      impactKey: 'payments.incoming.review.state.impact.queued',
    };
  }

  return {
    currentState,
    nextState,
    hasChange,
    canSubmit: false,
    badgeVariant: 'neutral',
    impactKey: 'payments.incoming.review.state.invalid',
  };
}
