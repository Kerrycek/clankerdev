import type { IncomeEstimateSelection } from '../../../lib/api/payments';

export const MAX_FORECAST_PERIODS = 6;
export const MAX_FORECAST_DURATION = 1_000;

export interface IncomeForecastFilters {
  year: number;
  month: number;
  select: IncomeEstimateSelection;
  duration: number;
}

export interface IncomeForecastPeriod {
  year: number;
  month: number;
  key: string;
  timestamp: number;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const integer = Math.trunc(parsed);
  return integer >= min && integer <= max ? integer : fallback;
}

export function defaultIncomeForecastFilters(
  now: Date = new Date(),
  billingTimeZone = 'UTC',
): IncomeForecastFilters {
  if (!Number.isFinite(now.getTime())) throw new RangeError('Income forecast requires a valid current date');

  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: billingTimeZone,
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(now);
  } catch {
    throw new RangeError('Income forecast requires a valid billing time zone');
  }

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new RangeError('Income forecast could not resolve the current billing month');
  }

  return {
    year,
    month,
    select: 'exactly_until',
    duration: 1,
  };
}

export function normalizeIncomeForecastFilters(
  input: Partial<Record<keyof IncomeForecastFilters, unknown>>,
  defaults: IncomeForecastFilters = defaultIncomeForecastFilters(),
): IncomeForecastFilters {
  const selection = input.select === 'all_until' || input.select === 'exactly_until'
    ? input.select
    : defaults.select;

  return {
    year: boundedInteger(input.year, defaults.year, 1970, 3_000),
    month: boundedInteger(input.month, defaults.month, 1, 12),
    select: selection,
    duration: boundedInteger(input.duration, defaults.duration, 1, MAX_FORECAST_DURATION),
  };
}

/**
 * Build selector tuples for repeated calculations against the current account
 * table. These are cohorts selected by paid_until fields, not historical
 * snapshots of what the estimate was in previous months.
 */
export function buildIncomeForecastPeriods(
  filters: Pick<IncomeForecastFilters, 'year' | 'month'>,
  count: number = MAX_FORECAST_PERIODS,
): IncomeForecastPeriod[] {
  const boundedCount = boundedInteger(count, MAX_FORECAST_PERIODS, 1, MAX_FORECAST_PERIODS);

  return Array.from({ length: boundedCount }, (_, offset) => {
    const date = new Date(Date.UTC(filters.year, filters.month - 1 - offset, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    return {
      year,
      month,
      key: `${year}-${String(month).padStart(2, '0')}`,
      timestamp: date.getTime() / 1_000,
    };
  });
}

export function formatIncomeForecastPeriod(period: Pick<IncomeForecastPeriod, 'year' | 'month'>, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(period.year, period.month - 1, 1)));
}

export function formatIncomeEstimate(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

export function incomeEstimateCohortDifference(current: number, adjacent: number | undefined): number | null {
  if (adjacent === undefined || !Number.isFinite(adjacent) || adjacent === 0) return null;
  return ((current - adjacent) / Math.abs(adjacent)) * 100;
}
