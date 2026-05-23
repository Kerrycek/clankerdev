import type { Vps } from '../../../lib/api/vps';
import type { TransactionLockIndex } from '../../../lib/lockIndex';
import { transactionLockChainIds } from '../../../lib/lockIndex';
import { gateVpsAction } from '../../../lib/gates/vps';
import type { GateDecision } from '../../../lib/gates/types';
import { objectStateBadge, runtimeStateBadge, type BadgeSpec } from '../../../lib/taskStatus';
import { dotVariantFromBadgeVariant, dotVariantFromRowVariant } from '../../../lib/variantMap';
import type { TableRowVariant } from '../../../components/ui/TableRowLink';
import type { StatusDotVariant } from '../../../components/ui/StatusDot';

export type RiskVariant = 'warn' | 'danger' | undefined;
export type VpsListTranslator = (key: string, params?: Record<string, unknown>) => string;

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
  inFlightKind?: 'start' | 'stop' | 'restart';
  memUsed: number | undefined;
  memMax: number | undefined;
  diskUsed: number | undefined;
  diskMax: number | undefined;
  memoryRisk: RiskVariant;
  diskRisk: RiskVariant;
  rowVariant: TableRowVariant | undefined;
  dotVariant: StatusDotVariant;
  nodeLabel: string;
  loadLabel: string;
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
  memoryRisk: RiskVariant;
  diskRisk: RiskVariant;
}): TableRowVariant | undefined {
  if (
    args.objectVariant === 'danger' ||
    args.runtimeVariant === 'danger' ||
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

export function loadValue(vps: Vps, t: VpsListTranslator): string {
  if (typeof vps.loadavg1 === 'number') return String(vps.loadavg1);
  if (vps.loadavg1 !== undefined && vps.loadavg1 !== null && String(vps.loadavg1).trim()) return String(vps.loadavg1);
  return t('common.na');
}

export function buildVpsListRecord(args: {
  vps: Vps;
  lockIndex: TransactionLockIndex;
  isLocallyLocked: (id: number) => boolean;
  inFlightKind?: 'start' | 'stop' | 'restart';
  t: VpsListTranslator;
}): VpsListRecord {
  const { vps, lockIndex, isLocallyLocked, inFlightKind, t } = args;

  const runtimeBadge = runtimeStateBadge(vps.is_running, t as (key: any) => string);
  const objectBadge = objectStateBadge(vps.object_state, t as (key: any) => string);
  const busyChains = transactionLockChainIds(lockIndex, 'Vps', vps.id);
  const busyTx = busyChains.length > 0;
  const busyLocalLock = isLocallyLocked(vps.id);
  const busyLocal = inFlightKind !== undefined || busyLocalLock;

  const startGate = gateVpsAction('start', { vps, busyLocal, busyTransaction: busyTx });
  const stopGate = gateVpsAction('stop', { vps, busyLocal, busyTransaction: busyTx });
  const restartGate = gateVpsAction('restart', { vps, busyLocal, busyTransaction: busyTx });

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
    inFlightKind,
    memUsed,
    memMax,
    diskUsed,
    diskMax,
    memoryRisk,
    diskRisk,
    rowVariant,
    dotVariant,
    nodeLabel: nodeDisplayName(vps, t),
    loadLabel: loadValue(vps, t),
  };
}
