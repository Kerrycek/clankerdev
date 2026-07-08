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

const PAYMENT_ALLOWED_TAGS = new Set([
  'a',
  'b',
  'br',
  'caption',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'small',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

const PAYMENT_DROP_WITH_CONTENT = new Set(['iframe', 'object', 'script', 'style', 'template']);

function isSafePaymentUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  if (value.startsWith('#') || value.startsWith('?') || value.startsWith('/')) return true;

  try {
    const url = new URL(value, 'https://example.invalid');
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function unwrapPaymentElement(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;

  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }

  parent.removeChild(el);
}

function sanitizePaymentElement(el: Element): void {
  const tag = el.tagName.toLowerCase();

  if (PAYMENT_DROP_WITH_CONTENT.has(tag)) {
    el.remove();
    return;
  }

  if (!PAYMENT_ALLOWED_TAGS.has(tag)) {
    unwrapPaymentElement(el);
    return;
  }

  const rawHref = el.getAttribute('href') ?? '';
  const rawTarget = el.getAttribute('target') ?? '';
  const rawSrc = el.getAttribute('src') ?? '';
  const rawAlt = el.getAttribute('alt') ?? '';
  const rawColspan = el.getAttribute('colspan') ?? '';
  const rawRowspan = el.getAttribute('rowspan') ?? '';

  for (const attr of Array.from(el.attributes)) {
    el.removeAttribute(attr.name);
  }

  if (tag === 'a' && isSafePaymentUrl(rawHref)) {
    el.setAttribute('href', rawHref.trim());
    el.setAttribute('rel', 'noopener noreferrer');
    if (rawTarget === '_blank') el.setAttribute('target', '_blank');
  }

  if (tag === 'img' && isSafePaymentUrl(rawSrc)) {
    el.setAttribute('src', rawSrc.trim());
    if (rawAlt.trim()) el.setAttribute('alt', rawAlt.trim());
    el.setAttribute('loading', 'lazy');
  }

  if ((tag === 'td' || tag === 'th') && /^\d{1,2}$/.test(rawColspan.trim())) {
    el.setAttribute('colspan', rawColspan.trim());
  }

  if ((tag === 'td' || tag === 'th') && /^\d{1,2}$/.test(rawRowspan.trim())) {
    el.setAttribute('rowspan', rawRowspan.trim());
  }
}

export function sanitizePaymentInstructionsHtml(rawHtml: string): string {
  const raw = String(rawHtml ?? '');
  if (!raw.trim()) return '';

  if (typeof document === 'undefined') {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const template = document.createElement('template');
  template.innerHTML = raw;

  for (const node of Array.from(template.content.querySelectorAll('*'))) {
    sanitizePaymentElement(node);
  }

  for (const node of Array.from(template.content.childNodes)) {
    if (node.nodeType === Node.COMMENT_NODE) node.remove();
  }

  return template.innerHTML;
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
