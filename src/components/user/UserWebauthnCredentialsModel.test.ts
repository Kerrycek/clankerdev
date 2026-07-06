import { describe, expect, it } from 'vitest';

import {
  buildWebauthnUpdatePayload,
  canStartWebauthnRegistration,
  isNamedDomError,
  isSecureWebauthnContext,
  parseWebauthnRegistrationBegin,
  sortWebauthnCredentialsByIdDesc,
  validateWebauthnLabel,
  webauthnCredentialBadge,
  webauthnCredentialLabel,
} from './UserWebauthnCredentialsModel';

describe('UserWebauthnCredentialsModel', () => {
  it('sorts credentials and builds stable display metadata', () => {
    const input = [{ id: 3, label: 'Key C', enabled: true }, { id: 1, enabled: false }, { id: 2, label: '  ' }];

    expect(sortWebauthnCredentialsByIdDesc(input).map((credential) => credential.id)).toEqual([3, 2, 1]);
    expect(input.map((credential) => credential.id)).toEqual([3, 1, 2]);
    expect(webauthnCredentialBadge(input[0]!)).toEqual({ variant: 'ok', label: 'enabled' });
    expect(webauthnCredentialBadge(input[1]!)).toEqual({ variant: 'neutral', label: 'disabled' });
    expect(webauthnCredentialLabel(input[0]!)).toBe('Key C');
    expect(webauthnCredentialLabel(input[2]!)).toBe('#2');
  });

  it('validates labels and edit payloads before API calls', () => {
    expect(validateWebauthnLabel('  Security key  ')).toEqual({ valid: true, label: 'Security key' });
    expect(validateWebauthnLabel('   ')).toEqual({ valid: false });
    expect(buildWebauthnUpdatePayload('  Platform key ', false)).toEqual({
      valid: true,
      label: 'Platform key',
      payload: { label: 'Platform key', enabled: false },
    });
    expect(buildWebauthnUpdatePayload('', true)).toEqual({ valid: false });
  });

  it('checks registration readiness without touching globals in tests', () => {
    expect(isSecureWebauthnContext({ isSecureContext: true })).toBe(true);
    expect(isSecureWebauthnContext({ isSecureContext: false })).toBe(false);
    expect(canStartWebauthnRegistration({ allowRegistration: true, supported: true, secureContext: true })).toBe(true);
    expect(canStartWebauthnRegistration({ allowRegistration: false, supported: true, secureContext: true })).toBe(false);
    expect(canStartWebauthnRegistration({ allowRegistration: true, supported: false, secureContext: true })).toBe(false);
    expect(canStartWebauthnRegistration({ allowRegistration: true, supported: true, secureContext: false })).toBe(false);
  });

  it('normalizes begin-registration responses and cancellation errors', () => {
    expect(
      parseWebauthnRegistrationBegin({
        challenge_token: ' token ',
        options: { challenge: 'abc' },
      }),
    ).toEqual({ challengeToken: 'token', optionsJson: { challenge: 'abc' } });
    expect(parseWebauthnRegistrationBegin({ challenge_token: '', options: {} })).toBeNull();
    expect(parseWebauthnRegistrationBegin({ challenge_token: 'token', options: null })).toBeNull();

    const cancelled = new DOMException('cancelled', 'NotAllowedError');
    expect(isNamedDomError(cancelled, 'NotAllowedError')).toBe(true);
    expect(isNamedDomError(cancelled, 'AbortError')).toBe(false);
    expect(isNamedDomError('NotAllowedError', 'NotAllowedError')).toBe(false);
  });
});
