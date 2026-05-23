/**
 * Small parsing helpers used across list filters and editors.
 *
 * These functions intentionally accept raw user/URL values (string-ish) and
 * return a typed value or `undefined` when the input is not valid.
 */

export function parseBoolParam(v: string | null | undefined): boolean | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return undefined;
  if (s === '1' || s === 'true' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'no') return false;
  return undefined;
}

/**
 * Parse a positive integer from user/URL input.
 *
 * - Only allows digits (no floats, no exponentials).
 * - Returns `undefined` for empty/invalid input.
 */
export function parsePositiveInt(v: string | null | undefined): number | undefined {
  const t = String(v ?? '').trim();
  if (!t) return undefined;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Parse a non-negative integer (0 allowed). */
export function parseNonNegativeInt(v: string | null | undefined): number | undefined {
  const t = String(v ?? '').trim();
  if (!t) return undefined;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
