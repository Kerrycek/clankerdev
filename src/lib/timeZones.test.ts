import { describe, expect, it } from 'vitest';

import { areEquivalentTimeZones, isValidTimeZone, timeZoneOptions } from './timeZones';

describe('timeZones', () => {
  it('validates IANA time zones', () => {
    expect(isValidTimeZone('Europe/Prague')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('not-a-zone')).toBe(false);
  });

  it('treats aliases and matching zones as equivalent', () => {
    expect(areEquivalentTimeZones('Europe/Prague', 'Europe/Bratislava')).toBe(true);
    expect(areEquivalentTimeZones('Europe/Prague', 'UTC')).toBe(false);
  });

  it('builds deduplicated options from valid contextual IANA zones', () => {
    const options = timeZoneOptions('America/New_York', 'Europe/Prague', 'not-a-zone');
    const values = options.map((option) => option.value);

    expect(values.slice(0, 3)).toEqual(['Europe/Prague', 'America/New_York', 'UTC']);
    expect(values).not.toContain('not-a-zone');
    expect(new Set(values).size).toBe(values.length);
    expect(values.every(isValidTimeZone)).toBe(true);
  });
});
