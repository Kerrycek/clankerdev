import type { DnsRecord } from '../../../lib/api/dns';

export const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'PTR', 'CAA'] as const;

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
  ttl?: number;
  priority?: number;
  comment?: string;
  enabled: boolean;
  dynamic_update_enabled: boolean;
};



type DnsRecordCompat = DnsRecord & { dynamic?: boolean };

const PRIORITY_RECORD_TYPES = new Set<string>(['MX', 'SRV']);
const HOST_TARGET_TYPES = new Set<string>(['CNAME', 'MX', 'NS', 'PTR']);
const OPTIONAL_INT_MAX = 2_147_483_647;
const PRIORITY_MAX = 65_535;

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
  }

  validateOptionalNumber(issues, 'ttl', draft.ttl, {
    max: OPTIONAL_INT_MAX,
    messagePrefix: 'dns.zone.records.validation.ttl',
  });
  validateOptionalNumber(issues, 'priority', draft.priority, {
    required: PRIORITY_RECORD_TYPES.has(type),
    max: PRIORITY_MAX,
    messagePrefix: 'dns.zone.records.validation.priority',
  });

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
  return {
    dns_zone: zoneId,
    name: draft.name.trim(),
    type: draft.type.toUpperCase(),
    content: draft.content,
    ttl: parseOptionalInteger(draft.ttl),
    priority: parseOptionalInteger(draft.priority),
    comment: draft.comment.trim() || undefined,
    enabled: draft.enabled,
    dynamic_update_enabled: draft.dynamicUpdateEnabled,
  };
}

export function buildDnsRecordUpdatePayload(draft: DnsRecordDraft): DnsRecordUpdatePayload {
  return {
    content: draft.content,
    ttl: parseOptionalInteger(draft.ttl),
    priority: parseOptionalInteger(draft.priority),
    comment: draft.comment.trim() || undefined,
    enabled: draft.enabled,
    dynamic_update_enabled: draft.dynamicUpdateEnabled,
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
    { field: 'ttl', before: original.ttl ?? null, after: optionalNumberPreview(draft.ttl) ?? original.ttl ?? null },
    { field: 'priority', before: original.priority ?? null, after: optionalNumberPreview(draft.priority) ?? original.priority ?? null },
    { field: 'comment', before: normalizedComment(String(original.comment ?? '')), after: normalizedComment(draft.comment) },
    { field: 'enabled', before: original.enabled !== false, after: draft.enabled },
    { field: 'dynamic_update_enabled', before: recordDynamicEnabled(original), after: draft.dynamicUpdateEnabled },
  ];

  return candidates.filter((item) => !samePreviewValue(item.before, item.after));
}
