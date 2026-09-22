import { describe, expect, it } from 'vitest';

import { buildEditUserPayload, editUserValidationError, makeEditDraft, type EditUserDraft } from './AdminUserOverviewModel';

function draft(overrides: Partial<EditUserDraft> = {}): EditUserDraft {
  return {
    login: 'alice',
    fullName: 'Alice Example',
    email: 'alice@example.test',
    address: 'Example street',
    level: '1',
    info: 'Account note',
    mailerEnabled: true,
    timeZone: 'Europe/Prague',
    ...overrides,
  };
}

describe('buildEditUserPayload', () => {
  it('keeps cleared optional text fields in the update payload', () => {
    expect(buildEditUserPayload(draft({
      fullName: '  ',
      email: '',
      address: '\n',
      info: '\t',
    }))).toEqual({
      login: 'alice',
      full_name: '',
      email: '',
      address: '',
      level: 1,
      info: '',
      mailer_enabled: true,
      time_zone: 'Europe/Prague',
    });
  });

  it('trims submitted text and rejects an invalid level', () => {
    expect(buildEditUserPayload(draft({ login: '  alice-renamed  ', fullName: '  Alice Example  ', level: '21' }))).toMatchObject({
      login: 'alice-renamed',
      full_name: 'Alice Example',
      level: 21,
    });
    expect(buildEditUserPayload(draft({ level: '-1' }))).toBeNull();
    expect(buildEditUserPayload(draft({ level: 'not-a-number' }))).toBeNull();
  });

  it('validates login and time zone and can restore the server default time zone', () => {
    expect(editUserValidationError(draft({ login: '  ' }))).toBe('login');
    expect(editUserValidationError(draft({ timeZone: 'not/a-time-zone' }))).toBe('time_zone');
    expect(buildEditUserPayload(draft({ timeZone: '' }))).toMatchObject({ time_zone: null });
  });

  it('initializes identity settings from the loaded user', () => {
    expect(makeEditDraft({ login: 'alice', level: 1, time_zone: 'UTC' })).toMatchObject({
      login: 'alice',
      timeZone: 'UTC',
    });
  });
});
