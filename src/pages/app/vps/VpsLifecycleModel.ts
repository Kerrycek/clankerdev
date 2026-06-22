import type { IpAddress } from '../../../lib/api/ipAddresses';
import type { Location } from '../../../lib/api/infra';
import type { Node } from '../../../lib/api/nodes';
import type { Vps } from '../../../lib/api/vps';
import { formatMiB } from '../../../lib/format';
import { parseLookupIdLike } from '../../../lib/lookupInput';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

export function resourceId(value: unknown): number | null {
  const direct = numericId(value);
  if (direct !== null) return direct;
  const record = asRecord(value);
  return record ? numericId(record['id']) : null;
}

export function parseOptionalId(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = parseLookupIdLike(trimmed);
  if (n === null || !Number.isInteger(n) || n <= 0) throw new Error('invalid-id');
  return n;
}

export function parseRequiredId(raw: string): number {
  const n = parseOptionalId(raw);
  if (n === undefined) throw new Error('required-id');
  return n;
}

export function parseOptionalNonNegativeInt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) throw new Error('invalid-id');
  return n;
}

export function locationLabel(location: Location): string {
  return String(location.label ?? location.description ?? location.domain ?? `#${location.id}`);
}

export function locationEnvironmentId(location: Location | undefined): number | undefined {
  const nested = resourceId(location?.environment);
  if (nested !== null) return nested;

  const raw = asRecord(location)?.['environment_id'];
  const direct = numericId(raw);
  return direct ?? undefined;
}

export function nodeLabel(vps: unknown): string {
  const node = asRecord(vps)?.['node'];
  const nodeRecord = asRecord(node);
  if (!nodeRecord) return '—';
  return String(nodeRecord['domain_name'] ?? nodeRecord['name'] ?? nodeRecord['label'] ?? `#${resourceId(nodeRecord) ?? ''}`).trim() || '—';
}

export function pickedNodeLabel(node: { id?: number; domain_name?: unknown; name?: unknown; fqdn?: unknown }): string {
  const name = String(node.domain_name ?? node.name ?? node.fqdn ?? '').trim();
  const id = typeof node.id === 'number' && Number.isFinite(node.id) ? `#${node.id}` : '';
  if (name && id) return `${name} (${id})`;
  return name || id || '';
}

export function nodeLocation(node: Node | undefined): Location | undefined {
  const location = node?.location;
  return location && typeof location === 'object' ? location : undefined;
}

export function ownerLabel(vps: unknown): string {
  const user = asRecord(vps)?.['user'];
  const userRecord = asRecord(user);
  if (!userRecord) return '—';
  return String(userRecord['login'] ?? userRecord['label'] ?? `#${resourceId(userRecord) ?? ''}`).trim() || '—';
}

export function datasetLabel(vps: unknown): string {
  const record = asRecord(vps);
  if (!record) return '—';
  const dataset = record['dataset'] ?? record['root_dataset'];
  const direct = stringValue(dataset);
  if (direct) return direct;
  const numeric = numericId(dataset);
  if (numeric !== null) return `#${numeric}`;
  const datasetRecord = asRecord(dataset);
  if (datasetRecord) {
    return String(
      datasetRecord['name'] ??
      datasetRecord['full_name'] ??
      datasetRecord['label'] ??
      datasetRecord['dataset'] ??
      datasetRecord['mountpoint'] ??
      `#${resourceId(datasetRecord) ?? ''}`
    ).trim() || '—';
  }
  return '—';
}

export function stateLabel(vps: unknown): string {
  const state = asRecord(vps)?.['object_state'];
  return String(state ?? 'active').trim() || 'active';
}

export function vpsLocationId(vps: unknown): number | null {
  const record = asRecord(vps);
  if (!record) return null;
  const nodeLocationRecord = asRecord(record['node'])?.['location'];
  return resourceId(nodeLocationRecord ?? record['location']);
}

export function vpsLocationLabel(vps: unknown): string {
  const record = asRecord(vps);
  if (!record) return '—';
  const location = asRecord(record['node'])?.['location'] ?? record['location'];
  const locationRecord = asRecord(location);
  if (!locationRecord) {
    const id = vpsLocationId(vps);
    return id ? `#${id}` : '—';
  }
  return String(locationRecord['label'] ?? locationRecord['description'] ?? locationRecord['domain'] ?? `#${resourceId(locationRecord) ?? ''}`).trim() || '—';
}

export function resourceSummary(vps: unknown): string {
  const row = asRecord(vps);
  if (!row) return '—';
  const cpu = row['cpu'] ?? row['cpus'];
  const memory = row['memory'];
  const swap = row['swap'];
  const diskspace = row['diskspace'];
  const parts = [
    typeof cpu === 'number' ? `${cpu} vCPU` : null,
    typeof memory === 'number' ? formatMiB(memory) : null,
    typeof swap === 'number' ? `${formatMiB(swap)} swap` : null,
    typeof diskspace === 'number' ? `${formatMiB(diskspace)} disk` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(' / ') : '—';
}

export function vpsLabel(vps: unknown, fallbackId?: number | null): string {
  const record = asRecord(vps);
  if (record) {
    const id = resourceId(record) ?? fallbackId;
    const hostname = stringValue(record['hostname']) ?? '';
    const label = stringValue(record['label']) ?? '';
    if (hostname && id) return `${hostname} (#${id})`;
    if (hostname) return hostname;
    if (label && id) return `${label} (#${id})`;
    if (label) return label;
    if (id) return `#${id}`;
  }
  return fallbackId ? `#${fallbackId}` : '—';
}

export function ipAddressText(ip: IpAddress): string {
  const addr = String(ip.addr ?? '').trim();
  const prefix = typeof ip.prefix === 'number' ? `/${ip.prefix}` : '';
  const role = ip.network?.role || ip.network?.purpose;
  return `${addr || `#${ip.id}`}${prefix}${role ? ` · ${String(role)}` : ''}`;
}

export function vpsHostname(vps: Pick<Vps, 'id' | 'hostname'>): string {
  return String(vps.hostname ?? '').trim() || `#${vps.id}`;
}
