import { describe, expect, it } from 'vitest';

import { HaveApiError } from '../../../lib/api/haveapi';
import type { DnsRecord } from '../../../lib/api/dns';
import {
  buildDnsRecordCreatePayload,
  buildDnsRecordUpdatePayload,
  defaultDnsRecordDraft,
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
