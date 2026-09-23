import { describe, expect, it } from 'vitest';

import {
  badgeForDevice,
  deviceLabel,
  looksLikeTotpCode,
  safeTotpProvisioningUri,
  sortByIdDesc,
} from './UserTotpDevicesModel';

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

  it('allows only standard TOTP authenticator provisioning links', () => {
    expect(safeTotpProvisioningUri('otpauth://totp/alice?secret=ABC123')).toBe(
      'otpauth://totp/alice?secret=ABC123',
    );
    expect(safeTotpProvisioningUri('  OTPAUTH://totp/alice?secret=ABC123  ')).toBe(
      'OTPAUTH://totp/alice?secret=ABC123',
    );

    expect(safeTotpProvisioningUri('otpauth://hotp/alice?secret=ABC123')).toBeNull();
    expect(safeTotpProvisioningUri('https://example.test/setup?secret=ABC123')).toBeNull();
    expect(safeTotpProvisioningUri('javascript:alert(1)')).toBeNull();
    expect(safeTotpProvisioningUri('otpauth://totp@evil.example/alice?secret=ABC123')).toBeNull();
    expect(safeTotpProvisioningUri('otpauth://totp/alice?secret=ABC123#fragment')).toBeNull();
    expect(safeTotpProvisioningUri('otpauth://totp/alice?secret=ABC123\nhttps://evil.example')).toBeNull();
    expect(safeTotpProvisioningUri(undefined)).toBeNull();
  });
});
