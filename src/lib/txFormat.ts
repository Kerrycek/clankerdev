/**
 * txFormat
 *
 * Shared helpers for transaction and chain UIs.
 *
 * We keep these in one place to avoid repeating subtly-different logic
 * (e.g. duration rounding, JSON formatting) across pages.
 */

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatPayload(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return safeJson(value);
}

export function durationSec(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const s = Math.max(0, (b - a) / 1000);
  return s;
}

function firstOwnValue(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== null && value !== undefined && value !== '') return value;
    }
  }
  return undefined;
}

function nestedValue(value: unknown, keys: string[]): unknown {
  if (!value || typeof value !== 'object') return undefined;
  return firstOwnValue(value as Record<string, unknown>, keys);
}

export function transactionErrorText(tx: unknown): string {
  if (!tx || typeof tx !== 'object') return '';

  const row = tx as Record<string, unknown>;
  const primaryKeys = ['error', 'errors', 'exception', 'message'];
  const fallbackKeys = ['stderr', 'backtrace'];
  const direct = firstOwnValue(row, primaryKeys);
  const fromOutput = nestedValue(row['output'], [...primaryKeys, ...fallbackKeys]);
  const fromDetails = nestedValue(row['details'], [...primaryKeys, ...fallbackKeys]);
  const fromResult = nestedValue(row['result'], [...primaryKeys, ...fallbackKeys]);
  const fallback = firstOwnValue(row, fallbackKeys);
  const value = direct ?? fromOutput ?? fromDetails ?? fromResult ?? fallback;

  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return safeJson(value);
}
