export type UsageSeverity = 'ok' | 'warn' | 'danger';

/**
 * Shared threshold semantics for usage bars / gauges.
 *
 * See: docs/spec/DATA_VISUALIZATION.md
 */
export function usageSeverityFromRatio(ratio: number): UsageSeverity {
  if (!Number.isFinite(ratio)) return 'ok';
  if (ratio >= 0.98) return 'danger';
  if (ratio >= 0.90) return 'warn';
  if (ratio >= 0.80) return 'warn';
  return 'ok';
}

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
