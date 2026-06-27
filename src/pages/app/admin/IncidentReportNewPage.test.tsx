// i18n-ignore-file

import { describe, expect, test } from 'vitest';

import { toIsoOrUndefined } from './IncidentReportNewPage';

describe('IncidentReportNewPage date parsing', () => {
  test('does not throw for invalid datetime-local input', () => {
    expect(() => toIsoOrUndefined('not-a-date')).not.toThrow();
    expect(toIsoOrUndefined('not-a-date')).toBeUndefined();
  });

  test('returns an ISO string for valid datetime-local input', () => {
    expect(toIsoOrUndefined('2026-06-23T12:30')).toMatch(/^2026-06-23T/);
  });
});
