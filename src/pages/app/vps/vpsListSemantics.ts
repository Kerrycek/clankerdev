import type { Vps } from '../../../lib/api/vps';
import type { TransactionLockIndex } from '../../../lib/lockIndex';
import { transactionLockChainIds } from '../../../lib/lockIndex';
import { gateVpsAction, gateVpsMutation } from '../../../lib/gates/vps';
import type { GateDecision } from '../../../lib/gates/types';
import { objectStateBadge, runtimeStateBadge, type BadgeSpec } from '../../../lib/taskStatus';
import { dotVariantFromBadgeVariant, dotVariantFromRowVariant } from '../../../lib/variantMap';
import type { TableRowVariant } from '../../../components/ui/TableRowLink';
import type { StatusDotVariant } from '../../../components/ui/StatusDot';

export type RiskVariant = 'warn' | 'danger' | undefined;
export type VpsListTranslator = (key: string, params?: Record<string, unknown>) => string;
export type VpsListStateFilter = 'all' | 'running' | 'stopped' | 'busy' | 'failed';
export type VpsListPrimaryAction = 'start' | 'console' | 'details';

export interface VpsListRecord {
  vps: Vps;
  runtimeBadge: BadgeSpec;
  objectBadge: BadgeSpec;
  busyChains: number[];
  busyTx: boolean;
  busyLocalLock: boolean;
  busyLocal: boolean;
  startGate: GateDecision;
  stopGate: GateDecision;
  restartGate: GateDecision;
  deleteGate: GateDecision;
  inFlightKind?: 'start' | 'stop' | 'restart' | 'delete';
  recentFailureChainIds: number[];
  memUsed: number | undefined;
  memMax: number | undefined;
  diskUsed: number | undefined;
  diskMax: number | undefined;
  memoryRisk: RiskVariant;
  diskRisk: RiskVariant;
  rowVariant: TableRowVariant | undefined;
  dotVariant: StatusDotVariant;
  primaryAction: VpsListPrimaryAction;
  nodeLabel: string;
  locationLabel: string;
  ownerLabel: string;
  primaryIpLabel: string;
  loadLabel: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function idLabel(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return `#${value}`;
  if (typeof value === 'string' && value.trim()) return `#${value.trim()}`;
  return undefined;
}

function labelFromRecord(value: unknown, keys: string[]): string | undefined {
  if (!isRecord(value)) return undefined;
  for (const key of keys) {
    const label = nonEmptyString(value[key]);
    if (label) return label;
  }
  return idLabel(value['id']);
}

export function usageRiskVariant(used: number | undefined, max: number | undefined): RiskVariant {
  if (used === undefined || max === undefined || max <= 0) return undefined;
  const pct = (used / max) * 100;
  if (!Number.isFinite(pct)) return undefined;
  if (pct >= 98) return 'danger';
  if (pct >= 90) return 'warn';
  return undefined;
}

export function vpsRowVariant(args: {
  runtimeVariant: BadgeSpec['variant'];
  objectVariant: BadgeSpec['variant'];
  busyTx: boolean;
  busyLocal: boolean;
  recentFailure: boolean;
  memoryRisk: RiskVariant;
  diskRisk: RiskVariant;
}): TableRowVariant | undefined {
  if (
    args.objectVariant === 'danger' ||
    args.runtimeVariant === 'danger' ||
    args.recentFailure ||
    args.memoryRisk === 'danger' ||
    args.diskRisk === 'danger'
  ) {
    return 'danger';
  }
  if (
    args.objectVariant === 'warn' ||
    args.busyTx ||
    args.busyLocal ||
    args.memoryRisk === 'warn' ||
    args.diskRisk === 'warn'
  ) {
    return 'warn';
  }
  return undefined;
}

export function vpsDotVariant(args: {
  rowVariant: TableRowVariant | undefined;
  runtimeVariant: BadgeSpec['variant'];
  objectVariant: BadgeSpec['variant'];
}): StatusDotVariant {
  if (args.rowVariant && args.rowVariant !== 'muted') {
    return dotVariantFromRowVariant(args.rowVariant) ?? 'neutral';
  }
  if (args.objectVariant && args.objectVariant !== 'ok') return dotVariantFromBadgeVariant(args.objectVariant) ?? 'neutral';
  return dotVariantFromBadgeVariant(args.runtimeVariant) ?? 'neutral';
}

export function nodeDisplayName(vps: Vps, t: VpsListTranslator): string {
  return vps.node?.domain_name ?? vps.node?.name ?? t('common.na');
}

export function locationDisplayName(vps: Vps, t: VpsListTranslator): string {
  const location = vps.node?.location;
  const label = labelFromRecord(location, ['label', 'name', 'domain', 'description']);
  return label ?? t('common.na');
}

export function ownerDisplayName(vps: Vps, t: VpsListTranslator): string {
  const label = labelFromRecord(vps.user, ['login', 'label', 'full_name', 'name', 'email']);
  return label ?? t('common.na');
}

function maybeIpAddress(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) return true;
  if (/^[0-9a-f:]+$/i.test(trimmed) && trimmed.includes(':')) return true;
  return false;
}

export function extractVpsIpCandidates(vps: Vps): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (value: unknown) => {
    const str = nonEmptyString(value);
    if (!str || !maybeIpAddress(str) || seen.has(str)) return;
    seen.add(str);
    out.push(str);
  };

  const visit = (value: unknown, depth: number) => {
    if (depth > 3) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!isRecord(value)) return;

    push(value['addr']);
    push(value['ip_addr']);
    push(value['ip']);
    push(value['address']);
    push(value['primary_ip']);
    push(value['primary_ip_address']);
    push(value['primary_ipv4']);
    push(value['primary_ipv6']);

    for (const nestedKey of ['ip_addresses', 'addresses', 'network_addresses', 'public_ip_addresses']) {
      visit(value[nestedKey], depth + 1);
    }
  };

  visit(vps, 0);
  return out;
}

export function primaryIpDisplayName(vps: Vps, t: VpsListTranslator): string {
  return extractVpsIpCandidates(vps)[0] ?? t('vps.list.ip.none');
}

export function primaryActionForVps(vps: Vps): VpsListPrimaryAction {
  if (vps.is_running === false) return 'start';
  if (vps.is_running === true) return 'console';
  return 'details';
}

export function loadValue(vps: Vps, t: VpsListTranslator): string {
  if (typeof vps.loadavg1 === 'number') return String(vps.loadavg1);
  if (vps.loadavg1 !== undefined && vps.loadavg1 !== null && String(vps.loadavg1).trim()) return String(vps.loadavg1);
  return t('common.na');
}

export function buildVpsListRecord(args: {
  vps: Vps;
  lockIndex: TransactionLockIndex;
  failureIndex?: TransactionLockIndex;
  isLocallyLocked: (id: number) => boolean;
  inFlightKind?: 'start' | 'stop' | 'restart' | 'delete';
  t: VpsListTranslator;
}): VpsListRecord {
  const { vps, lockIndex, isLocallyLocked, inFlightKind, t } = args;

  const runtimeBadge = runtimeStateBadge(vps.is_running, t as (key: any) => string);
  const objectBadge = objectStateBadge(vps.object_state, t as (key: any) => string);
  const busyChains = transactionLockChainIds(lockIndex, 'Vps', vps.id);
  const busyTx = busyChains.length > 0;
  const busyLocalLock = isLocallyLocked(vps.id);
  const busyLocal = inFlightKind !== undefined || busyLocalLock;
  const recentFailureChainIds = args.failureIndex ? transactionLockChainIds(args.failureIndex, 'Vps', vps.id) : [];

  const startGate = gateVpsAction('start', { vps, busyLocal, busyTransaction: busyTx });
  const stopGate = gateVpsAction('stop', { vps, busyLocal, busyTransaction: busyTx });
  const restartGate = gateVpsAction('restart', { vps, busyLocal, busyTransaction: busyTx });
  const deleteGate = gateVpsMutation({ vps, busyLocal, busyTransaction: busyTx });

  const memUsed = typeof vps.used_memory === 'number' ? vps.used_memory : undefined;
  const memMax = typeof vps.memory === 'number' ? vps.memory : undefined;
  const diskUsed = typeof vps.used_diskspace === 'number' ? vps.used_diskspace : undefined;
  const diskMax = typeof vps.diskspace === 'number' ? vps.diskspace : undefined;
  const memoryRisk = usageRiskVariant(memUsed, memMax);
  const diskRisk = usageRiskVariant(diskUsed, diskMax);

  const rowVariant = vpsRowVariant({
    runtimeVariant: runtimeBadge.variant,
    objectVariant: objectBadge.variant,
    busyTx,
    busyLocal,
    recentFailure: recentFailureChainIds.length > 0,
    memoryRisk,
    diskRisk,
  });

  const dotVariant = vpsDotVariant({
    rowVariant,
    runtimeVariant: runtimeBadge.variant,
    objectVariant: objectBadge.variant,
  });

  return {
    vps,
    runtimeBadge,
    objectBadge,
    busyChains,
    busyTx,
    busyLocalLock,
    busyLocal,
    startGate,
    stopGate,
    restartGate,
    deleteGate,
    inFlightKind,
    recentFailureChainIds,
    memUsed,
    memMax,
    diskUsed,
    diskMax,
    memoryRisk,
    diskRisk,
    rowVariant,
    dotVariant,
    primaryAction: primaryActionForVps(vps),
    nodeLabel: nodeDisplayName(vps, t),
    locationLabel: locationDisplayName(vps, t),
    ownerLabel: ownerDisplayName(vps, t),
    primaryIpLabel: primaryIpDisplayName(vps, t),
    loadLabel: loadValue(vps, t),
  };
}

export function normalizeVpsListStateFilter(value: unknown): VpsListStateFilter {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'running') return 'running';
  if (normalized === 'stopped' || normalized === 'stop') return 'stopped';
  if (normalized === 'busy' || normalized === 'locked') return 'busy';
  if (normalized === 'failed' || normalized === 'failure' || normalized === 'error') return 'failed';
  return 'all';
}

export function recordMatchesStateFilter(row: VpsListRecord, filter: VpsListStateFilter): boolean {
  switch (filter) {
    case 'running':
      return row.vps.is_running === true;
    case 'stopped':
      return row.vps.is_running === false;
    case 'busy':
      return row.busyTx || row.busyLocal;
    case 'failed':
      return row.recentFailureChainIds.length > 0 || row.objectBadge.variant === 'danger';
    case 'all':
    default:
      return true;
  }
}
