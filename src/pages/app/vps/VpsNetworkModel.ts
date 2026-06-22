import type { IpAddress } from '../../../lib/api/ipAddresses';
import type { HostIpAddress } from '../../../lib/api/networking';
import type { NetworkInterface, NetworkInterfaceAccounting } from '../../../lib/api/networkInterfaces';

export type NetworkRouteState = 'active' | 'detached' | 'routed' | 'busy';
export type HostPtrState = 'set' | 'missing';

export interface NetworkRouteSummary {
  interfaceCount: number;
  enabledInterfaceCount: number;
  disabledInterfaceCount: number;
  ipCount: number;
  assignedIpCount: number;
  unassignedIpCount: number;
  routedIpCount: number;
  hostAddressCount: number;
  assignedHostAddressCount: number;
  ptrRecordCount: number;
}

export interface ValidationResult {
  ok: boolean;
  invalidValue?: string;
}

type ResourceLike = Record<string, unknown> | string | number | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function recordString(value: Record<string, unknown>, key: string): string | undefined {
  const raw = value[key];
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  return s ? s : undefined;
}

function recordNumber(value: Record<string, unknown>, key: string): number | undefined {
  const raw = value[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  return undefined;
}


export function errorMessage(error: unknown): string {
  if (isRecord(error) && typeof error['message'] === 'string') return error['message'];
  return String(error);
}

export function formatBytes(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null) return '—';
  const b = Math.max(0, bytes);
  if (b < 1024) return `${b} B`;
  const kib = b / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(1)} MiB`;
  const gib = mib / 1024;
  if (gib < 1024) return `${gib.toFixed(2)} GiB`;
  const tib = gib / 1024;
  return `${tib.toFixed(2)} TiB`;
}

export function formatMbpsFromBytesPerSec(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  // Legacy webui treats max_tx/max_rx as bytes/s and displays MiB/s labelled as Mbps.
  // Keep the same arithmetic to avoid surprises.
  return `${Math.round(value / 1024 / 1024)} Mbps`;
}

export function monthKey(d: Date) {
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function sumAccountingRows(rows: NetworkInterfaceAccounting[]): { bytesIn: number; bytesOut: number } {
  let bytesIn = 0;
  let bytesOut = 0;

  for (const r of rows) {
    if (typeof r.bytes_in === 'number') bytesIn += r.bytes_in;
    if (typeof r.bytes_out === 'number') bytesOut += r.bytes_out;
  }

  return { bytesIn, bytesOut };
}

export function canonicalBool(v: unknown, fallback: boolean): boolean {
  return v === true ? true : v === false ? false : fallback;
}

export function parsePositiveId(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function idFromResourceRef(v: ResourceLike): number | null {
  if (!v) return null;
  if (typeof v === 'number') return Number.isInteger(v) && v > 0 ? v : null;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return recordNumber(v, 'id') ?? null;
}

export function labelFromResourceRef(v: ResourceLike, fields: string[] = ['label', 'name', 'hostname', 'login', 'addr', 'ip_addr']): string {
  if (!v) return '—';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  for (const field of fields) {
    const raw = recordString(v, field);
    if (raw) return raw;
  }
  const id = idFromResourceRef(v);
  if (id) return `#${id}`;
  return '—';
}

export function groupIpByInterface(ips: IpAddress[]): Map<number, IpAddress[]> {
  const m = new Map<number, IpAddress[]>();

  for (const ip of ips) {
    const id = idFromResourceRef(ip.network_interface as ResourceLike) ?? -1;
    if (!m.has(id)) m.set(id, []);
    m.get(id)!.push(ip);
  }

  return m;
}

export function ipAddressLabel(ip: IpAddress | null): string {
  if (!ip) return '—';
  if (ip.addr) return ip.addr;
  return recordString(ip, 'address') ?? `#${ip.id}`;
}

export function ipFamilyLabel(ip: IpAddress): string {
  const network = isRecord(ip.network) ? ip.network : undefined;
  const raw = network ? recordNumber(network, 'ip_version') : undefined;
  const direct = isRecord(ip) ? recordNumber(ip, 'ip_version') ?? recordNumber(ip, 'version') : undefined;
  const version = raw ?? direct;
  return version ? `IPv${version}` : '—';
}

export function ipLocationLabel(ip: IpAddress): string {
  const network = isRecord(ip.network) ? ip.network : undefined;
  return labelFromResourceRef((network?.['location'] ?? (isRecord(ip) ? ip['location'] : undefined)) as ResourceLike);
}

export function ipNetworkLabel(ip: IpAddress): string {
  const network = isRecord(ip.network) ? ip.network : undefined;
  return network ? recordString(network, 'address') ?? recordString(network, 'label') ?? '—' : '—';
}

export function ipPurposeLabel(ip: IpAddress): string {
  return isRecord(ip) ? recordString(ip, 'purpose') ?? '—' : '—';
}

export function ipHasInterface(ip: IpAddress): boolean {
  return idFromResourceRef(ip.network_interface as ResourceLike) !== null;
}

export function ipIsRouted(ip: IpAddress): boolean {
  return ip.routed === true;
}

export function routeStateForIp(ip: IpAddress, busy: boolean): NetworkRouteState {
  if (busy) return 'busy';
  if (!ipHasInterface(ip)) return 'detached';
  return ipIsRouted(ip) ? 'routed' : 'active';
}

export function hostAddr(row: HostIpAddress): string {
  if (row.addr) return row.addr;
  return recordString(row, 'ip_addr') ?? `#${row.id}`;
}

export function hostRouteLabel(row: HostIpAddress): string {
  const ip = row.ip_address;
  if (isRecord(ip)) return recordString(ip, 'addr') ?? recordString(ip, 'ip_addr') ?? '—';
  return '—';
}

export function hostAssigned(row: HostIpAddress): boolean {
  return row.assigned !== false;
}

export function hostPtrValue(row: HostIpAddress): string {
  const value = row.reverse_record_value;
  if (value === undefined || value === null || String(value).trim() === '') return '—';
  return String(value);
}

export function hostPtrState(row: HostIpAddress): HostPtrState {
  return hostPtrValue(row) === '—' ? 'missing' : 'set';
}

export function buildNetworkRouteSummary(args: {
  netifs: NetworkInterface[];
  ips: IpAddress[];
  hostAddresses: HostIpAddress[];
}): NetworkRouteSummary {
  const disabledInterfaceCount = args.netifs.filter((ni) => ni.enable === false).length;
  const assignedIpCount = args.ips.filter(ipHasInterface).length;
  const routedIpCount = args.ips.filter(ipIsRouted).length;
  const assignedHostAddressCount = args.hostAddresses.filter(hostAssigned).length;
  const ptrRecordCount = args.hostAddresses.filter((row) => hostPtrState(row) === 'set').length;

  return {
    interfaceCount: args.netifs.length,
    enabledInterfaceCount: args.netifs.length - disabledInterfaceCount,
    disabledInterfaceCount,
    ipCount: args.ips.length,
    assignedIpCount,
    unassignedIpCount: args.ips.length - assignedIpCount,
    routedIpCount,
    hostAddressCount: args.hostAddresses.length,
    assignedHostAddressCount,
    ptrRecordCount,
  };
}

function validIpv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function validIpv6(value: string): boolean {
  if (!value.includes(':')) return false;
  if (!/^[0-9a-fA-F:.]+$/.test(value)) return false;
  if ((value.match(/::/g) ?? []).length > 1) return false;
  return value.split(':').filter(Boolean).length >= 2;
}

export function validateHostAddressInput(raw: string): ValidationResult {
  const values = raw
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  for (const value of values) {
    if (value.includes('/') || /\s/.test(value) || (!validIpv4(value) && !validIpv6(value))) {
      return { ok: false, invalidValue: value };
    }
  }

  return { ok: true };
}

export function validatePtrValue(raw: string): ValidationResult {
  const value = raw.trim();
  if (!value) return { ok: true };
  if (value.length > 253 || /\s/.test(value)) return { ok: false, invalidValue: value };

  const normalized = value.endsWith('.') ? value.slice(0, -1) : value;
  const labels = normalized.split('.');
  if (labels.length === 0) return { ok: false, invalidValue: value };

  for (const label of labels) {
    if (label.length < 1 || label.length > 63) return { ok: false, invalidValue: value };
    if (!/^[A-Za-z0-9-]+$/.test(label)) return { ok: false, invalidValue: value };
    if (label.startsWith('-') || label.endsWith('-')) return { ok: false, invalidValue: value };
  }

  return { ok: true };
}
