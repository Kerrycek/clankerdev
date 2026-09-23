import { describe, expect, it } from 'vitest';

import { buildEditUserPayload, type EditUserDraft } from './AdminUserOverviewModel';

function draft(overrides: Partial<EditUserDraft> = {}): EditUserDraft {
  return {
    fullName: 'Alice Example',
    email: 'alice@example.test',
    address: 'Example street',
    level: '1',
    info: 'Account note',
    mailerEnabled: true,
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
      full_name: '',
      email: '',
      address: '',
      level: 1,
      info: '',
      mailer_enabled: true,
    });
  });

  it('trims submitted text and rejects an invalid level', () => {
    expect(buildEditUserPayload(draft({ fullName: '  Alice Example  ', level: '21' }))).toMatchObject({
      full_name: 'Alice Example',
      level: 21,
    });
    expect(buildEditUserPayload(draft({ level: '-1' }))).toBeNull();
    expect(buildEditUserPayload(draft({ level: 'not-a-number' }))).toBeNull();
  });
});
