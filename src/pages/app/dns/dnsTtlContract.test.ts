import { describe, expect, it } from 'vitest';

import {
  DNS_TTL_MAX,
  DNS_TTL_MIN,
  DNS_ZONE_DEFAULT_TTL,
  parseOptionalDnsTtl,
  validateDnsTtl,
} from './dnsTtlContract';

describe('DNS TTL contract', () => {
  it('matches the active API limits and zone default', () => {
    expect(DNS_TTL_MIN).toBe(60);
    expect(DNS_TTL_MAX).toBe(604_800);
    expect(DNS_ZONE_DEFAULT_TTL).toBe(3600);
  });

  it('accepts an omitted record TTL and both inclusive limits', () => {
    expect(validateDnsTtl('')).toBeNull();
    expect(validateDnsTtl('  ')).toBeNull();
    expect(validateDnsTtl(String(DNS_TTL_MIN))).toBeNull();
    expect(validateDnsTtl(String(DNS_TTL_MAX))).toBeNull();
  });

  it('rejects non-integers and values outside the active API limits', () => {
    expect(validateDnsTtl('3.5')).toBe('integer');
    expect(validateDnsTtl('1e3')).toBe('integer');
    expect(validateDnsTtl(String(DNS_TTL_MIN - 1))).toBe('range');
    expect(validateDnsTtl(String(DNS_TTL_MAX + 1))).toBe('range');
  });

  it('requires a zone default TTL and parses an optional record override', () => {
    expect(validateDnsTtl('', { required: true })).toBe('required');
    expect(parseOptionalDnsTtl('')).toBeUndefined();
    expect(parseOptionalDnsTtl(' 3600 ')).toBe(3600);
  });
});
