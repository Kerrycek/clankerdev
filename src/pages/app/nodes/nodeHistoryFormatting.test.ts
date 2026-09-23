import { describe, expect, it } from 'vitest';
import { formatNodeHistoryTime } from './nodeHistoryFormatting';

describe('node history timestamps', () => {
  it('uses the selected UI language and account time zone', () => {
    const date = '2026-09-20T23:00:00Z';
    expect(formatNodeHistoryTime(date, 'cs', 'Europe/Prague')).toBe('21. 9. 2026 1:00:00');
    expect(formatNodeHistoryTime(date, 'en', 'UTC')).toBe('20/09/2026, 23:00:00');
  });
  it('does not invent missing or malformed evidence dates', () => {
    expect(formatNodeHistoryTime(null, 'cs')).toBe('—');
    expect(formatNodeHistoryTime('unknown', 'en')).toBe('unknown');
    expect(() => formatNodeHistoryTime('2026-09-20T23:00:00Z', 'cs', 'invalid')).not.toThrow();
  });
});
