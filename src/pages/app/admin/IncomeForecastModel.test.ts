import { describe, expect, test } from 'vitest';

import {
  MAX_FORECAST_PERIODS,
  buildIncomeForecastPeriods,
  defaultIncomeForecastFilters,
  incomeEstimateCohortDifference,
  normalizeIncomeForecastFilters,
} from './IncomeForecastModel';

describe('IncomeForecastModel', () => {
  test('normalizes URL input without accepting invalid API values', () => {
    const defaults = defaultIncomeForecastFilters(new Date('2026-08-28T12:00:00Z'));

    expect(normalizeIncomeForecastFilters({
      year: '2027',
      month: '2',
      select: 'all_until',
      duration: '12',
    }, defaults)).toEqual({ year: 2027, month: 2, select: 'all_until', duration: 12 });

    expect(normalizeIncomeForecastFilters({
      year: 'nope',
      month: '13',
      select: 'internal-value',
      duration: '1001',
    }, defaults)).toEqual(defaults);
  });

  test('defaults to the current month in the server billing time zone', () => {
    const boundary = new Date('2026-09-30T22:30:00Z');

    expect(defaultIncomeForecastFilters(boundary, 'UTC')).toMatchObject({ year: 2026, month: 9 });
    expect(defaultIncomeForecastFilters(boundary, 'Europe/Prague')).toMatchObject({ year: 2026, month: 10 });
    expect(() => defaultIncomeForecastFilters(boundary, 'not-a-zone')).toThrow(/billing time zone/);
    expect(() => defaultIncomeForecastFilters(new Date('broken'), 'UTC')).toThrow(/current date/);
  });

  test('builds at most six newest-first cohort selectors across year boundaries', () => {
    expect(buildIncomeForecastPeriods({ year: 2026, month: 2 }, 3).map((period) => period.key)).toEqual([
      '2026-02',
      '2026-01',
      '2025-12',
    ]);

    expect(buildIncomeForecastPeriods({ year: 2026, month: 8 }, 99)).toHaveLength(MAX_FORECAST_PERIODS);
  });

  test('compares adjacent current cohorts only when the denominator is meaningful', () => {
    expect(incomeEstimateCohortDifference(150, 100)).toBe(50);
    expect(incomeEstimateCohortDifference(50, 100)).toBe(-50);
    expect(incomeEstimateCohortDifference(50, 0)).toBeNull();
    expect(incomeEstimateCohortDifference(50, undefined)).toBeNull();
  });
});
