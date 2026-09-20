import { describe, expect, it } from 'vitest';

import { compactText, formatDateInTimeZone, formatDateTimeInTimeZone } from './format';

describe('compactText', () => {
  it('keeps short values intact', () => {
    expect(compactText('vpsadmin')).toBe('vpsadmin');
  });

  it('shortens long technical values in the middle', () => {
    const text = '/system.slice/docker-27e26778a19d9c3d6c60d7bc75414347162074d25326604348b9abb4877da037.scope';

    expect(compactText(text, 32)).toBe('/system.slice/dock…77da037.scope');
  });

  it('uses an empty dash for missing values', () => {
    expect(compactText('')).toBe('—');
    expect(compactText(null)).toBe('—');
  });
});

describe('formatDateInTimeZone', () => {
  it('formats the calendar date in the explicit account time zone', () => {
    const value = '2026-02-01T00:00:00Z';
    const date = new Date(value);
    const prague = date.toLocaleDateString(undefined, { timeZone: 'Europe/Prague' });
    const losAngeles = date.toLocaleDateString(undefined, { timeZone: 'America/Los_Angeles' });

    expect(formatDateInTimeZone(value, 'Europe/Prague')).toBe(prague);
    expect(formatDateInTimeZone(value, 'America/Los_Angeles')).toBe(losAngeles);
    expect(prague).not.toBe(losAngeles);
  });

  it('preserves the existing empty and malformed fallbacks', () => {
    expect(formatDateInTimeZone(null, 'UTC')).toBe('—');
    expect(formatDateInTimeZone('2026-02-01-invalid', 'UTC')).toBe('2026-02-01');
    expect(formatDateInTimeZone('invalid', 'UTC')).toBe('invalid');
  });

  it('falls back safely when a direct caller provides an invalid zone', () => {
    const value = '2026-02-01T00:00:00Z';
    expect(formatDateInTimeZone(value, 'not-a-zone')).toBe(
      new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC' })
    );
  });
});

describe('formatDateTimeInTimeZone', () => {
  it('formats the same instant in the selected time zone', () => {
    const value = '2026-09-20T01:02:03.000Z';
    expect(formatDateTimeInTimeZone(value, 'Europe/Prague')).toBe(
      new Date(value).toLocaleString(undefined, { timeZone: 'Europe/Prague' }),
    );
    expect(formatDateTimeInTimeZone(value, 'America/Los_Angeles')).toBe(
      new Date(value).toLocaleString(undefined, { timeZone: 'America/Los_Angeles' }),
    );
  });

  it('keeps empty and invalid values safe and falls back to UTC', () => {
    const value = '2026-09-20T01:02:03.000Z';
    expect(formatDateTimeInTimeZone(null, 'UTC')).toBe('—');
    expect(formatDateTimeInTimeZone('invalid', 'UTC')).toBe('invalid');
    expect(formatDateTimeInTimeZone(value, 'not-a-zone')).toBe(
      new Date(value).toLocaleString(undefined, { timeZone: 'UTC' }),
    );
  });
});
