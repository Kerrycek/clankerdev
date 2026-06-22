import { describe, expect, it } from 'vitest';

import type { ChangeRequest, RegistrationRequest } from '../../../lib/api/requests';
import {
  canonicalKey,
  mergeByIdDesc,
  parseTypeValue,
  requestKey,
  requestTypeFilterFromUrl,
  resolveStateValue,
  safeNumber,
  userLabel,
  visibleRequestRows,
} from './RequestsModel';

describe('RequestsModel', () => {
  it('normalizes numeric and enum-like filter inputs', () => {
    expect(safeNumber('42')).toBe(42);
    expect(safeNumber('0')).toBeUndefined();
    expect(requestTypeFilterFromUrl('registration')).toBe('registration');
    expect(requestTypeFilterFromUrl('bad')).toBe('all');
    expect(parseTypeValue('reg')).toBe('registration');
    expect(parseTypeValue('c')).toBe('change');
    expect(resolveStateValue('pend')).toBe('pending_correction');
    expect(canonicalKey('apiip')).toBe('api_ip');
  });

  it('labels user references safely', () => {
    expect(userLabel({ id: 5, login: 'alice' })).toBe('alice');
    expect(userLabel({ id: 5 })).toBe('#5');
    expect(userLabel(null)).toBe('—');
  });

  it('merges registrations and changes by descending id and hides closed rows by default', () => {
    const registrations: RegistrationRequest[] = [
      { id: 300, state: 'awaiting' },
      { id: 298, state: 'ignored' },
    ];
    const changes: ChangeRequest[] = [
      { id: 299, state: 'pending_correction' },
      { id: 297, state: 'approved' },
    ];

    const merged = mergeByIdDesc(registrations, changes, 10);
    expect(merged.map((row) => requestKey(row))).toEqual(['registration-300', 'change-299', 'registration-298', 'change-297']);
    expect(visibleRequestRows(merged, undefined).map((row) => requestKey(row))).toEqual(['registration-300', 'change-299']);
    expect(visibleRequestRows(merged, 'ignored').map((row) => requestKey(row))).toEqual(['registration-300', 'change-299', 'registration-298', 'change-297']);
  });
});
