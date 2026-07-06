import { describe, expect, it } from 'vitest';

import { badgeForDevice, deviceLabel, looksLikeTotpCode, sortByIdDesc } from './UserTotpDevicesModel';

describe('UserTotpDevicesModel', () => {
  it('sorts devices by descending id without mutating input', () => {
    const input = [{ id: 1 }, { id: 3 }, { id: 2 }];
    expect(sortByIdDesc(input).map((d) => d.id)).toEqual([3, 2, 1]);
    expect(input.map((d) => d.id)).toEqual([1, 3, 2]);
  });

  it('maps device state to badge descriptors', () => {
    expect(badgeForDevice({ id: 1, confirmed: true, enabled: true })).toEqual({ label: 'active', variant: 'ok' });
    expect(badgeForDevice({ id: 2, confirmed: false, enabled: true })).toEqual({ label: 'unconfirmed', variant: 'warn' });
    expect(badgeForDevice({ id: 3, confirmed: true, enabled: false })).toEqual({ label: 'disabled', variant: 'neutral' });
  });

  it('validates six-digit TOTP codes and fallback labels', () => {
    expect(looksLikeTotpCode('123456')).toBe(true);
    expect(looksLikeTotpCode(' 123456 ')).toBe(true);
    expect(looksLikeTotpCode('12345')).toBe(false);
    expect(looksLikeTotpCode('abcdef')).toBe(false);
    expect(deviceLabel({ id: 9, label: 'Phone' })).toBe('Phone');
    expect(deviceLabel({ id: 9 })).toBe('#9');
  });
});
