import type { DnsRecord } from '../../../lib/api/dns';
import {
  DNS_TTL_MAX,
  DNS_TTL_MIN,
  parseOptionalDnsTtl,
  validateDnsTtl,
} from './dnsTtlContract';

export const DNS_RECORD_TYPES = ['A', 'AAAA', 'CAA', 'CNAME', 'DS', 'MX', 'NS', 'PTR', 'SRV', 'SSHFP', 'TLSA', 'TXT'] as const;

export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export type DnsRecordFormField =
  | 'name'
  | 'type'
  | 'content'
  | 'ttl'
  | 'priority'
  | 'comment'
  | 'enabled'
  | 'dynamic_update_enabled'
  | 'conflict'
  | 'record';

export interface DnsRecordDraft {
  name: string;
  type: string;
  content: string;
  ttl: string;
  priority: string;
  comment: string;
  enabled: boolean;
  dynamicUpdateEnabled: boolean;
}

export interface DnsRecordValidationIssue {
  field: DnsRecordFormField;
  severity: 'error' | 'warning';
  messageKey: string;
  vars?: Record<string, string | number | boolean>;
}

export interface DnsRecordValidationResult {
  issues: DnsRecordValidationIssue[];
  errors: DnsRecordValidationIssue[];
  warnings: DnsRecordValidationIssue[];
  hasErrors: boolean;
}

export interface DnsRecordPreviewItem {
  field: Exclude<DnsRecordFormField, 'conflict' | 'record'>;
  before?: string | number | boolean | null;
  after?: string | number | boolean | null;
}

export type DnsRecordCreatePayload = {
  dns_zone: number;
  name: string;
  type: string;
  content: string;
  ttl?: number;
  priority?: number;
  comment?: string;
  enabled: boolean;
  dynamic_update_enabled: boolean;
};

export type DnsRecordUpdatePayload = {
  content: string;
  ttl?: number | null;
  priority?: number;
  comment?: string;
  enabled: boolean;
  dynamic_update_enabled: boolean;
};



type DnsRecordCompat = DnsRecord & { dynamic?: boolean };

const PRIORITY_RECORD_TYPES = new Set<string>(['MX', 'SRV']);
const DYNAMIC_UPDATE_RECORD_TYPES = new Set<string>(['A', 'AAAA']);
const HOST_TARGET_TYPES = new Set<string>(['CNAME', 'MX', 'NS', 'PTR']);
const PRIORITY_MAX = 65_535;
const DS_DIGEST_LENGTHS: Readonly<Record<string, number>> = { '1': 40, '2': 64, '4': 96 };
const SSHFP_FINGERPRINT_LENGTHS: Readonly<Record<string, number>> = { '1': 40, '2': 64 };
const TLSA_ASSOCIATION_DATA_LENGTHS: Readonly<Record<string, number | undefined>> = {
  '0': undefined,
  '1': 64,
  '2': 128,
};

export function defaultDnsRecordDraft(defaultTtl?: number | null): DnsRecordDraft {
  void defaultTtl;
  return {
    name: '',
    type: 'A',
    content: '',
    ttl: '',
    priority: '',
    comment: '',
    enabled: true,
    dynamicUpdateEnabled: false,
  };
}

export function draftFromRecord(record: DnsRecord): DnsRecordDraft {
  return {
    name: recordName(record),
    type: String(record.type ?? 'A'),
    content: String(record.content ?? ''),
    ttl: record.ttl != null ? String(record.ttl) : '',
    priority: record.priority != null ? String(record.priority) : '',
    comment: String(record.comment ?? ''),
    enabled: record.enabled !== false,
    dynamicUpdateEnabled: recordDynamicEnabled(record),
  };
}

export function recordName(record: DnsRecord): string {
  return String(record.name ?? '');
}

export function recordDynamicEnabled(record: DnsRecord): boolean {
  const compat = record as DnsRecordCompat;
  if (compat.dynamic_update_enabled !== undefined) return compat.dynamic_update_enabled === true;
  return compat.dynamic === true;
}

export function dnsZoneLabel(zone: { id: number; name?: string; label?: string }): string {
  return String(zone.name ?? zone.label ?? `Zone #${zone.id}`);
}

export function isDnsRecordType(value: string): value is DnsRecordType {
  return DNS_RECORD_TYPES.includes(value.toUpperCase() as DnsRecordType);
}

export function dnsRecordSupportsPriority(value: string): boolean {
  return PRIORITY_RECORD_TYPES.has(value.toUpperCase());
}

export function dnsRecordSupportsDynamicUpdate(value: string): boolean {
  return DYNAMIC_UPDATE_RECORD_TYPES.has(value.toUpperCase());
}

export function dnsRecordContentPlaceholder(value: string): string {
  switch (value.toUpperCase()) {
    case 'A':
      return '192.0.2.10';
    case 'AAAA':
      return '2001:db8::10';
    case 'CAA':
      return '0 issue "letsencrypt.org"';
    case 'CNAME':
      return 'target.example.com.';
    case 'DS':
      return '60485 13 2 <SHA-256 digest>';
    case 'MX':
      return 'mail.example.com.';
    case 'NS':
      return 'ns1.example.com.';
    case 'PTR':
      return 'target.example.com.';
    case 'SRV':
      return '5 5060 sip.example.com.';
    case 'SSHFP':
      return '4 2 <SHA-256 fingerprint>';
    case 'TLSA':
      return '3 1 1 <SHA-256 association data>';
    case 'TXT':
      return 'verification=value';
    default:
      return '';
  }
}

function parseOptionalInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return Number(trimmed);
}

function isWholeNumberText(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function normalizedRecordName(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === '@') return '@';
  return trimmed.replace(/\.$/, '');
}

function sameRecordName(a: string | undefined, b: string): boolean {
  return normalizedRecordName(String(a ?? '')) === normalizedRecordName(b);
}

function isValidRecordName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length > 253) return false;
  if (/\s/.test(trimmed)) return false;
  if (trimmed.includes('..')) return false;
  if (trimmed === '@') return true;

  const withoutWildcard = trimmed.startsWith('*.') ? trimmed.slice(2) : trimmed;
  const labels = withoutWildcard.replace(/\.$/, '').split('.');
  return labels.every((label) => {
    if (!label || label.length > 63) return false;
    if (!/^[A-Za-z0-9_-]+$/.test(label)) return false;
    return !label.startsWith('-') && !label.endsWith('-');
  });
}

function isValidDomainTarget(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 253) return false;
  if (/\s/.test(trimmed)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return false;
  if (trimmed === '@') return true;

  const labels = trimmed.replace(/\.$/, '').split('.');
  return labels.every((label) => {
    if (!label || label.length > 63) return false;
    if (!/^[A-Za-z0-9_-]+$/.test(label)) return false;
    return !label.startsWith('-') && !label.endsWith('-');
  });
}

function isValidIpv4(value: string): boolean {
  const parts = value.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function isValidH16(value: string): boolean {
  return /^[0-9A-Fa-f]{1,4}$/.test(value);
}

function isValidIpv6(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.includes(':')) return false;
  if (!/^[0-9A-Fa-f:.]+$/.test(trimmed)) return false;
  const doubleColonCount = (trimmed.match(/::/g) ?? []).length;
  if (doubleColonCount > 1) return false;

  const validateParts = (parts: string[]) => parts.every((part, index) => {
    if (!part) return false;
    if (part.includes('.')) return index === parts.length - 1 && isValidIpv4(part);
    return isValidH16(part);
  });

  if (doubleColonCount === 0) {
    const parts = trimmed.split(':');
    return parts.length === 8 && validateParts(parts);
  }

  const [left = '', right = ''] = trimmed.split('::');
  const leftParts = left ? left.split(':') : [];
  const rightParts = right ? right.split(':') : [];
  if (!validateParts(leftParts) || !validateParts(rightParts)) return false;
  return leftParts.length + rightParts.length < 8;
}

function isValidCaaContent(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 3) return false;
  const flag = Number(parts[0]);
  if (!Number.isInteger(flag) || flag < 0 || flag > 255) return false;
  return /^[A-Za-z][A-Za-z0-9_-]*$/.test(parts[1] ?? '') && parts.slice(2).join(' ').trim().length > 0;
}

function exactComponents(value: string, count: number): string[] | null {
  if (/[\r\n]/.test(value)) return null;
  const components = value.trim().split(/\s+/);
  return components.length === count ? components : null;
}

function isHex(value: string, length: number): boolean {
  return value.length === length && /^[a-fA-F0-9]+$/.test(value);
}

function isValidDsContent(value: string): boolean {
  const components = exactComponents(value, 4);
  if (!components) return false;
  const [keyTag = '', algorithm = '', digestType = '', digest = ''] = components;
  const digestLength = Object.prototype.hasOwnProperty.call(DS_DIGEST_LENGTHS, digestType)
    ? DS_DIGEST_LENGTHS[digestType]
    : undefined;
  return /^\d+$/.test(keyTag) && /^\d+$/.test(algorithm) && digestLength !== undefined && isHex(digest, digestLength);
}

function isValidSshfpContent(value: string): boolean {
  const components = exactComponents(value, 3);
  if (!components) return false;
  const [algorithm = '', fingerprintType = '', fingerprint = ''] = components;
  const fingerprintLength = Object.prototype.hasOwnProperty.call(SSHFP_FINGERPRINT_LENGTHS, fingerprintType)
    ? SSHFP_FINGERPRINT_LENGTHS[fingerprintType]
    : undefined;
  return /^\d+$/.test(algorithm) && fingerprintLength !== undefined && isHex(fingerprint, fingerprintLength);
}

function isValidTlsaContent(value: string): boolean {
  const components = exactComponents(value, 4);
  if (!components) return false;
  const [usage = '', selector = '', matchingType = '', associationData = ''] = components;
  if (
    !/^\d+$/.test(usage) ||
    !/^\d+$/.test(selector) ||
    !Object.prototype.hasOwnProperty.call(TLSA_ASSOCIATION_DATA_LENGTHS, matchingType)
  ) {
    return false;
  }

  const expectedLength = TLSA_ASSOCIATION_DATA_LENGTHS[matchingType];
  if (expectedLength !== undefined) return isHex(associationData, expectedLength);
  return /^(?:[a-fA-F0-9]{2})+$/.test(associationData);
}

function srvContentLooksComplete(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 3) return false;
  const weight = Number(parts[0]);
  const port = Number(parts[1]);
  return (
    Number.isInteger(weight) &&
    weight >= 0 &&
    weight <= PRIORITY_MAX &&
    Number.isInteger(port) &&
    port >= 0 &&
    port <= PRIORITY_MAX &&
    isValidDomainTarget(parts.slice(2).join(' '))
  );
}

function pushIssue(
  issues: DnsRecordValidationIssue[],
  field: DnsRecordFormField,
  severity: 'error' | 'warning',
  messageKey: string,
  vars?: Record<string, string | number | boolean>
) {
  issues.push({ field, severity, messageKey, vars });
}

function validateOptionalNumber(
  issues: DnsRecordValidationIssue[],
  field: 'ttl' | 'priority',
  value: string,
  opts: { required?: boolean; max: number; messagePrefix: string }
) {
  const trimmed = value.trim();
  if (!trimmed) {
    if (opts.required) pushIssue(issues, field, 'error', `${opts.messagePrefix}.required`);
    return;
  }

  if (!isWholeNumberText(trimmed)) {
    pushIssue(issues, field, 'error', `${opts.messagePrefix}.integer`);
    return;
  }

  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0 || n > opts.max) {
    pushIssue(issues, field, 'error', `${opts.messagePrefix}.range`, { max: opts.max });
  }
}

export function validateDnsRecordDraft(
  draft: DnsRecordDraft,
  records: readonly DnsRecord[],
  opts?: { editingRecordId?: number }
): DnsRecordValidationResult {
  const issues: DnsRecordValidationIssue[] = [];
  const type = draft.type.toUpperCase();
  const name = draft.name.trim();
  const content = draft.content.trim();

  if (!name) pushIssue(issues, 'name', 'error', 'dns.zone.records.validation.name.required');
  else if (!isValidRecordName(name)) pushIssue(issues, 'name', 'error', 'dns.zone.records.validation.name.invalid');
  else if (name.endsWith('.')) pushIssue(issues, 'name', 'warning', 'dns.zone.records.validation.name.trailing_dot');

  if (!isDnsRecordType(type)) pushIssue(issues, 'type', 'error', 'dns.zone.records.validation.type.unsupported', { type });

  if (!content) pushIssue(issues, 'content', 'error', 'dns.zone.records.validation.content.required');
  else if (type === 'A' && !isValidIpv4(content)) pushIssue(issues, 'content', 'error', 'dns.zone.records.validation.content.ipv4');
  else if (type === 'AAAA' && !isValidIpv6(content)) pushIssue(issues, 'content', 'error', 'dns.zone.records.validation.content.ipv6');
  else if (HOST_TARGET_TYPES.has(type) && !isValidDomainTarget(content)) {
    pushIssue(issues, 'content', 'error', 'dns.zone.records.validation.content.target');
  } else if (type === 'TXT' && content.length > 255) {
    pushIssue(issues, 'content', 'warning', 'dns.zone.records.validation.content.txt_length');
  } else if (type === 'SRV') {
    if (srvContentLooksComplete(content)) {
      // Complete SRV content: weight port target.
    } else if (isValidDomainTarget(content)) {
      pushIssue(issues, 'content', 'warning', 'dns.zone.records.validation.content.srv_hint');
    } else {
      pushIssue(issues, 'content', 'error', 'dns.zone.records.validation.content.srv');
    }
  } else if (type === 'CAA' && !isValidCaaContent(content)) {
    pushIssue(issues, 'content', 'error', 'dns.zone.records.validation.content.caa');
  } else if (type === 'DS' && !isValidDsContent(content)) {
    pushIssue(issues, 'content', 'error', 'dns.zone.records.validation.content.ds');
  } else if (type === 'SSHFP' && !isValidSshfpContent(content)) {
    pushIssue(issues, 'content', 'error', 'dns.zone.records.validation.content.sshfp');
  } else if (type === 'TLSA' && !isValidTlsaContent(content)) {
    pushIssue(issues, 'content', 'error', 'dns.zone.records.validation.content.tlsa');
  }

  const ttlValidation = validateDnsTtl(draft.ttl);
  if (ttlValidation) {
    pushIssue(issues, 'ttl', 'error', `dns.zone.records.validation.ttl.${ttlValidation}`, {
      min: DNS_TTL_MIN,
      max: DNS_TTL_MAX,
    });
  }
  if (dnsRecordSupportsPriority(type)) {
    validateOptionalNumber(issues, 'priority', draft.priority, {
      required: true,
      max: PRIORITY_MAX,
      messagePrefix: 'dns.zone.records.validation.priority',
    });
  } else if (draft.priority.trim()) {
    pushIssue(issues, 'priority', 'error', 'dns.zone.records.validation.priority.unsupported');
  }

  if (draft.dynamicUpdateEnabled && !dnsRecordSupportsDynamicUpdate(type)) {
    pushIssue(issues, 'dynamic_update_enabled', 'error', 'dns.zone.records.validation.dynamic.unsupported');
  }

  const otherRecords = records.filter((record) => record.id !== opts?.editingRecordId && sameRecordName(record.name, name));
  const otherCname = otherRecords.find((record) => String(record.type ?? '').toUpperCase() === 'CNAME');

  if (name && type === 'CNAME' && otherRecords.length > 0) {
    pushIssue(issues, 'conflict', 'error', 'dns.zone.records.validation.conflict.cname_existing', {
      count: otherRecords.length,
      name,
    });
  } else if (name && type !== 'CNAME' && otherCname) {
    pushIssue(issues, 'conflict', 'error', 'dns.zone.records.validation.conflict.cname_blocks', { name });
  }

  if (name && type === 'CNAME' && normalizedRecordName(name) === '@') {
    pushIssue(issues, 'conflict', 'warning', 'dns.zone.records.validation.conflict.cname_apex');
  }

  if (name && type === 'DS' && normalizedRecordName(name) === '@') {
    pushIssue(issues, 'name', 'error', 'dns.zone.records.validation.conflict.ds_apex');
  }

  const duplicate = otherRecords.find((record) => {
    return String(record.type ?? '').toUpperCase() === type && String(record.content ?? '').trim() === content;
  });
  if (duplicate) pushIssue(issues, 'record', 'warning', 'dns.zone.records.validation.conflict.duplicate');

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  return { issues, errors, warnings, hasErrors: errors.length > 0 };
}

export function validateExistingDnsRecord(record: DnsRecord, records: readonly DnsRecord[]): DnsRecordValidationResult {
  return validateDnsRecordDraft(draftFromRecord(record), records, { editingRecordId: record.id });
}

export function buildDnsRecordCreatePayload(zoneId: number, draft: DnsRecordDraft): DnsRecordCreatePayload {
  const type = draft.type.toUpperCase();
  return {
    dns_zone: zoneId,
    name: draft.name.trim(),
    type,
    content: draft.content,
    ttl: parseOptionalDnsTtl(draft.ttl),
    priority: dnsRecordSupportsPriority(type) ? parseOptionalInteger(draft.priority) : undefined,
    comment: draft.comment.trim() || undefined,
    enabled: draft.enabled,
    dynamic_update_enabled: dnsRecordSupportsDynamicUpdate(type) ? draft.dynamicUpdateEnabled : false,
  };
}

export function buildDnsRecordUpdatePayload(draft: DnsRecordDraft): DnsRecordUpdatePayload {
  const type = draft.type.toUpperCase();
  return {
    content: draft.content,
    // The active API distinguishes an omitted TTL (leave the existing value)
    // from null (clear the override and inherit the zone default). The editor
    // always represents the complete value, so an empty field must send null.
    ttl: parseOptionalDnsTtl(draft.ttl) ?? null,
    priority: dnsRecordSupportsPriority(type) ? parseOptionalInteger(draft.priority) : undefined,
    comment: draft.comment.trim() || undefined,
    enabled: draft.enabled,
    dynamic_update_enabled: dnsRecordSupportsDynamicUpdate(type) ? draft.dynamicUpdateEnabled : false,
  };
}

function optionalNumberPreview(value: string): number | null {
  const parsed = parseOptionalInteger(value);
  return parsed === undefined ? null : parsed;
}

function normalizedComment(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function samePreviewValue(a: string | number | boolean | null | undefined, b: string | number | boolean | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

export function dnsRecordCreatePreview(draft: DnsRecordDraft): DnsRecordPreviewItem[] {
  return [
    { field: 'name', after: draft.name.trim() },
    { field: 'type', after: draft.type.toUpperCase() },
    { field: 'content', after: draft.content },
    { field: 'ttl', after: optionalNumberPreview(draft.ttl) },
    { field: 'priority', after: optionalNumberPreview(draft.priority) },
    { field: 'comment', after: normalizedComment(draft.comment) },
    { field: 'enabled', after: draft.enabled },
    { field: 'dynamic_update_enabled', after: draft.dynamicUpdateEnabled },
  ];
}

export function dnsRecordUpdatePreview(original: DnsRecord, draft: DnsRecordDraft): DnsRecordPreviewItem[] {
  const candidates: DnsRecordPreviewItem[] = [
    { field: 'content', before: String(original.content ?? ''), after: draft.content },
    { field: 'ttl', before: original.ttl ?? null, after: optionalNumberPreview(draft.ttl) },
    { field: 'priority', before: original.priority ?? null, after: optionalNumberPreview(draft.priority) ?? original.priority ?? null },
    { field: 'comment', before: normalizedComment(String(original.comment ?? '')), after: normalizedComment(draft.comment) },
    { field: 'enabled', before: original.enabled !== false, after: draft.enabled },
    { field: 'dynamic_update_enabled', before: recordDynamicEnabled(original), after: draft.dynamicUpdateEnabled },
  ];

  return candidates.filter((item) => !samePreviewValue(item.before, item.after));
}
