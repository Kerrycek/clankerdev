import type { Node } from '../../../lib/api/nodes';
import type { PublicNodeStatus } from '../../../lib/api/public';
import type { StatusDotVariant } from '../../../components/ui/StatusDot';
import { isMaintenanceLocked } from '../../../lib/nodeMaintenance';

export interface NodeRow {
  id?: number;
  name: string;
  fqdn?: string;
  domain_name?: string;
  locationLabel?: string;

  // From public status
  status?: boolean;
  last_report?: string;
  cpu_idle?: number;
  vps_count?: number;
  vps_free?: number;
  hypervisor_type?: string;
  maintenance_lock?: unknown;
  maintenance_lock_reason?: string;
}

export type NodeStateFilter = 'active' | 'inactive' | 'all';
export type NodeRowVariant = 'warn' | 'danger' | undefined;
export type NodeStatusBadgeVariant = 'ok' | 'danger' | 'neutral';

export interface NodeStatusBadgeView {
  variant: NodeStatusBadgeVariant;
  labelKey: 'state.up' | 'state.down' | 'state.unknown';
}

export interface NodeStats {
  total: number;
  down: number;
  locked: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object';
}

function stringField(v: unknown, key: string): string | undefined {
  if (!isRecord(v)) return undefined;
  const raw = v[key];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

function numberField(v: unknown, key: string): number | undefined {
  if (!isRecord(v)) return undefined;
  const raw = v[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

function booleanField(v: unknown, key: string): boolean | undefined {
  if (!isRecord(v)) return undefined;
  const raw = v[key];
  return typeof raw === 'boolean' ? raw : undefined;
}

function unknownField(v: unknown, key: string): unknown {
  if (!isRecord(v)) return undefined;
  return v[key];
}

export function normalizeNodeState(v: string | null | undefined): NodeStateFilter {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'inactive') return 'inactive';
  if (s === 'all') return 'all';
  return 'active';
}

export function resolveNodeStateValue(raw: string): NodeStateFilter | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v || v === 'active' || v === 'on') return 'active';
  if (v === 'inactive' || v === 'off') return 'inactive';
  if (v === 'all' || v === '*' || v === 'any') return 'all';

  const opts: NodeStateFilter[] = ['active', 'inactive', 'all'];
  const matches = opts.filter((x) => x.startsWith(v));
  if (matches.length === 1) return matches[0] ?? null;
  return null;
}

export function parseIssuesValue(raw: string): boolean | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return true;
  if (v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 'on' || v === 'enabled') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'n' || v === 'off' || v === 'disabled') return false;
  return null;
}

export function locationLabel(loc: unknown): string | undefined {
  if (!loc) return undefined;
  if (typeof loc === 'string') return loc;
  if (typeof loc === 'number') return String(loc);
  if (isRecord(loc)) {
    const label = stringField(loc, 'label');
    if (label) return label;

    const name = stringField(loc, 'name');
    if (name) return name;

    const id = numberField(loc, 'id');
    if (typeof id === 'number') return `#${id}`;
  }
  return undefined;
}

export function keyCandidates(v: unknown): string[] {
  const out: string[] = [];
  const push = (s: unknown) => {
    if (typeof s === 'string' && s.trim()) out.push(s.trim().toLowerCase());
  };

  push(stringField(v, 'name'));
  push(stringField(v, 'domain_name'));
  push(stringField(v, 'fqdn'));
  return out;
}

export function buildStatusIndex(list: PublicNodeStatus[]): Map<string, PublicNodeStatus> {
  const m = new Map<string, PublicNodeStatus>();
  for (const n of list) {
    for (const k of keyCandidates(n)) m.set(k, n);
  }
  return m;
}

function matchingStatus(node: Node, statusIndex: Map<string, PublicNodeStatus>): PublicNodeStatus | undefined {
  for (const k of keyCandidates(node)) {
    const status = statusIndex.get(k);
    if (status) return status;
  }
  return undefined;
}

function rowFromNode(node: Node, statusIndex: Map<string, PublicNodeStatus>): NodeRow {
  const status = matchingStatus(node, statusIndex);
  const id = typeof node.id === 'number' ? node.id : numberField(node, 'id');
  const name = String(
    stringField(node, 'domain_name') ?? stringField(node, 'name') ?? stringField(node, 'fqdn') ?? `#${id ?? '?'}`
  );

  return {
    id,
    name,
    fqdn: stringField(node, 'fqdn'),
    domain_name: stringField(node, 'domain_name'),
    locationLabel: locationLabel(unknownField(node, 'location')),

    status: booleanField(status, 'status'),
    last_report: stringField(status, 'last_report'),
    cpu_idle: numberField(status, 'cpu_idle'),
    vps_count: numberField(status, 'vps_count'),
    vps_free: numberField(status, 'vps_free'),
    hypervisor_type: stringField(status, 'hypervisor_type'),
    maintenance_lock: unknownField(status, 'maintenance_lock'),
    maintenance_lock_reason: stringField(status, 'maintenance_lock_reason'),
  };
}

function rowFromPublicStatus(status: PublicNodeStatus): NodeRow {
  const id = numberField(status, 'id');
  const name = String(
    stringField(status, 'domain_name') ?? stringField(status, 'name') ?? stringField(status, 'fqdn') ?? 'node'
  );

  return {
    id,
    name,
    fqdn: stringField(status, 'fqdn'),
    domain_name: stringField(status, 'domain_name'),
    locationLabel: locationLabel(unknownField(status, 'location')),

    status: booleanField(status, 'status'),
    last_report: stringField(status, 'last_report'),
    cpu_idle: numberField(status, 'cpu_idle'),
    vps_count: numberField(status, 'vps_count'),
    vps_free: numberField(status, 'vps_free'),
    hypervisor_type: stringField(status, 'hypervisor_type'),
    maintenance_lock: unknownField(status, 'maintenance_lock'),
    maintenance_lock_reason: stringField(status, 'maintenance_lock_reason'),
  };
}

export function buildNodeRows(opts: {
  nodes: Node[] | undefined;
  nodesUnavailable: boolean;
  publicStatus: PublicNodeStatus[] | undefined;
  statusIndex: Map<string, PublicNodeStatus>;
}): NodeRow[] {
  if (Array.isArray(opts.nodes)) {
    return opts.nodes.map((node) => rowFromNode(node, opts.statusIndex));
  }

  // Fallback: public status only (does not support from_id).
  if (opts.nodesUnavailable && Array.isArray(opts.publicStatus)) {
    return opts.publicStatus.map(rowFromPublicStatus);
  }

  return [];
}

export function nodeRowVariant(r: NodeRow): NodeRowVariant {
  if (r.status === false) return 'danger';
  if (isMaintenanceLocked(r.maintenance_lock)) return 'warn';
  return undefined;
}

export function nodeDotVariant(r: NodeRow): StatusDotVariant {
  if (r.status === false) return 'danger';
  if (isMaintenanceLocked(r.maintenance_lock)) return 'warn';
  if (r.status === true) return 'ok';
  return 'neutral';
}

export function nodeStatusBadge(status: boolean | undefined): NodeStatusBadgeView {
  if (status === true) return { variant: 'ok', labelKey: 'state.up' };
  if (status === false) return { variant: 'danger', labelKey: 'state.down' };
  return { variant: 'neutral', labelKey: 'state.unknown' };
}

export function hasNodeIssues(r: NodeRow): boolean {
  return nodeRowVariant(r) !== undefined;
}

export function nodeRowKey(r: NodeRow, idx: number): string {
  if (typeof r.id === 'number') return String(r.id);
  // Best-effort key for status-only fallback rows.
  return `${r.name || 'node'}-${idx}`;
}

export function nodeSecondaryLabel(row: NodeRow, naLabel: string): string {
  return row.fqdn ? row.fqdn : row.domain_name ? row.domain_name : row.id ? `#${row.id}` : naLabel;
}

export function maintenanceReason(row: NodeRow): string | undefined {
  const direct = typeof row.maintenance_lock_reason === 'string' ? row.maintenance_lock_reason.trim() : '';
  if (direct) return direct;

  const lock = row.maintenance_lock;
  if (typeof lock === 'string') {
    const s = lock.trim();
    return s || undefined;
  }

  if (isRecord(lock)) {
    const reason = stringField(lock, 'reason');
    if (reason) return reason;
  }

  return undefined;
}

export function filterNodeRows(rows: NodeRow[], opts: { issuesOnly: boolean; qText: string; nodesUnavailable: boolean }): NodeRow[] {
  let out = rows;
  if (opts.issuesOnly) out = out.filter(hasNodeIssues);

  // If the authenticated node index is unavailable, we fall back to the public status list.
  // In that mode, apply q filtering client-side, because the public endpoint is unfiltered.
  const q = opts.qText.trim().toLowerCase();
  if (q && opts.nodesUnavailable) {
    out = out.filter((r) => {
      const hay = [r.name, r.fqdn, r.domain_name, r.locationLabel, String(r.id ?? '')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return out;
}

export function nodeStats(rows: NodeRow[]): NodeStats {
  const total = rows.length;
  const down = rows.filter((r) => r.status === false).length;
  const locked = rows.filter((r) => isMaintenanceLocked(r.maintenance_lock)).length;
  return { total, down, locked };
}
