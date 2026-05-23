import { describe, expect, it } from 'vitest';

import { normalizeObjectRef, objectRefKey, parseObjectRefKey } from './objectRef';

describe('objectRef', () => {
  it('parses kind:id keys', () => {
    expect(parseObjectRefKey('Vps:123')).toEqual({ kind: 'Vps', id: 123 });
    expect(parseObjectRefKey('Dataset:1')).toEqual({ kind: 'Dataset', id: 1 });
  });

  it('rejects invalid keys', () => {
    expect(parseObjectRefKey('')).toBeNull();
    expect(parseObjectRefKey('Vps')).toBeNull();
    expect(parseObjectRefKey('Vps:')).toBeNull();
    expect(parseObjectRefKey('Vps:0')).toBeNull();
    expect(parseObjectRefKey('Vps:-1')).toBeNull();
    expect(parseObjectRefKey('Vps:1.5')).toBeNull();
    expect(parseObjectRefKey('Nope:1')).toBeNull();
  });

  it('normalizes refs from different shapes', () => {
    expect(normalizeObjectRef('Vps:5')).toEqual({ kind: 'Vps', id: 5 });
    expect(normalizeObjectRef({ kind: 'Vps', id: 5 })).toEqual({ kind: 'Vps', id: 5 });
    expect(normalizeObjectRef({ key: 'Dataset:10' })).toEqual({ kind: 'Dataset', id: 10 });
  });

  it('generates stable keys', () => {
    const ref = normalizeObjectRef({ kind: 'DnsZone', id: 9 });
    expect(ref).not.toBeNull();
    if (!ref) return;
    expect(objectRefKey(ref)).toBe('DnsZone:9');
  });
});
