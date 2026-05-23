import type { TableRowVariant } from '../components/ui/TableRowLink';
import type { IncomingPaymentState } from './api/payments';
import type { BadgeVariant } from './requestsBadges';

export type PaidUntilStatus = 'paid' | 'due_soon' | 'overdue' | 'unknown';

export function incomingPaymentStateLabelKey(state: IncomingPaymentState | undefined | null): string {
  const s = String(state ?? '').trim();
  if (s === 'queued') return 'payments.incoming.state.queued';
  if (s === 'unmatched') return 'payments.incoming.state.unmatched';
  if (s === 'processed') return 'payments.incoming.state.processed';
  if (s === 'ignored') return 'payments.incoming.state.ignored';
  return 'state.unknown';
}

export function incomingPaymentBadgeVariant(state: IncomingPaymentState | undefined | null): BadgeVariant {
  const s = String(state ?? '').trim();
  if (s === 'processed') return 'ok';
  if (s === 'queued') return 'warn';
  if (s === 'unmatched') return 'danger';
  if (s === 'ignored') return 'neutral';
  return 'neutral';
}

export function incomingPaymentRowVariant(state: IncomingPaymentState | undefined | null): TableRowVariant | undefined {
  const s = String(state ?? '').trim();
  if (s === 'queued') return 'warn';
  if (s === 'unmatched') return 'danger';
  return undefined;
}

function rowSeverity(v: TableRowVariant | undefined): number {
  if (!v) return 0;
  if (v === 'danger') return 4;
  if (v === 'warn') return 3;
  if (v === 'info') return 2;
  if (v === 'ok') return 1;
  return 0; // muted/neutral
}

/**
 * Incoming payments triage surfaces need a “primary semantic” variant (for dots)
 * and a RowTone-Exception variant (for table rows).
 *
 * Account status (paid_until) should override when it indicates risk
 * (due soon / overdue), but only when the payment is already assigned to a user.
 */
export function incomingPaymentPrimaryVariant(
  opts: { state?: IncomingPaymentState | undefined | null; user?: unknown | null; user_paid_until?: unknown },
  now: Date = new Date()
): BadgeVariant {
  const base = incomingPaymentBadgeVariant(opts.state);

  if (!opts.user) return base;

  const st = getPaidUntilStatus(opts.user_paid_until, now).status;
  if (st === 'overdue') return 'danger';
  if (st === 'due_soon') return base === 'danger' ? 'danger' : 'warn';

  return base;
}

export function incomingPaymentRowVariantWithAccount(
  opts: { state?: IncomingPaymentState | undefined | null; user?: unknown | null; user_paid_until?: unknown },
  now: Date = new Date()
): TableRowVariant | undefined {
  const stateV = incomingPaymentRowVariant(opts.state);

  if (!opts.user) return stateV;

  const st = getPaidUntilStatus(opts.user_paid_until, now).status;
  const acctV: TableRowVariant | undefined = st === 'overdue' ? 'danger' : st === 'due_soon' ? 'warn' : undefined;

  return rowSeverity(acctV) > rowSeverity(stateV) ? acctV : stateV;
}


function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function daysUntil(d: Date, now: Date): number {
  const diffMs = d.getTime() - now.getTime();
  return Math.ceil(diffMs / 86_400_000);
}

/**
 * Status of a user's paid-until timestamp.
 *
 * Rules (v1):
 * - missing timestamp => overdue
 * - < 0 days => overdue
 * - < 7 days => due soon
 * - otherwise => paid
 */
export function getPaidUntilStatus(paidUntil: unknown, now: Date = new Date()): { status: PaidUntilStatus; days?: number } {
  if (paidUntil === null || paidUntil === undefined || paidUntil === '') return { status: 'overdue' };
  const d = parseDate(paidUntil);
  if (!d) return { status: 'unknown' };

  const days = daysUntil(d, now);
  if (days < 0) return { status: 'overdue', days };
  if (days < 7) return { status: 'due_soon', days };
  return { status: 'paid', days };
}

export function paidUntilBadgeVariant(status: PaidUntilStatus): BadgeVariant {
  if (status === 'paid') return 'ok';
  if (status === 'due_soon') return 'warn';
  if (status === 'overdue') return 'danger';
  return 'neutral';
}

export function paidUntilStatusLabelKey(status: PaidUntilStatus): string {
  if (status === 'paid') return 'payments.my.status.paid';
  if (status === 'due_soon') return 'payments.my.status.due_soon';
  if (status === 'overdue') return 'payments.my.status.overdue';
  return 'state.unknown';
}
