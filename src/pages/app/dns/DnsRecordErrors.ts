import { HaveApiError } from '../../../lib/api/haveapi';
import { formatErrorMessage } from '../../../lib/errors';

import type { DnsRecordFormField } from './DnsRecordModel';

export type DnsRecordApiFieldError = {
  field: DnsRecordFormField;
  rawKey: string;
  messages: string[];
};

const DNS_RECORD_FIELD_ALIASES: Record<DnsRecordFormField, readonly string[]> = {
  name: ['name', 'record_name', 'hostname'],
  type: ['type', 'record_type', 'rrtype'],
  content: ['content', 'value', 'target', 'address', 'rdata'],
  ttl: ['ttl', 'time_to_live'],
  priority: ['priority', 'preference', 'prio'],
  comment: ['comment', 'note'],
  enabled: ['enabled', 'active'],
  dynamic_update_enabled: ['dynamic_update_enabled', 'dynamic', 'ddns'],
  conflict: ['conflict', 'cname_conflict'],
  record: ['record', 'dns_record'],
};

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeApiErrorKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^dns_record(\.|\[|_)/, '')
    .replace(/\]$/g, '')
    .replace(/[\[\].-]+/g, '_')
    .replace(/^dns_record_/, '')
    .replace(/_id$/, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

export function dnsRecordFieldFromApiErrorKey(raw: string): DnsRecordFormField | null {
  const normalized = normalizeApiErrorKey(raw);
  for (const [field, aliases] of Object.entries(DNS_RECORD_FIELD_ALIASES)) {
    if (field === normalized || aliases.includes(normalized)) return field as DnsRecordFormField;
  }
  return null;
}

function messagesFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => messagesFromUnknown(item)).filter((message) => message.trim().length > 0);
  }
  if (isRecordObject(value)) {
    const message = value['message'];
    if (typeof message === 'string' && message.trim()) return [message.trim()];
    const errors = value['errors'];
    if (errors !== undefined) return messagesFromUnknown(errors);
  }
  const text = formatErrorMessage(value).trim();
  return text ? [text] : [];
}

function collectFieldErrorCandidates(value: unknown, path: string[] = []): Array<{ path: string[]; messages: string[] }> {
  if (Array.isArray(value)) {
    const primitiveMessages = value.every((item) => !isRecordObject(item) && !Array.isArray(item));
    if (primitiveMessages) return [{ path, messages: messagesFromUnknown(value) }];
    return value.flatMap((item) => collectFieldErrorCandidates(item, path));
  }

  if (isRecordObject(value)) {
    if (typeof value['field'] === 'string' && value['message'] !== undefined) {
      return [{ path: [...path, String(value['field'])], messages: messagesFromUnknown(value['message']) }];
    }

    const directMessage = value['message'];
    if (directMessage !== undefined && path.length > 0) {
      return [{ path, messages: messagesFromUnknown(directMessage) }];
    }

    return Object.entries(value).flatMap(([key, nested]) => collectFieldErrorCandidates(nested, [...path, key]));
  }

  if (path.length === 0) return [];
  return [{ path, messages: messagesFromUnknown(value) }];
}

export function parseDnsRecordFieldErrors(error: unknown): DnsRecordApiFieldError[] {
  if (!(error instanceof HaveApiError)) return [];
  const rawErrors = error.envelope?.errors;
  if (rawErrors === undefined || rawErrors === null) return [];

  const merged = new Map<DnsRecordFormField, DnsRecordApiFieldError>();
  for (const candidate of collectFieldErrorCandidates(rawErrors)) {
    const rawPath = candidate.path.join('.');
    const field = [...candidate.path]
      .reverse()
      .map(dnsRecordFieldFromApiErrorKey)
      .find((value): value is DnsRecordFormField => Boolean(value));
    if (!field) continue;
    const existing = merged.get(field);
    if (existing) {
      existing.messages.push(...candidate.messages);
      continue;
    }
    merged.set(field, {
      field,
      rawKey: rawPath,
      messages: candidate.messages,
    });
  }

  return [...merged.values()].map((entry) => ({
    ...entry,
    messages: [...new Set(entry.messages)],
  }));
}
