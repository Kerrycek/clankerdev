import { describe, expect, it } from 'vitest';

import { emptyRequestOverrides } from './RequestReviewModel';
import {
  changeResolvePayload,
  hasInvalidNumericResolveOverride,
  registrationResolvePayload,
} from './RequestResolveMutation';

const baseOptions = (): Parameters<typeof registrationResolvePayload>[1] => ({
  reason: undefined,
  overrides: emptyRequestOverrides(),
  touchedOverrides: new Set<keyof ReturnType<typeof emptyRequestOverrides>>(),
  approveCreateVps: true,
  approveActivate: true,
  approveNode: '',
});

describe('request resolve payloads', () => {
  it('does not send populated approve fields until the operator changes them', () => {
    const options = baseOptions();
    options.overrides.fullName = 'Current name';
    options.overrides.location = '7';

    expect(registrationResolvePayload('approve', options)).toEqual({
      action: 'approve',
      create_vps: true,
      activate: true,
    });
  });

  it('sends an intentionally cleared string override without leaking a hidden node', () => {
    const options = baseOptions();
    options.touchedOverrides = new Set(['note'] as const);
    options.overrides.note = '';
    options.approveCreateVps = false;
    options.approveNode = '9';

    expect(registrationResolvePayload('approve', options)).toEqual({
      action: 'approve',
      note: '',
      create_vps: false,
      activate: true,
    });
  });

  it('rejects an explicitly blank or malformed required numeric override', () => {
    const options = baseOptions();
    options.touchedOverrides = new Set(['location'] as const);

    expect(hasInvalidNumericResolveOverride('approve', options.overrides, options.touchedOverrides)).toBe(true);
    options.overrides.location = '2.5';
    expect(hasInvalidNumericResolveOverride('approve', options.overrides, options.touchedOverrides)).toBe(true);
    options.overrides.location = '12';
    expect(hasInvalidNumericResolveOverride('approve', options.overrides, options.touchedOverrides)).toBe(false);
  });

  it('requires all numeric registration values for a correction payload', () => {
    const options = baseOptions();
    expect(hasInvalidNumericResolveOverride('request_correction', options.overrides, options.touchedOverrides)).toBe(true);
    options.overrides.yearOfBirth = '1990';
    options.overrides.osTemplate = '5';
    options.overrides.location = '2';
    options.overrides.language = '1';
    expect(hasInvalidNumericResolveOverride('request_correction', options.overrides, options.touchedOverrides)).toBe(false);
  });

  it('serializes the complete correction form, including empty optional strings', () => {
    const options = baseOptions();
    options.reason = 'Please check it';
    options.overrides.login = ' alice ';
    options.overrides.yearOfBirth = '1990';
    options.overrides.osTemplate = '5';

    expect(registrationResolvePayload('request_correction', options)).toMatchObject({
      action: 'request_correction',
      reason: 'Please check it',
      login: 'alice',
      org_name: '',
      note: '',
      year_of_birth: 1990,
      os_template: 5,
      time_zone: '',
    });
  });

  it('distinguishes an intentional clear from an untouched change override', () => {
    const options = baseOptions();
    options.touchedOverrides = new Set(['email'] as const);

    expect(changeResolvePayload('approve', options)).toEqual({
      action: 'approve',
      email: '',
    });
  });
});
