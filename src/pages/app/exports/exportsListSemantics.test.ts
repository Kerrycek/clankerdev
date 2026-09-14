import { describe, expect, test } from 'vitest';

import {
  canonicalExportSmartKey,
  normalizeExportListSearchParams,
  parseExportListUserId,
  UNSUPPORTED_EXPORT_LIST_URL_KEYS,
} from './exportsListSemantics';

describe('export list semantics', () => {
  test('normalizes fake and unauthorized filters before resetting pagination', () => {
    const current = new URLSearchParams(
      'q=needle&enabled=false&dataset=3&snapshot=4&host_ip_address=5&user=6&from_id=91&page=2&limit=25'
    );

    const normalized = normalizeExportListSearchParams(current, false);

    expect(normalized.changed).toBe(true);
    expect(normalized.searchParams.get('limit')).toBe('25');
    expect(normalized.searchParams.get('page')).toBe('1');
    expect(normalized.searchParams.get('from_id')).toBeNull();
    expect(normalized.searchParams.get('user')).toBeNull();
    for (const key of UNSUPPORTED_EXPORT_LIST_URL_KEYS) {
      expect(normalized.searchParams.get(key)).toBeNull();
    }
  });

  test('preserves the real admin user filter and stable pagination', () => {
    const current = new URLSearchParams('user=6&from_id=91&page=2&limit=25');
    const normalized = normalizeExportListSearchParams(current, true);

    expect(normalized.changed).toBe(false);
    expect(normalized.searchParams.toString()).toBe(current.toString());
  });

  test.each([
    ['user=abc&from_id=91&page=2&limit=25', null],
    ['user=0&from_id=91&page=2&limit=25', null],
    ['user=-1&from_id=91&page=2&limit=25', null],
    ['user=1.5&from_id=91&page=2&limit=25', null],
    ['user=9007199254740992&from_id=91&page=2&limit=25', null],
    ['user=%2342&from_id=91&page=2&limit=25', '42'],
    ['user=0042&from_id=91&page=2&limit=25', '42'],
    ['user=42&user=99&from_id=91&page=2&limit=25', '42'],
  ])('normalizes malformed or non-canonical admin owner URLs: %s', (query, expectedUser) => {
    const normalized = normalizeExportListSearchParams(new URLSearchParams(query), true);

    expect(normalized.changed).toBe(true);
    expect(normalized.searchParams.get('user')).toBe(expectedUser);
    expect(normalized.searchParams.getAll('user')).toEqual(expectedUser === null ? [] : [expectedUser]);
    expect(normalized.searchParams.get('from_id')).toBeNull();
    expect(normalized.searchParams.get('page')).toBe('1');
    expect(normalized.searchParams.get('limit')).toBe('25');
  });

  test('parses only unambiguous positive safe owner ids', () => {
    expect(parseExportListUserId('42')).toBe(42);
    expect(parseExportListUserId('#0042')).toBe(42);
    for (const value of ['', '0', '-1', '1.5', '1e2', 'abc', '9007199254740992']) {
      expect(parseExportListUserId(value)).toBeNull();
    }
  });

  test('classifies only id and user as supported smart keys', () => {
    expect(canonicalExportSmartKey('export')).toBe('id');
    expect(canonicalExportSmartKey('owner')).toBe('user');
    for (const key of ['q', 'search', 'enabled', 'dataset', 'snapshot', 'host']) {
      expect(canonicalExportSmartKey(key)).toBe('unsupported');
    }
    expect(canonicalExportSmartKey('mystery')).toBeNull();
  });
});
