import type { ResourceRef } from '../../../lib/api/appTypes';
import type { Dataset as StorageDataset } from '../../../lib/api/datasets';
import type { Dataset, VpsMount } from '../../../lib/api/vpsMounts';

export type MountType = 'nfs' | 'bind';
export type MountMode = 'ro' | 'rw';
export type MountStartFail = 'ignore' | 'umount' | 'fail';
export type StorageTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';

export interface MountDraft {
  dataset: Dataset | ResourceRef | null;
  mountpoint: string;
  type: MountType;
  mode: MountMode;
  onStartFail: MountStartFail;
  enabled: boolean;
  masterEnabled: boolean;
  useDefaultMap: boolean;
}

export interface MountValidationResult {
  ok: boolean;
  issues: MountValidationIssue[];
}

export type MountValidationIssue = 'dataset_required' | 'mountpoint_required' | 'mountpoint_absolute' | 'mountpoint_root';
export type MountDiffField = 'mountpoint' | 'type' | 'mode' | 'on_start_fail' | 'enabled' | 'master_enabled' | 'use_default_map';

export interface MountDiffItem {
  field: MountDiffField;
  before: string | boolean;
  after: string | boolean;
}

export interface RootDatasetSummary {
  id: number | null;
  label: string;
  used: number | null;
  available: number | null;
  referenceQuota: number | null;
  quota: number | null;
  referenced: number | null;
  state: string | null;
  mountCount: number | null;
  snapshotCount: number | null;
  exportCount: number | null;
  capacityPercent: number | null;
  capacityTone: StorageTone;
}

export interface StorageOverviewSummary {
  mountCount: number;
  enabledMountCount: number;
  disabledMountCount: number;
  writableMountCount: number;
  readOnlyMountCount: number;
  failedMountCount: number;
}

type DatasetLike = (StorageDataset | Dataset | ResourceRef | Record<string, unknown>) & { id?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function recordString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const raw = value[key];
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return s ? s : null;
}

function recordNumber(value: unknown, key: string): number | null {
  if (!isRecord(value)) return null;
  const raw = value[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}

export function errorMessage(error: unknown): string {
  if (isRecord(error) && typeof error['message'] === 'string') return error['message'];
  return String(error);
}

export function canonicalBool(value: unknown, fallback: boolean): boolean {
  return value === true ? true : value === false ? false : fallback;
}

export function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function positiveNumber(value: unknown): number | null {
  const n = finiteNumber(value);
  return n !== null && n > 0 ? n : null;
}

export function datasetId(dataset: unknown): number | null {
  const id = recordNumber(dataset, 'id');
  return id !== null && Number.isInteger(id) && id > 0 ? id : null;
}

export function datasetLabel(dataset: unknown): string {
  if (!dataset) return '—';
  if (typeof dataset === 'string' || typeof dataset === 'number') return String(dataset);
  return recordString(dataset, 'name') ?? recordString(dataset, 'full_name') ?? recordString(dataset, 'label') ?? (datasetId(dataset) ? `#${datasetId(dataset)}` : '—');
}

export function defaultMountDraft(): MountDraft {
  return {
    dataset: null,
    mountpoint: '',
    type: 'nfs',
    mode: 'rw',
    onStartFail: 'ignore',
    enabled: true,
    masterEnabled: true,
    useDefaultMap: true,
  };
}

export function parseMountType(value: unknown): MountType {
  return value === 'bind' ? 'bind' : 'nfs';
}

export function parseMountMode(value: unknown): MountMode {
  return value === 'ro' ? 'ro' : 'rw';
}

export function parseMountStartFail(value: unknown): MountStartFail {
  return value === 'umount' || value === 'fail' ? value : 'ignore';
}

export function mountDraftFromMount(mount: VpsMount): MountDraft {
  return {
    dataset: mount.dataset ?? null,
    mountpoint: String(mount.mountpoint ?? ''),
    type: parseMountType(mount.type),
    mode: parseMountMode(mount.mode),
    onStartFail: parseMountStartFail(mount.on_start_fail),
    enabled: canonicalBool(mount.enabled, true),
    masterEnabled: canonicalBool(mount.master_enabled, true),
    useDefaultMap: canonicalBool(mount.use_default_map, true),
  };
}

export function validateMountDraft(draft: MountDraft, opts: { requireDataset: boolean }): MountValidationResult {
  const issues: MountValidationIssue[] = [];
  const mountpoint = draft.mountpoint.trim();

  if (opts.requireDataset && !datasetId(draft.dataset)) issues.push('dataset_required');
  if (!mountpoint) issues.push('mountpoint_required');
  if (mountpoint && !mountpoint.startsWith('/')) issues.push('mountpoint_absolute');
  if (mountpoint === '/') issues.push('mountpoint_root');

  return { ok: issues.length === 0, issues };
}

export function buildCreateMountPayload(draft: MountDraft, canAdmin: boolean): Record<string, unknown> {
  return compact({
    dataset: datasetId(draft.dataset) ?? undefined,
    mountpoint: draft.mountpoint.trim(),
    type: draft.type,
    mode: draft.mode,
    on_start_fail: draft.onStartFail,
    enabled: draft.enabled,
    master_enabled: canAdmin ? draft.masterEnabled : undefined,
    use_default_map: draft.useDefaultMap,
  });
}

export function buildUpdateMountPayload(draft: MountDraft, canAdmin: boolean): Record<string, unknown> {
  return compact({
    mountpoint: draft.mountpoint.trim(),
    type: draft.type,
    mode: draft.mode,
    on_start_fail: draft.onStartFail,
    enabled: draft.enabled,
    master_enabled: canAdmin ? draft.masterEnabled : undefined,
    use_default_map: draft.useDefaultMap,
  });
}

function mountComparable(mount: VpsMount) {
  return {
    mountpoint: String(mount.mountpoint ?? ''),
    type: parseMountType(mount.type),
    mode: parseMountMode(mount.mode),
    onStartFail: parseMountStartFail(mount.on_start_fail),
    enabled: canonicalBool(mount.enabled, true),
    masterEnabled: canonicalBool(mount.master_enabled, true),
    useDefaultMap: canonicalBool(mount.use_default_map, true),
  };
}

export function buildMountDiff(draft: MountDraft, mount: VpsMount, canAdmin: boolean): MountDiffItem[] {
  const current = mountComparable(mount);
  const diff: MountDiffItem[] = [];
  const nextMountpoint = draft.mountpoint.trim();

  if (nextMountpoint !== current.mountpoint) diff.push({ field: 'mountpoint', before: current.mountpoint, after: nextMountpoint });
  if (draft.type !== current.type) diff.push({ field: 'type', before: current.type, after: draft.type });
  if (draft.mode !== current.mode) diff.push({ field: 'mode', before: current.mode, after: draft.mode });
  if (draft.onStartFail !== current.onStartFail) diff.push({ field: 'on_start_fail', before: current.onStartFail, after: draft.onStartFail });
  if (draft.enabled !== current.enabled) diff.push({ field: 'enabled', before: current.enabled, after: draft.enabled });
  if (canAdmin && draft.masterEnabled !== current.masterEnabled) {
    diff.push({ field: 'master_enabled', before: current.masterEnabled, after: draft.masterEnabled });
  }
  if (draft.useDefaultMap !== current.useDefaultMap) diff.push({ field: 'use_default_map', before: current.useDefaultMap, after: draft.useDefaultMap });

  return diff;
}

export function isMountDraftDirty(draft: MountDraft, mount: VpsMount, canAdmin: boolean): boolean {
  return buildMountDiff(draft, mount, canAdmin).length > 0;
}

export function mountDeleteConfirmation(mount: VpsMount): string {
  return String(mount.mountpoint ?? mount.id);
}

export function rootDatasetSummary(rootDataset: StorageDataset | null | undefined, fallback: DatasetLike | null | undefined): RootDatasetSummary {
  const source = rootDataset ?? fallback;
  const used = finiteNumber(recordNumber(source, 'used'));
  const available = finiteNumber(recordNumber(source, 'avail'));
  const referenceQuota = positiveNumber(recordNumber(source, 'refquota'));
  const quota = positiveNumber(recordNumber(source, 'quota'));
  const hardLimit = referenceQuota ?? quota;
  const state = recordString(source, 'object_state');
  const capacityPercent = computeCapacityPercent(used, available, hardLimit);

  return {
    id: datasetId(source),
    label: datasetLabel(source),
    used,
    available,
    referenceQuota,
    quota,
    referenced: finiteNumber(recordNumber(source, 'referenced')),
    state,
    mountCount: recordNumber(source, 'mount_count'),
    snapshotCount: recordNumber(source, 'snapshots_count'),
    exportCount: recordNumber(source, 'export_count'),
    capacityPercent,
    capacityTone: capacityTone(capacityPercent, available),
  };
}

export function computeCapacityPercent(used: number | null, available: number | null, hardLimit: number | null): number | null {
  if (used === null) return null;
  if (hardLimit !== null && hardLimit > 0) return Math.min(999, Math.round((used / hardLimit) * 100));
  if (available !== null && used + available > 0) return Math.min(999, Math.round((used / (used + available)) * 100));
  return null;
}

export function capacityTone(percent: number | null, available: number | null): StorageTone {
  if (percent !== null && percent >= 95) return 'danger';
  if (percent !== null && percent >= 85) return 'warn';
  if (available !== null && available <= 1024) return 'warn';
  if (percent === null) return 'neutral';
  return 'ok';
}

export function storageOverviewSummary(mounts: VpsMount[]): StorageOverviewSummary {
  let enabledMountCount = 0;
  let writableMountCount = 0;
  let failedMountCount = 0;

  for (const mount of mounts) {
    if (canonicalBool(mount.enabled, true)) enabledMountCount += 1;
    if (parseMountMode(mount.mode) === 'rw') writableMountCount += 1;
    const state = String(mount.current_state ?? '').toLowerCase();
    if (state.includes('fail') || state.includes('error')) failedMountCount += 1;
  }

  return {
    mountCount: mounts.length,
    enabledMountCount,
    disabledMountCount: mounts.length - enabledMountCount,
    writableMountCount,
    readOnlyMountCount: mounts.length - writableMountCount,
    failedMountCount,
  };
}

export function mountStateTone(mount: VpsMount): StorageTone {
  const state = String(mount.current_state ?? '').toLowerCase();
  if (state.includes('fail') || state.includes('error')) return 'danger';
  if (!canonicalBool(mount.enabled, true) || !canonicalBool(mount.master_enabled, true)) return 'warn';
  if (state.includes('mounted') || state.includes('active') || state.includes('ok')) return 'ok';
  return 'neutral';
}
