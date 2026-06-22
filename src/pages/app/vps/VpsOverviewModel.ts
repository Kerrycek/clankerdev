import type React from 'react';
import type { ResourceRef } from '../../../lib/api/appTypes';
import type { TransactionChain } from '../../../lib/api/transactions';
import type { Vps, VpsStatus } from '../../../lib/api/vps';
import { isFailedChainState } from '../../../lib/taskStatus';

export type ManagementAction = {
  to: string;
  label: React.ReactNode;
  description: React.ReactNode;
  testId: string;
  badge?: React.ReactNode;
  danger?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function resourceLabel(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!isRecord(value)) return undefined;

  const label = value['label'];
  if (typeof label === 'string' && label.trim()) return label;

  const name = value['name'];
  if (typeof name === 'string' && name.trim()) return name;

  const id = value['id'];
  if (typeof id === 'number' && Number.isFinite(id)) return `#${id}`;
  if (typeof id === 'string' && id.trim()) return `#${id}`;

  return undefined;
}

export function resourceId(value: ResourceRef | undefined | null): number | undefined {
  const id = value?.id;
  return typeof id === 'number' && Number.isFinite(id) ? id : undefined;
}

export function ownerLabel(vps: Vps): string | undefined {
  if (!vps.user) return undefined;
  return vps.user.login || `#${vps.user.id}`;
}

export function ownerId(vps: Vps): number | undefined {
  const id = vps.user?.id;
  return typeof id === 'number' && Number.isFinite(id) ? id : undefined;
}

export function nodeLabel(vps: Vps, fallback: string): string {
  return vps.node?.domain_name || vps.node?.name || fallback;
}

export function locationLabel(vps: Vps, fallback: string): string {
  return vps.node?.location?.label || fallback;
}

export function usageValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function formatLoadavg(vps: Vps): string {
  const a1 = typeof vps.loadavg1 === 'number' ? vps.loadavg1 : undefined;
  const a5 = typeof vps.loadavg5 === 'number' ? vps.loadavg5 : undefined;
  const a15 = typeof vps.loadavg15 === 'number' ? vps.loadavg15 : undefined;

  if (a1 == null && a5 == null && a15 == null) return '—';

  const fmt = (n: number | undefined) => (typeof n === 'number' ? n.toFixed(2) : '—');
  return `${fmt(a1)} / ${fmt(a5)} / ${fmt(a15)}`;
}

export function fmtLoad(value: unknown): string {
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

export function safePercent(num: unknown, den: unknown): number | null {
  const n = typeof num === 'number' ? num : Number.NaN;
  const d = typeof den === 'number' ? den : Number.NaN;
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return (n / d) * 100;
}

export function sortChainsForOverview(list: TransactionChain[]): TransactionChain[] {
  return list.slice().sort((a, b) => {
    const aErr = isFailedChainState(a.state);
    const bErr = isFailedChainState(b.state);
    if (aErr !== bErr) return aErr ? -1 : 1;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

export type MetricsWindow = '24h' | '7d' | '30d';

export function parseMetricsWindow(raw: string | null | undefined): MetricsWindow {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === '7d') return '7d';
  if (v === '30d') return '30d';
  return '24h';
}

export function metricsWindowMs(w: MetricsWindow): number {
  switch (w) {
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

export function metricsLimitForWindow(w: MetricsWindow): number {
  switch (w) {
    case '30d':
      return 900;
    case '7d':
      return 240;
    default:
      return 80;
  }
}

export function sortStatusesByTimeAsc(list: VpsStatus[]): VpsStatus[] {
  return list.slice().sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : Number.NaN;
    const tb = b.created_at ? new Date(b.created_at).getTime() : Number.NaN;
    if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
    if (!Number.isFinite(ta)) return -1;
    if (!Number.isFinite(tb)) return 1;
    return ta - tb;
  });
}
