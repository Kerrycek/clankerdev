import { describe, expect, it } from 'vitest';

import { objectKindFromConcernClassName, objectRefsFromConcerns } from './concernObjects';

describe('objectKindFromConcernClassName', () => {
  it('maps exact core class names', () => {
    expect(objectKindFromConcernClassName('Vps')).toBe('Vps');
    expect(objectKindFromConcernClassName('Dataset')).toBe('Dataset');
    expect(objectKindFromConcernClassName('DnsZone')).toBe('DnsZone');
    expect(objectKindFromConcernClassName('Node')).toBe('Node');
    expect(objectKindFromConcernClassName('MigrationPlan')).toBe('MigrationPlan');
    expect(objectKindFromConcernClassName('User')).toBe('User');
    expect(objectKindFromConcernClassName('IpAddress')).toBe('IpAddress');
  });

  it('maps namespaced Ruby classes', () => {
    expect(objectKindFromConcernClassName('VpsAdmin::Vps')).toBe('Vps');
    expect(objectKindFromConcernClassName('VpsAdmin::Dataset')).toBe('Dataset');
    expect(objectKindFromConcernClassName('Dns::Zone')).toBe('DnsZone');
    expect(objectKindFromConcernClassName('VpsAdmin::Node')).toBe('Node');
  });

  it('maps nested IpAddress class', () => {
    expect(objectKindFromConcernClassName('IpAddress::Base')).toBe('IpAddress');
  });

  it('does not map unrelated classes', () => {
    expect(objectKindFromConcernClassName('UserSession')).toBe(null);
    expect(objectKindFromConcernClassName('NetworkInterface')).toBe(null);
    expect(objectKindFromConcernClassName('')).toBe(null);
  });
});

describe('objectRefsFromConcerns', () => {
  it('extracts object refs from common concern shapes', () => {
    const refs = objectRefsFromConcerns([
      { class_name: 'Vps', row_id: 123 },
      { className: 'Dataset', rowId: 55 },
      ['DnsZone', 9],
      { class: 'IpAddress::Base', id: 777 },
      { class_name: 'UserSession', row_id: 1 }, // ignored
    ]);

    expect(refs).toEqual([
      { kind: 'Vps', id: 123 },
      { kind: 'Dataset', id: 55 },
      { kind: 'DnsZone', id: 9 },
      { kind: 'IpAddress', id: 777 },
    ]);
  });

  it('deduplicates and enforces max', () => {
    const refs = objectRefsFromConcerns(
      [
        { class_name: 'Vps', row_id: 1 },
        { class_name: 'Vps', row_id: 1 },
        { class_name: 'Vps', row_id: 2 },
        { class_name: 'Vps', row_id: 3 },
      ],
      { max: 2 }
    );

    expect(refs).toEqual([
      { kind: 'Vps', id: 1 },
      { kind: 'Vps', id: 2 },
    ]);
  });
});
