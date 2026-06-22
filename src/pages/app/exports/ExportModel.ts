import type { Dataset, Snapshot } from '../../../lib/api/datasets';
import type { ExportHost, ExportItem } from '../../../lib/api/exports';

export type ExportSourceType = 'dataset' | 'snapshot';
export type ExportDiffField = 'enabled' | 'all_vps' | 'rw' | 'sync' | 'subtree_check' | 'root_squash' | 'threads';
export type ExportHostDiffField = 'rw' | 'sync' | 'subtree_check' | 'root_squash';
export type ExportCreateIssue = 'dataset_required' | 'snapshot_required' | 'host_required' | 'threads_invalid';

export type CreateExportFormState = {
  datasetId: number | null;
  sourceType: ExportSourceType;
  snapshotId: string;
  hostIpId: number | null;
  allVps: boolean;
  rw: boolean;
  sync: boolean;
  subtreeCheck: boolean;
  rootSquash: boolean;
  threads: string;
  enabled: boolean;
};

export type EditExportFormState = {
  all_vps: boolean;
  rw: boolean;
  sync: boolean;
  subtree_check: boolean;
  root_squash: boolean;
  threads: string;
  enabled: boolean;
};

export type ExportDiffItem = {
  field: ExportDiffField;
  before: boolean | number | string;
  after: boolean | number | string;
};

export type ExportHostDiffItem = {
  field: ExportHostDiffField;
  before: boolean;
  after: boolean;
};

export interface ExportCreateValidationResult {
  ok: boolean;
  issues: ExportCreateIssue[];
}

export function parsePositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function parseBoolToken(raw: string): boolean | undefined {
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(s)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(s)) return false;
  return undefined;
}

export function resourceLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const record = value as Record<string, unknown>;
  const label = record['full_name'] ?? record['name'] ?? record['label'];
  if (label !== undefined && label !== null && String(label).trim()) return String(label);
  const id = record['id'];
  return id !== undefined && id !== null ? `#${id}` : '—';
}

export function sourceLabel(ex: ExportItem | { dataset?: Dataset | Record<string, unknown>; snapshot?: Snapshot | Record<string, unknown> | null } | null | undefined): string {
  const dataset = resourceLabel(ex?.dataset);
  const snap = ex?.snapshot;
  if (snap && typeof snap === 'object' && parsePositiveInt((snap as Record<string, unknown>)['id'])) {
    return `${dataset} · ${resourceLabel(snap)}`;
  }
  return dataset;
}

export function sourceShortName(ex: ExportItem | null | undefined): string {
  const snap = ex?.snapshot;
  if (snap && typeof snap === 'object') {
    const record = snap as Record<string, unknown>;
    const id = parsePositiveInt(record['id']);
    if (id) return String(record['label'] ?? record['name'] ?? `snapshot-${id}`);
  }
  const ds = ex?.dataset;
  if (ds && typeof ds === 'object') {
    const record = ds as Record<string, unknown>;
    const id = parsePositiveInt(record['id']);
    return String(record['name'] ?? record['full_name'] ?? record['label'] ?? (id ? `dataset-${id}` : 'export'));
  }
  return 'export';
}

export function exportAddress(ex: ExportItem | null | undefined): string {
  const host = ex?.host_ip_address;
  if (host && typeof host === 'object') {
    const record = host as Record<string, unknown>;
    return String(record['addr'] ?? (record['id'] ? `#${record['id']}` : '—'));
  }
  return '—';
}

export function hostLabel(host: ExportHost | null | undefined): string {
  const ip = host?.ip_address;
  if (ip && typeof ip === 'object') {
    const record = ip as Record<string, unknown>;
    return String(record['addr'] ?? (record['id'] ? `#${record['id']}` : '#?'));
  }
  return '#?';
}

export function exportRowVariant(ex: ExportItem): 'ok' | 'warn' {
  return ex.enabled === false ? 'warn' : 'ok';
}

export function defaultCreateForm(datasetId: number | null): CreateExportFormState {
  return {
    datasetId,
    sourceType: 'dataset',
    snapshotId: '',
    hostIpId: null,
    allVps: true,
    rw: true,
    sync: true,
    subtreeCheck: false,
    rootSquash: false,
    threads: '8',
    enabled: true,
  };
}

export function editFormFromExport(ex: ExportItem): EditExportFormState {
  return {
    all_vps: Boolean(ex.all_vps),
    rw: Boolean(ex.rw),
    sync: Boolean(ex.sync),
    subtree_check: Boolean(ex.subtree_check),
    root_squash: Boolean(ex.root_squash),
    threads: String(ex.threads ?? 8),
    enabled: Boolean(ex.enabled ?? true),
  };
}

function parseAdminThreads(value: string): number | undefined {
  const threads = Number(value);
  return Number.isFinite(threads) && threads > 0 ? Math.floor(threads) : undefined;
}

export function validateCreateExportForm(form: CreateExportFormState, isAdmin: boolean): ExportCreateValidationResult {
  const issues: ExportCreateIssue[] = [];
  if (!form.datasetId) issues.push('dataset_required');
  if (form.sourceType === 'snapshot' && !parsePositiveInt(form.snapshotId)) issues.push('snapshot_required');
  if (!form.hostIpId) issues.push('host_required');
  if (isAdmin && form.threads.trim() && !parseAdminThreads(form.threads)) issues.push('threads_invalid');
  return { ok: issues.length === 0, issues };
}

export function buildCreateExportPayload(form: CreateExportFormState, isAdmin: boolean) {
  const threads = parseAdminThreads(form.threads);
  return {
    dataset: form.sourceType === 'dataset' ? form.datasetId ?? undefined : undefined,
    snapshot: form.sourceType === 'snapshot' ? Number(form.snapshotId) : undefined,
    host_ip_address: form.hostIpId ?? 0,
    all_vps: form.allVps,
    rw: form.rw,
    sync: form.sync,
    subtree_check: form.subtreeCheck,
    root_squash: form.rootSquash,
    threads: isAdmin ? threads : undefined,
    enabled: form.enabled,
  };
}

export function buildUpdateExportPayload(form: EditExportFormState, isAdmin: boolean) {
  const threads = parseAdminThreads(form.threads);
  return {
    all_vps: form.all_vps,
    rw: form.rw,
    sync: form.sync,
    subtree_check: form.subtree_check,
    root_squash: form.root_squash,
    threads: isAdmin ? threads : undefined,
    enabled: form.enabled,
  };
}

export function buildExportDiff(ex: ExportItem, form: EditExportFormState, isAdmin: boolean): ExportDiffItem[] {
  const diff: ExportDiffItem[] = [];
  const currentThreads = parsePositiveInt(ex.threads) ?? 0;
  const nextThreads = parseAdminThreads(form.threads) ?? 0;
  const fields: Array<[ExportDiffField, boolean, boolean]> = [
    ['enabled', Boolean(ex.enabled ?? true), form.enabled],
    ['all_vps', Boolean(ex.all_vps), form.all_vps],
    ['rw', Boolean(ex.rw), form.rw],
    ['sync', Boolean(ex.sync), form.sync],
    ['subtree_check', Boolean(ex.subtree_check), form.subtree_check],
    ['root_squash', Boolean(ex.root_squash), form.root_squash],
  ];

  for (const [field, before, after] of fields) {
    if (before !== after) diff.push({ field, before, after });
  }
  if (isAdmin && currentThreads !== nextThreads) diff.push({ field: 'threads', before: currentThreads, after: nextThreads });
  return diff;
}

export function buildExportHostDiff(host: ExportHost, form: Pick<EditExportFormState, 'rw' | 'sync' | 'subtree_check' | 'root_squash'>): ExportHostDiffItem[] {
  const diff: ExportHostDiffItem[] = [];
  const fields: Array<[ExportHostDiffField, boolean, boolean]> = [
    ['rw', Boolean(host.rw), form.rw],
    ['sync', Boolean(host.sync), form.sync],
    ['subtree_check', Boolean(host.subtree_check), form.subtree_check],
    ['root_squash', Boolean(host.root_squash), form.root_squash],
  ];
  for (const [field, before, after] of fields) {
    if (before !== after) diff.push({ field, before, after });
  }
  return diff;
}

export function exportDeleteConfirmText(ex: ExportItem | null | undefined): string | undefined {
  const id = parsePositiveInt(ex?.id);
  return id ? String(id) : undefined;
}

export function hostDeleteConfirmText(host: ExportHost | null | undefined): string | undefined {
  const id = parsePositiveInt(host?.id);
  return id ? String(id) : undefined;
}

export function sanitizeMountName(input: string, fallbackId: number): string {
  const base = String(input || '').trim().toLowerCase();
  const cleaned = base.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return cleaned || `export-${fallbackId}`;
}

export function snippetMountCommand(address: string, path: string, mountPoint: string) {
  return `sudo mkdir -p ${mountPoint}\nsudo mount -t nfs ${address}:${path} ${mountPoint}`;
}

export function snippetFstab(address: string, path: string, mountPoint: string, rw: boolean) {
  const mode = rw ? 'rw' : 'ro';
  return `${address}:${path} ${mountPoint} nfs ${mode},defaults 0 0`;
}

export function snippetSystemd(address: string, path: string, mountPoint: string, rw: boolean) {
  const escaped = mountPoint.replace(/^\//, '').replace(/\//g, '-');
  const opts = rw ? 'rw,defaults' : 'ro,defaults';
  return `[Unit]\nDescription=Mount ${address}:${path}\nAfter=network-online.target\nWants=network-online.target\n\n[Mount]\nWhat=${address}:${path}\nWhere=${mountPoint}\nType=nfs\nOptions=${opts}\n\n[Install]\nWantedBy=multi-user.target\n# file: /etc/systemd/system/${escaped}.mount`;
}

export function snippetNix(address: string, path: string, mountPoint: string, rw: boolean) {
  const opts = rw ? '[ "rw" "defaults" ]' : '[ "ro" "defaults" ]';
  return `fileSystems."${mountPoint}" = {\n  device = "${address}:${path}";\n  fsType = "nfs";\n  options = ${opts};\n};`;
}
