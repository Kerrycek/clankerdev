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
