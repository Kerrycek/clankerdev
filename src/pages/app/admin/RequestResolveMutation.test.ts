import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchChangeRequest, fetchRegistrationRequest } from '../../../lib/api/requests';
import { emptyRequestOverrides } from './RequestReviewModel';
import {
  changeResolvePayload,
  fetchAwaitingReviewTarget,
  fetchReviewTarget,
  hasInvalidNumericResolveOverride,
  registrationResolvePayload,
} from './RequestResolveMutation';

vi.mock('../../../lib/api/requests', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../lib/api/requests')>(),
  fetchChangeRequest: vi.fn(),
  fetchRegistrationRequest: vi.fn(),
}));

const baseOptions = (): Parameters<typeof registrationResolvePayload>[1] => ({
  reason: undefined,
  overrides: emptyRequestOverrides(),
  touchedOverrides: new Set<keyof ReturnType<typeof emptyRequestOverrides>>(),
  approveCreateVps: true,
  approveActivate: true,
  approveNode: '',
});

describe('request resolve payloads', () => {
  beforeEach(() => vi.clearAllMocks());

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

  it('blocks an orphaned change during the last preflight without blocking a registration', async () => {
    vi.mocked(fetchChangeRequest).mockResolvedValue({
      data: { id: 42, state: 'awaiting', change_reason: 'Update profile', user: null, raw_user_id: 7 },
      meta: {},
    } as never);
    await expect(fetchAwaitingReviewTarget('change', 42)).rejects.toMatchObject({
      reason: 'owner_missing',
    });

    vi.mocked(fetchRegistrationRequest).mockResolvedValueOnce({
      data: { id: 43, state: 'awaiting', login: 'former-user', user: null, raw_user_id: 7 },
      meta: {},
    } as never);
    await expect(fetchAwaitingReviewTarget('registration', 43)).rejects.toMatchObject({
      reason: 'owner_missing',
    });
    vi.mocked(fetchRegistrationRequest).mockResolvedValue({
      data: { id: 43, state: 'awaiting', login: 'new-user', user: null },
      meta: {},
    } as never);
    await expect(fetchAwaitingReviewTarget('registration', 43)).resolves.toMatchObject({ id: 43 });
  });
  it('rechecks the state actually reviewed, including resolved registrations', async () => {
    vi.mocked(fetchRegistrationRequest).mockResolvedValue({
      data: { id: 43, state: 'ignored', login: 'new-user', user: null }, meta: {},
    } as never);
    await expect(fetchReviewTarget('registration', 43, 'ignored')).resolves.toMatchObject({ state: 'ignored' });
    await expect(fetchReviewTarget('registration', 43, 'denied')).rejects.toMatchObject({ reason: 'state_changed' });
    await expect(fetchAwaitingReviewTarget('registration', 43)).rejects.toMatchObject({ reason: 'state_changed' });
    vi.mocked(fetchRegistrationRequest).mockRejectedValue(new Error('API unavailable'));
    await expect(fetchReviewTarget('registration', 43, 'ignored')).rejects.toThrow('API unavailable');
  });

});
