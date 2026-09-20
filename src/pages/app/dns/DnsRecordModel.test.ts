import { describe, expect, it } from 'vitest';

import { HaveApiError } from '../../../lib/api/haveapi';
import type { DnsRecord } from '../../../lib/api/dns';
import {
  DNS_RECORD_TYPES,
  buildDnsRecordCreatePayload,
  buildDnsRecordUpdatePayload,
  defaultDnsRecordDraft,
  dnsRecordSupportsDynamicUpdate,
  dnsRecordSupportsPriority,
  dnsRecordUpdatePreview,
  draftFromRecord,
  validateDnsRecordDraft,
  validateExistingDnsRecord,
} from './DnsRecordModel';
import { parseDnsRecordFieldErrors } from './DnsRecordErrors';

function draft(overrides: Partial<ReturnType<typeof defaultDnsRecordDraft>> = {}) {
  return { ...defaultDnsRecordDraft(), ...overrides };
}

describe('DnsRecordModel', () => {
  it('leaves TTL empty for new records so the zone default is inherited', () => {
    expect(defaultDnsRecordDraft(600).ttl).toBe('');
    expect(buildDnsRecordCreatePayload(10, defaultDnsRecordDraft(600)).ttl).toBeUndefined();
  });

  it('clears an edited TTL override with an explicit null payload and preview', () => {
    const original: DnsRecord = {
      id: 1,
      name: 'www',
      type: 'A',
      content: '192.0.2.10',
      ttl: 3600,
      enabled: true,
    };
    const d = { ...draftFromRecord(original), ttl: '' };

    expect(buildDnsRecordUpdatePayload(d).ttl).toBeNull();
    expect(dnsRecordUpdatePreview(original, d)).toContainEqual({ field: 'ttl', before: 3600, after: null });
  });

  it('builds create and update payloads without changing backend field names', () => {
    const d = draft({
      name: ' www ',
      type: 'a',
      content: ' 192.0.2.10 ',
      ttl: '3600',
      priority: '',
      comment: ' production ',
      enabled: true,
      dynamicUpdateEnabled: false,
    });

    expect(buildDnsRecordCreatePayload(10, d)).toEqual({
      dns_zone: 10,
      name: 'www',
      type: 'A',
      content: ' 192.0.2.10 ',
      ttl: 3600,
      priority: undefined,
      comment: 'production',
      enabled: true,
      dynamic_update_enabled: false,
    });

    expect(buildDnsRecordUpdatePayload(d)).toEqual({
      content: ' 192.0.2.10 ',
      ttl: 3600,
      priority: undefined,
      comment: 'production',
      enabled: true,
      dynamic_update_enabled: false,
    });
  });

  it('validates type-specific content, TTL and priority before submit', () => {
    const badA = validateDnsRecordDraft(draft({ name: 'www', type: 'A', content: '999.2.3.4', ttl: '3.5' }), []);
    expect(badA.hasErrors).toBe(true);
    expect(badA.errors.map((issue) => issue.messageKey)).toContain('dns.zone.records.validation.content.ipv4');
    expect(badA.errors.map((issue) => issue.messageKey)).toContain('dns.zone.records.validation.ttl.integer');

    const mx = validateDnsRecordDraft(draft({ name: 'mail', type: 'MX', content: 'mail.example.test.' }), []);
    expect(mx.errors.map((issue) => issue.messageKey)).toContain('dns.zone.records.validation.priority.required');

    const okMx = validateDnsRecordDraft(draft({ name: 'mail', type: 'MX', content: 'mail.example.test.', priority: '10' }), []);
    expect(okMx.hasErrors).toBe(false);
  });

  it('matches the complete live API record type capability set', () => {
    expect(DNS_RECORD_TYPES).toEqual(['A', 'AAAA', 'CAA', 'CNAME', 'DS', 'MX', 'NS', 'PTR', 'SRV', 'SSHFP', 'TLSA', 'TXT']);
    expect(dnsRecordSupportsPriority('MX')).toBe(true);
    expect(dnsRecordSupportsPriority('TLSA')).toBe(false);
    expect(dnsRecordSupportsDynamicUpdate('AAAA')).toBe(true);
    expect(dnsRecordSupportsDynamicUpdate('SSHFP')).toBe(false);
  });

  it('validates DS, SSHFP and TLSA content like the live API', () => {
    const validCases = [
      draft({ name: 'child-sha1', type: 'DS', content: `60485 13 1 ${'A'.repeat(40)}` }),
      draft({ name: 'child', type: 'DS', content: `60485 13 2 ${'A'.repeat(64)}` }),
      draft({ name: 'child-sha384', type: 'DS', content: `60485 13 4 ${'A'.repeat(96)}` }),
      draft({ name: 'ssh-sha1', type: 'SSHFP', content: `4 1 ${'B'.repeat(40)}` }),
      draft({ name: 'ssh', type: 'SSHFP', content: `4 2 ${'B'.repeat(64)}` }),
      draft({ name: '_443._tcp.www', type: 'TLSA', content: `3 1 1 ${'C'.repeat(64)}` }),
      draft({ name: '_443._tcp.sha512', type: 'TLSA', content: `3 1 2 ${'C'.repeat(128)}` }),
      draft({ name: '_443._tcp.www', type: 'TLSA', content: '3 1 0 AABB' }),
    ];

    for (const candidate of validCases) {
      expect(validateDnsRecordDraft(candidate, []).hasErrors).toBe(false);
    }

    const invalidCases = [
      draft({ name: 'child', type: 'DS', content: `60485 13 2 ${'A'.repeat(63)}` }),
      draft({ name: 'child', type: 'DS', content: `60485 13 3 ${'A'.repeat(64)}` }),
      draft({ name: 'ssh', type: 'SSHFP', content: `4 2 ${'B'.repeat(63)}` }),
      draft({ name: 'ssh', type: 'SSHFP', content: `4 3 ${'B'.repeat(64)}` }),
      draft({ name: '_443._tcp.www', type: 'TLSA', content: `3 1 1 ${'C'.repeat(63)}` }),
      draft({ name: '_443._tcp.www', type: 'TLSA', content: '3 1 0 ABC' }),
      draft({ name: '_443._tcp.www', type: 'TLSA', content: `3 1 3 ${'C'.repeat(64)}` }),
      draft({ name: '_443._tcp.www', type: 'TLSA', content: `3 1 1 ${'C'.repeat(32)}\n${'C'.repeat(32)}` }),
    ];

    expect(invalidCases.map((candidate) => validateDnsRecordDraft(candidate, []).errors[0]?.messageKey)).toEqual([
      'dns.zone.records.validation.content.ds',
      'dns.zone.records.validation.content.ds',
      'dns.zone.records.validation.content.sshfp',
      'dns.zone.records.validation.content.sshfp',
      'dns.zone.records.validation.content.tlsa',
      'dns.zone.records.validation.content.tlsa',
      'dns.zone.records.validation.content.tlsa',
      'dns.zone.records.validation.content.tlsa',
    ]);
  });

  it('blocks apex DS records and incompatible priority or dynamic update settings', () => {
    const apexDs = validateDnsRecordDraft(
      draft({ name: '@', type: 'DS', content: `60485 13 2 ${'A'.repeat(64)}` }),
      []
    );
    expect(apexDs.errors.map((issue) => issue.messageKey)).toContain('dns.zone.records.validation.conflict.ds_apex');

    const incompatible = validateDnsRecordDraft(
      draft({ name: 'ssh', type: 'SSHFP', content: `4 2 ${'B'.repeat(64)}`, priority: '10', dynamicUpdateEnabled: true }),
      []
    );
    expect(incompatible.errors.map((issue) => issue.messageKey)).toEqual(
      expect.arrayContaining([
        'dns.zone.records.validation.priority.unsupported',
        'dns.zone.records.validation.dynamic.unsupported',
      ])
    );
  });

  it('never sends stale unsupported priority or dynamic-update values', () => {
    const d = draft({
      name: 'child',
      type: 'DS',
      content: `60485 13 2 ${'A'.repeat(64)}`,
      priority: '10',
      dynamicUpdateEnabled: true,
    });

    expect(buildDnsRecordCreatePayload(10, d)).toMatchObject({
      type: 'DS',
      priority: undefined,
      dynamic_update_enabled: false,
    });
    expect(buildDnsRecordUpdatePayload(d)).toMatchObject({
      priority: undefined,
      dynamic_update_enabled: false,
    });
  });

  it('enforces the inclusive live API TTL range', () => {
    const ttlIssues = (ttl: string) =>
      validateDnsRecordDraft(draft({ name: 'www', type: 'A', content: '192.0.2.10', ttl }), []).errors.filter(
        (issue) => issue.field === 'ttl'
      );

    expect(ttlIssues('59')[0]?.messageKey).toBe('dns.zone.records.validation.ttl.range');
    expect(ttlIssues('60')).toEqual([]);
    expect(ttlIssues('604800')).toEqual([]);
    expect(ttlIssues('604801')[0]?.messageKey).toBe('dns.zone.records.validation.ttl.range');
  });

  it('blocks CNAME conflicts in both directions', () => {
    const existing: DnsRecord[] = [
      { id: 1, name: 'www', type: 'A', content: '192.0.2.10' },
      { id: 2, name: 'alias', type: 'CNAME', content: 'www.example.test.' },
    ];

    const cnameOverA = validateDnsRecordDraft(draft({ name: 'www', type: 'CNAME', content: 'target.example.test.' }), existing);
    expect(cnameOverA.errors.map((issue) => issue.messageKey)).toContain('dns.zone.records.validation.conflict.cname_existing');

    const aOverCname = validateDnsRecordDraft(draft({ name: 'alias', type: 'A', content: '192.0.2.11' }), existing);
    expect(aOverCname.errors.map((issue) => issue.messageKey)).toContain('dns.zone.records.validation.conflict.cname_blocks');
  });

  it('builds edit previews from changed payload fields only', () => {
    const original: DnsRecord = {
      id: 1,
      name: 'www',
      type: 'A',
      content: '192.0.2.10',
      ttl: 3600,
      enabled: true,
      dynamic_update_enabled: false,
      comment: '',
    };

    const d = draftFromRecord(original);
    const preview = dnsRecordUpdatePreview(original, { ...d, content: '192.0.2.11', enabled: false });

    expect(preview).toEqual([
      { field: 'content', before: '192.0.2.10', after: '192.0.2.11' },
      { field: 'enabled', before: true, after: false },
    ]);
  });

  it('validates existing rows for row-level review badges', () => {
    const records: DnsRecord[] = [
      { id: 1, name: 'bad', type: 'A', content: 'not-an-ip' },
      { id: 2, name: 'mail', type: 'MX', content: 'mail.example.test.' },
    ];

    expect(validateExistingDnsRecord(records[0]!, records).errors.map((issue) => issue.field)).toContain('content');
    expect(validateExistingDnsRecord(records[1]!, records).errors.map((issue) => issue.field)).toContain('priority');
  });

  it('maps HaveAPI field errors back to DNS editor fields', () => {
    const err = new HaveApiError({
      status: false,
      message: 'Validation failed',
      errors: {
        dns_record: {
          content: ['is not a valid target'],
          ttl: { message: 'is too high' },
        },
      },
    });

    expect(parseDnsRecordFieldErrors(err)).toEqual([
      { field: 'content', rawKey: 'dns_record.content', messages: ['is not a valid target'] },
      { field: 'ttl', rawKey: 'dns_record.ttl', messages: ['is too high'] },
    ]);
  });
});
