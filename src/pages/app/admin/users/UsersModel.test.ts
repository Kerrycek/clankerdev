import { describe, expect, test } from 'vitest';

import {
  buildCreateUserPayload,
  canonicalUserSmartKey,
  initialCreateUserDraft,
  normalizeRole,
  parseBoolToken,
  resolveRoleValue,
} from './UsersModel';

describe('UsersModel', () => {
  test('normalizes role filters and smart keys', () => {
    expect(normalizeRole(' admin ')).toBe('admin');
    expect(normalizeRole('owner')).toBe('');
    expect(resolveRoleValue('adm')).toBe('admin');
    expect(resolveRoleValue('all')).toBe('');
    expect(resolveRoleValue('unknown')).toBeNull();

    expect(canonicalUserSmartKey('#')).toBe('id');
    expect(canonicalUserSmartKey('search')).toBe('q');
    expect(canonicalUserSmartKey('2fa')).toBe('mfa');
    expect(canonicalUserSmartKey('weird')).toBeNull();
  });

  test('parses boolean smart-filter tokens', () => {
    expect(parseBoolToken('true')).toBe(true);
    expect(parseBoolToken('enabled')).toBe(true);
    expect(parseBoolToken('0')).toBe(false);
    expect(parseBoolToken('off')).toBe(false);
    expect(parseBoolToken('any')).toBeUndefined();
    expect(parseBoolToken('maybe')).toBeNull();
  });

  test('builds legacy-compatible create-user payloads', () => {
    expect(buildCreateUserPayload(initialCreateUserDraft)).toEqual({
      ok: false,
      errorKey: 'admin.users.create.validation.login',
    });

    expect(
      buildCreateUserPayload({
        ...initialCreateUserDraft,
        login: 'new-member',
        password: 'secret1',
        password2: 'different',
      })
    ).toEqual({
      ok: false,
      errorKey: 'admin.users.create.validation.password_match',
    });

    const review = buildCreateUserPayload({
      ...initialCreateUserDraft,
      login: ' new-member ',
      password: 'secret1',
      password2: 'secret1',
      fullName: ' New Member ',
      email: ' member@example.test ',
      address: ' Main street ',
      level: '2',
      info: ' Admin note ',
      monthlyPayment: '300',
      mailerEnabled: false,
    });

    expect(review).toEqual({
      ok: true,
      payload: {
        login: 'new-member',
        password: 'secret1',
        full_name: 'New Member',
        email: 'member@example.test',
        address: 'Main street',
        level: 2,
        info: 'Admin note',
        monthly_payment: 300,
        mailer_enabled: false,
      },
    });
  });
});
