import { HaveApiError } from '../../../lib/api/haveapi';
import { formatErrorMessage } from '../../../lib/errors';
import type { VpsConfigReviewKey } from './VpsConfigurationModel';

export type VpsConfigFieldError = {
  key: VpsConfigReviewKey;
  rawKey: string;
  messages: string[];
};

const CONFIG_FIELD_ERROR_ALIASES: Record<VpsConfigReviewKey, readonly string[]> = {
  manage_hostname: ['manage_hostname', 'hostname_mode'],
  hostname: ['hostname'],
  user: ['user', 'owner', 'user_id'],
  cpu: ['cpu', 'cpus'],
  cpu_limit: ['cpu_limit', 'cpulimit'],
  memory: ['memory', 'ram'],
  swap: ['swap'],
  dns_resolver: ['dns_resolver', 'resolver', 'dns'],
  user_namespace_map: ['user_namespace_map', 'namespace_map'],
  autostart_priority: ['autostart_priority'],
  start_menu_timeout: ['start_menu_timeout'],
  cgroup_version: ['cgroup_version'],
  allow_admin_modifications: ['allow_admin_modifications'],
  change_reason: ['change_reason', 'reason'],
  admin_override: ['admin_override'],
  admin_lock_type: ['admin_lock_type', 'lock_type'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeApiErrorKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^vps(\.|\[)/, '')
    .replace(/\]$/g, '')
    .replace(/[\[\].-]+/g, '_')
    .replace(/^vps_/, '')
    .replace(/_id$/, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

export function fieldKeyFromApiErrorKey(raw: string): VpsConfigReviewKey | null {
  const normalized = normalizeApiErrorKey(raw);
  for (const [fieldKey, aliases] of Object.entries(CONFIG_FIELD_ERROR_ALIASES)) {
    if (fieldKey === normalized || aliases.includes(normalized)) return fieldKey as VpsConfigReviewKey;
  }
  return null;
}

function messagesFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => messagesFromUnknown(item)).filter((message) => message.trim().length > 0);
  }
  if (isRecord(value)) {
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
    const primitiveMessages = value.every((item) => !isRecord(item) && !Array.isArray(item));
    if (primitiveMessages) return [{ path, messages: messagesFromUnknown(value) }];
    return value.flatMap((item) => collectFieldErrorCandidates(item, path));
  }

  if (isRecord(value)) {
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

export function parseVpsConfigFieldErrors(error: unknown): VpsConfigFieldError[] {
  if (!(error instanceof HaveApiError)) return [];
  const rawErrors = error.envelope?.errors;
  if (rawErrors === undefined || rawErrors === null) return [];

  const merged = new Map<VpsConfigReviewKey, VpsConfigFieldError>();
  for (const candidate of collectFieldErrorCandidates(rawErrors)) {
    const rawPath = candidate.path.join('.');
    const key = [...candidate.path].reverse().map(fieldKeyFromApiErrorKey).find((field): field is VpsConfigReviewKey => Boolean(field));
    if (!key) continue;
    const existing = merged.get(key);
    if (existing) {
      existing.messages.push(...candidate.messages);
      continue;
    }
    merged.set(key, {
      key,
      rawKey: rawPath,
      messages: candidate.messages,
    });
  }

  return [...merged.values()].map((entry) => ({
    ...entry,
    messages: [...new Set(entry.messages)],
  }));
}
