import { describe, expect, test } from 'vitest';

import { adminDateTimeInputToIso, dateToAdminDateTimeInput, isoToAdminDateTimeInput } from './datetimeLocal';

describe('admin datetime helpers', () => {
  test('formats ISO values for admin lifecycle inputs', () => {
    const formatted = isoToAdminDateTimeInput('2026-07-09T12:34:56.000Z');

    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:00$/);
  });

  test('parses admin lifecycle timestamps with colons or dashes in time', () => {
    expect(adminDateTimeInputToIso('2026-07-09 12:34:56').valid).toBe(true);
    expect(adminDateTimeInputToIso('2026-07-09 12-34-56').valid).toBe(true);
    expect(adminDateTimeInputToIso('2026-07-09 12:34').valid).toBe(true);
    expect(adminDateTimeInputToIso('not a date').valid).toBe(false);
  });

  test('formats dates with seconds for admin inputs', () => {
    const value = dateToAdminDateTimeInput(new Date(2026, 6, 9, 12, 34, 56));

    expect(value).toBe('2026-07-09 12:34:56');
  });
});
