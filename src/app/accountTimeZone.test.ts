import { describe, expect, it } from 'vitest';

import { resolveAccountTimeZone, resolveServerTimeZone } from './accountTimeZone';
import { SAFE_TIME_ZONE } from '../lib/timeZones';

describe('resolveAccountTimeZone', () => {
  it('prefers the signed-in account time zone over the server default', () => {
    expect(resolveAccountTimeZone('America/Los_Angeles', 'Europe/Prague')).toBe(
      'America/Los_Angeles'
    );
  });

  it('uses the server zone when the signed-in account has no preference', () => {
    expect(resolveAccountTimeZone(null, 'Europe/Prague')).toBe('Europe/Prague');
    expect(resolveAccountTimeZone('not-a-zone', 'Europe/Prague')).toBe('Europe/Prague');
  });

  it('ignores invalid configured values and returns a stable valid fallback', () => {
    expect(resolveAccountTimeZone('not-a-zone', 'also-not-a-zone')).toBe(SAFE_TIME_ZONE);
  });

  it('normalizes surrounding whitespace before validating a configured zone', () => {
    expect(resolveAccountTimeZone('  America/Los_Angeles  ', 'Europe/Prague')).toBe(
      'America/Los_Angeles'
    );
  });

  it('resolves the billing server zone without an account override', () => {
    expect(resolveServerTimeZone('  Europe/Prague  ')).toBe('Europe/Prague');
    expect(resolveServerTimeZone('not-a-zone')).toBe(SAFE_TIME_ZONE);
  });
});
