import { describe, expect, it } from 'vitest';

import { areEquivalentTimeZones, isValidTimeZone } from './timeZones';

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
});
