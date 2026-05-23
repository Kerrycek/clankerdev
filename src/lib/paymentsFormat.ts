export function safeInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return undefined;
}

export function formatMoneyLike(amount: number | undefined): string {
  if (amount === undefined) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amount);
}
