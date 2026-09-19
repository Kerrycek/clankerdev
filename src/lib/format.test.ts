import { describe, expect, it } from 'vitest';

import { compactText, formatDateInTimeZone } from './format';

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

    expect(formatDateInTimeZone(value, 'Europe/Prague')).toBe('2/1/2026');
    expect(formatDateInTimeZone(value, 'America/Los_Angeles')).toBe('1/31/2026');
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
