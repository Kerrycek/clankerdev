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
  requiresConfirmation: boolean;
  confirmationTarget?: string;
  confirmationMatches: boolean;
};

function normalizeConfirmation(value: string | undefined | null): string {
  return String(value ?? '').trim().toUpperCase();
}

function incomingPaymentStateConfirmationTarget(input: {
  nextState: KnownIncomingPaymentState | '';
  hasAssignedUser: boolean;
}): string | undefined {
  return undefined;
}

function confirmationFields(target: string | undefined, confirmationText: string | undefined | null) {
  const confirmationTarget = target;
  const requiresConfirmation = Boolean(confirmationTarget);
  const confirmationMatches = !confirmationTarget || normalizeConfirmation(confirmationText) === confirmationTarget;
  return { confirmationTarget, requiresConfirmation, confirmationMatches };
}

export function buildIncomingPaymentStateReview(input: {
  payment: IncomingPayment | null | undefined;
  nextState: IncomingPaymentState | '';
  confirmationText?: string;
}): IncomingPaymentStateReview {
  const currentState = normalizeIncomingPaymentState(input.payment?.state);
  const nextState = normalizeIncomingPaymentState(input.nextState) || currentState;
  const hasChange = Boolean(currentState && nextState && currentState !== nextState);
  const hasAssignedUser = Boolean(input.payment?.user);
  const confirmation = confirmationFields(
    incomingPaymentStateConfirmationTarget({ nextState, hasAssignedUser }),
    input.confirmationText
  );

  if (!input.payment) {
    return {
      currentState,
      nextState,
      hasChange: false,
      canSubmit: false,
      badgeVariant: 'neutral',
      impactKey: 'payments.incoming.review.state.no_payment',
      ...confirmation,
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
      ...confirmation,
    };
  }

  if (nextState === 'processed') {
    return {
      currentState,
      nextState,
      hasChange,
      canSubmit: confirmation.confirmationMatches,
      badgeVariant: hasAssignedUser ? 'ok' : 'warn',
      impactKey: hasAssignedUser
        ? 'payments.incoming.review.state.impact.processed'
        : 'payments.incoming.review.state.impact.processed_without_user',
      warningKey: hasAssignedUser ? undefined : 'payments.incoming.review.state.warning.processed_without_user',
      ...confirmation,
    };
  }

  if (nextState === 'ignored') {
    return {
      currentState,
      nextState,
      hasChange,
      canSubmit: confirmation.confirmationMatches,
      badgeVariant: 'warn',
      impactKey: 'payments.incoming.review.state.impact.ignored',
      warningKey: 'payments.incoming.review.state.warning.ignored',
      ...confirmation,
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
      ...confirmation,
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
      ...confirmation,
    };
  }

  return {
    currentState,
    nextState,
    hasChange,
    canSubmit: false,
    badgeVariant: 'neutral',
    impactKey: 'payments.incoming.review.state.invalid',
    ...confirmation,
  };
}

export type IncomingPaymentReconciliationSummary = {
  total: number;
  queued: number;
  unmatched: number;
  processed: number;
  ignored: number;
  unknown: number;
  assigned: number;
  unassigned: number;
  needsReview: number;
  processedWithoutUser: number;
};

export function buildIncomingPaymentsReconciliationSummary(rows: IncomingPayment[]): IncomingPaymentReconciliationSummary {
  const summary: IncomingPaymentReconciliationSummary = {
    total: rows.length,
    queued: 0,
    unmatched: 0,
    processed: 0,
    ignored: 0,
    unknown: 0,
    assigned: 0,
    unassigned: 0,
    needsReview: 0,
    processedWithoutUser: 0,
  };

  for (const row of rows) {
    const state = normalizeIncomingPaymentState(row.state);
    const assigned = Boolean(row.user);

    if (assigned) summary.assigned += 1;
    else summary.unassigned += 1;

    if (state === 'queued') summary.queued += 1;
    else if (state === 'unmatched') summary.unmatched += 1;
    else if (state === 'processed') summary.processed += 1;
    else if (state === 'ignored') summary.ignored += 1;
    else summary.unknown += 1;

    if (state === 'queued' || state === 'unmatched') summary.needsReview += 1;
    if (state === 'processed' && !assigned) summary.processedWithoutUser += 1;
  }

  return summary;
}

export type IncomingPaymentStateDescriptor = {
  state: KnownIncomingPaymentState | '';
  badgeVariant: 'neutral' | 'ok' | 'warn' | 'danger' | 'info';
  explanationKey: string;
  nextActionKey: string;
  warningKey?: string;
};

export function describeIncomingPaymentState(input: {
  state?: IncomingPaymentState | null;
  user?: ResourceRef | null;
}): IncomingPaymentStateDescriptor {
  const state = normalizeIncomingPaymentState(input.state);
  const hasAssignedUser = Boolean(input.user);

  if (state === 'queued') {
    return {
      state,
      badgeVariant: 'warn',
      explanationKey: 'payments.incoming.reconcile.state.queued.explanation',
      nextActionKey: 'payments.incoming.reconcile.state.queued.next',
    };
  }

  if (state === 'unmatched') {
    return {
      state,
      badgeVariant: 'danger',
      explanationKey: 'payments.incoming.reconcile.state.unmatched.explanation',
      nextActionKey: 'payments.incoming.reconcile.state.unmatched.next',
    };
  }

  if (state === 'processed') {
    return {
      state,
      badgeVariant: hasAssignedUser ? 'ok' : 'warn',
      explanationKey: hasAssignedUser
        ? 'payments.incoming.reconcile.state.processed.explanation'
        : 'payments.incoming.reconcile.state.processed_unassigned.explanation',
      nextActionKey: hasAssignedUser
        ? 'payments.incoming.reconcile.state.processed.next'
        : 'payments.incoming.reconcile.state.processed_unassigned.next',
      warningKey: hasAssignedUser ? undefined : 'payments.incoming.reconcile.state.processed_unassigned.warning',
    };
  }

  if (state === 'ignored') {
    return {
      state,
      badgeVariant: 'neutral',
      explanationKey: 'payments.incoming.reconcile.state.ignored.explanation',
      nextActionKey: 'payments.incoming.reconcile.state.ignored.next',
      warningKey: 'payments.incoming.reconcile.state.ignored.warning',
    };
  }

  return {
    state: '',
    badgeVariant: 'neutral',
    explanationKey: 'payments.incoming.reconcile.state.unknown.explanation',
    nextActionKey: 'payments.incoming.reconcile.state.unknown.next',
  };
}

export type IncomingPaymentReviewSearchTarget = {
  key: 'vs' | 'transaction' | 'account' | 'ident';
  value: string;
  labelKey: string;
};

function addSearchTarget(
  list: IncomingPaymentReviewSearchTarget[],
  seen: Set<string>,
  key: IncomingPaymentReviewSearchTarget['key'],
  value: unknown,
  labelKey: string
) {
  const text = String(value ?? '').trim();
  if (!text) return;
  const dedupeKey = `${key}:${text.toLowerCase()}`;
  if (seen.has(dedupeKey)) return;
  seen.add(dedupeKey);
  list.push({ key, value: text, labelKey });
}

export function buildIncomingPaymentReviewSearchTargets(payment: IncomingPayment): IncomingPaymentReviewSearchTarget[] {
  const seen = new Set<string>();
  const targets: IncomingPaymentReviewSearchTarget[] = [];

  addSearchTarget(targets, seen, 'vs', payment.vs, 'payments.incoming.reconcile.link.same_vs');
  addSearchTarget(targets, seen, 'transaction', payment.transaction_id, 'payments.incoming.reconcile.link.same_transaction');
  addSearchTarget(targets, seen, 'account', payment.account_name, 'payments.incoming.reconcile.link.same_account');
  addSearchTarget(targets, seen, 'ident', payment.user_ident, 'payments.incoming.reconcile.link.same_ident');

  return targets;
}
