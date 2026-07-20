import type { Node, NodeStatus } from '../../../../lib/api/nodes';
import type { PublicNodeStatus } from '../../../../lib/api/public';
import type { Transaction } from '../../../../lib/api/transactions';
import { isMaintenanceLocked as isNodeMaintenanceLocked } from '../../../../lib/nodeMaintenance';
import { transactionBadge } from '../../../../lib/taskStatus';

export type MetricsWindow = '6h' | '24h' | '7d';
export type BadgeVariant = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'black';

export function locationLabel(loc: unknown): string | undefined {
  if (!loc) return undefined;
  if (typeof loc === 'string') return loc;
  if (typeof loc === 'number') return String(loc);
  if (typeof loc === 'object') {
    const value = loc as { label?: unknown; name?: unknown; id?: unknown };
    if (typeof value.label === 'string' && value.label) return value.label;
    if (typeof value.name === 'string' && value.name) return value.name;
    if (typeof value.id === 'number') return `#${value.id}`;
  }
  return undefined;
}

export function buildNodeStatusKeys(v: Partial<Pick<PublicNodeStatus, 'name' | 'fqdn'>> & { domain_name?: unknown }): string[] {
  const out: string[] = [];
  const push = (s: unknown) => {
    if (typeof s === 'string' && s.trim()) out.push(s.trim().toLowerCase());
  };
  push(v.name);
  push(v.domain_name);
  push(v.fqdn);
  return out;
}

export function buildStatusIndex(list: PublicNodeStatus[]): Map<string, PublicNodeStatus> {
  const m = new Map<string, PublicNodeStatus>();
  for (const n of list) {
    for (const k of buildNodeStatusKeys(n)) m.set(k, n);
  }
  return m;
}

export function isMaintenanceLocked(lock: unknown): boolean {
  return isNodeMaintenanceLocked(lock);
}

export function statusBadge(
  t: (key: any, params?: Record<string, unknown>) => string,
  status: boolean | undefined
): { variant: BadgeVariant; label: string } {
  if (status === true) return { variant: 'ok', label: t('state.up') };
  if (status === false) return { variant: 'danger', label: t('state.down') };
  return { variant: 'neutral', label: t('state.unknown') };
}

export function txBadge(tx: Transaction): { variant: BadgeVariant; label: string } {
  return transactionBadge(tx);
}

export function txRowVariant(tx: Transaction): 'warn' | 'danger' | undefined {
  const doneStr = String(tx.done ?? '');
  const isError = doneStr === 'done' && tx.success === 0;
  if (isError) return 'danger';
  if (doneStr !== 'done') return 'warn';
  return undefined;
}

export function resourceId(ref: unknown): number | undefined {
  if (!ref || typeof ref !== 'object') return undefined;
  const raw = (ref as { id?: unknown }).id;
  const id = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

export function fmt(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return String(value);
}

export function fmtPercent(value: unknown): string {
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n)) return '—';
  return `${n}%`;
}

export function fmtLoad(value: unknown): string {
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

export function nodeTitle(n: Node, fallbackId: number): string {
  return String(n.domain_name ?? n.name ?? n.fqdn ?? `#${fallbackId}`);
}

export function nodeLocation(node: Node | undefined): string | undefined {
  return node ? locationLabel(node.location) : undefined;
}

export function nodeLockReason(node: Node | undefined): string {
  return node && typeof node.maintenance_lock_reason === 'string' ? node.maintenance_lock_reason : '';
}

export function parseMetricsWindow(raw: string | null | undefined): MetricsWindow {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === '24h') return '24h';
  if (v === '7d') return '7d';
  return '6h';
}


export function metricsWindowMs(w: MetricsWindow): number {
  switch (w) {
    case '24h':
      return 24 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return 6 * 60 * 60 * 1000;
  }
}

export function metricsLimitForWindow(w: MetricsWindow): number {
  switch (w) {
    case '7d':
      return 800;
    case '24h':
      return 240;
    default:
      return 120;
  }
}

export function safePercent(num: unknown, den: unknown): number | null {
  const n = typeof num === 'number' ? num : Number.NaN;
  const d = typeof den === 'number' ? den : Number.NaN;
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return (n / d) * 100;
}

export function sortStatusesByTimeAsc(list: NodeStatus[]): NodeStatus[] {
  return list
    .slice()
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : Number.NaN;
      const tb = b.created_at ? new Date(b.created_at).getTime() : Number.NaN;
      if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
      if (!Number.isFinite(ta)) return -1;
      if (!Number.isFinite(tb)) return 1;
      return ta - tb;
    });
}
