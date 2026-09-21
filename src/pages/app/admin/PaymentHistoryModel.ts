const AVERAGE_MONTH_MS = 2_629_800_000;

export function parsePaymentHistoryId(value: string | null | undefined): number | undefined {
  const normalized = String(value ?? '').trim().replace(/^#/, '');
  if (!/^\d+$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export function paymentHistoryMonths(fromDate: unknown, toDate: unknown): number | undefined {
  if (typeof fromDate !== 'string' || typeof toDate !== 'string') return undefined;
  const from = Date.parse(fromDate);
  const to = Date.parse(toDate);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return undefined;
  return Math.round((to - from) / AVERAGE_MONTH_MS);
}
