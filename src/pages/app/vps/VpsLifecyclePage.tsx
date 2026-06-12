import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useChrome } from '../../../components/layout/ChromeContext';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Input } from '../../../components/ui/Input';
import { NodeLookupInput } from '../../../components/ui/NodeLookupInput';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';
import { VpsLookupInput } from '../../../components/ui/VpsLookupInput';
import { LifecyclePanel } from '../../../components/lifetimes/LifecyclePanel';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { fetchLocations, type Location } from '../../../lib/api/infra';
import { fetchNodes, type Node } from '../../../lib/api/nodes';
import { fetchIpAddressesForVps, type IpAddress } from '../../../lib/api/ipAddresses';
import { fetchOsTemplates, type OsTemplate } from '../../../lib/api/osTemplates';
import {
  fetchVps,
  fetchVpsList,
  updateVps,
  vpsBoot,
  vpsClone,
  vpsDelete,
  vpsMigrate,
  vpsReinstall,
  vpsReplace,
  vpsSwapWith,
  type VpsBootPayload,
  type VpsClonePayload,
  type VpsMigratePayload,
  type VpsReplacePayload,
  type VpsSwapWithPayload,
  type Vps,
} from '../../../lib/api/vps';
import { formatDateTime, formatMiB } from '../../../lib/format';
import { gateVpsMutation } from '../../../lib/gates/vps';
import { parseLookupIdLike } from '../../../lib/lookupInput';
import { preflightVpsNotBusy } from './vpsPreflight';
import { useVps } from './VpsContext';

type CloneForm = {
  user: string;
  node: string;
  location: string;
  hostname: string;
  subdatasets: boolean;
  datasetPlans: boolean;
  resources: boolean;
  features: boolean;
  stop: boolean;
  confirm: boolean;
};

type SwapForm = {
  targetVps: number | null;
  hostname: boolean;
  resources: boolean;
  expirations: boolean;
  confirm: boolean;
};

type ReplaceForm = {
  node: string;
  expirationDate: string;
  start: boolean;
  reason: string;
  confirm: boolean;
};

type TemplateForm = {
  osTemplate: string;
  autoUpdate: boolean;
  confirm: boolean;
};

type BootForm = {
  osTemplate: string;
  mountRootDataset: boolean;
  mountpoint: string;
  confirm: boolean;
};

type ReinstallForm = {
  osTemplate: string;
  confirm: boolean;
};

type MigrateForm = {
  node: string;
  replaceIpAddresses: boolean;
  transferIpAddresses: boolean;
  scheduleMode: 'now' | 'maintenance' | 'custom';
  finishWeekday: string;
  finishHour: string;
  stopOnError: boolean;
  cleanupData: boolean;
  noStart: boolean;
  skipStart: boolean;
  sendMail: boolean;
  reason: string;
  confirm: boolean;
};

type DeleteForm = {
  lazy: boolean;
  confirm: boolean;
};

type LifecycleActionKind =
  | 'lifetime'
  | 'template'
  | 'boot'
  | 'reinstall'
  | 'clone'
  | 'swap'
  | 'replace'
  | 'migrate'
  | 'delete';

const lifecycleActionKinds = new Set<LifecycleActionKind>([
  'lifetime',
  'template',
  'boot',
  'reinstall',
  'clone',
  'swap',
  'replace',
  'migrate',
  'delete',
]);

function resourceId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  if (value && typeof value === 'object') {
    const raw = (value as any).id;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  }
  return null;
}

function parseOptionalId(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = parseLookupIdLike(trimmed);
  if (n === null || !Number.isInteger(n) || n <= 0) throw new Error('invalid-id');
  return n;
}

function parseRequiredId(raw: string): number {
  const n = parseOptionalId(raw);
  if (n === undefined) throw new Error('required-id');
  return n;
}

function parseOptionalNonNegativeInt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) throw new Error('invalid-id');
  return n;
}

const migrateWeekdayOptions = [
  { value: '0', labelKey: 'common.weekday.sun' },
  { value: '1', labelKey: 'common.weekday.mon' },
  { value: '2', labelKey: 'common.weekday.tue' },
  { value: '3', labelKey: 'common.weekday.wed' },
  { value: '4', labelKey: 'common.weekday.thu' },
  { value: '5', labelKey: 'common.weekday.fri' },
  { value: '6', labelKey: 'common.weekday.sat' },
] as const;

const migrateHourOptions = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, '0')}:00`,
}));

function defaultExpirationInput(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoDateTime(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  if (!Number.isFinite(d.getTime())) throw new Error('invalid-date');
  return d.toISOString();
}

function Field(props: { label: React.ReactNode; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted">{props.label}</div>
      <div className="mt-1">{props.children}</div>
      {props.help ? <div className="mt-1 text-xs text-faint">{props.help}</div> : null}
    </label>
  );
}

function templateLabel(tpl: OsTemplate): string {
  return String(tpl.label ?? tpl.name ?? `#${tpl.id}`);
}

function locationLabel(location: Location): string {
  return String(location.label ?? location.description ?? location.domain ?? `#${location.id}`);
}

function nodeLabel(vps: unknown): string {
  const node = vps && typeof vps === 'object' ? (vps as any).node : null;
  if (!node || typeof node !== 'object') return '—';
  return String(node.domain_name ?? node.name ?? node.label ?? `#${resourceId(node) ?? ''}`).trim() || '—';
}

function pickedNodeLabel(node: { id?: number; domain_name?: unknown; name?: unknown; fqdn?: unknown }): string {
  const name = String(node.domain_name ?? node.name ?? node.fqdn ?? '').trim();
  const id = typeof node.id === 'number' && Number.isFinite(node.id) ? `#${node.id}` : '';
  if (name && id) return `${name} (${id})`;
  return name || id || '';
}

function nodeLocation(node: Node | undefined): Location | undefined {
  const location = node?.location;
  return location && typeof location === 'object' ? location : undefined;
}

function ownerLabel(vps: unknown): string {
  const user = vps && typeof vps === 'object' ? (vps as any).user : null;
  if (!user || typeof user !== 'object') return '—';
  return String(user.login ?? user.label ?? `#${resourceId(user) ?? ''}`).trim() || '—';
}

function datasetLabel(vps: unknown): string {
  if (!vps || typeof vps !== 'object') return '—';
  const dataset = (vps as any).dataset ?? (vps as any).root_dataset;
  if (typeof dataset === 'string' && dataset.trim()) return dataset.trim();
  if (typeof dataset === 'number' && Number.isFinite(dataset)) return `#${dataset}`;
  if (dataset && typeof dataset === 'object') {
    return String(
      dataset.name ??
      dataset.full_name ??
      dataset.label ??
      dataset.dataset ??
      dataset.mountpoint ??
      `#${resourceId(dataset) ?? ''}`
    ).trim() || '—';
  }
  return '—';
}

function stateLabel(vps: unknown): string {
  if (!vps || typeof vps !== 'object') return '—';
  return String((vps as any).object_state ?? 'active').trim() || 'active';
}

function vpsLocationId(vps: unknown): number | null {
  if (!vps || typeof vps !== 'object') return null;
  return resourceId((vps as any).node?.location ?? (vps as any).location);
}

function vpsLocationLabel(vps: unknown): string {
  if (!vps || typeof vps !== 'object') return '—';
  const location = (vps as any).node?.location ?? (vps as any).location;
  if (!location || typeof location !== 'object') return vpsLocationId(vps) ? `#${vpsLocationId(vps)}` : '—';
  return String(location.label ?? location.description ?? location.domain ?? `#${resourceId(location) ?? ''}`).trim() || '—';
}

function resourceSummary(vps: unknown): string {
  if (!vps || typeof vps !== 'object') return '—';
  const row = vps as any;
  const cpu = row.cpu ?? row.cpus;
  const parts = [
    typeof cpu === 'number' ? `${cpu} vCPU` : null,
    row.memory !== undefined ? formatMiB(row.memory) : null,
    row.swap !== undefined ? `${formatMiB(row.swap)} swap` : null,
    row.diskspace !== undefined ? `${formatMiB(row.diskspace)} disk` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' / ') : '—';
}

function looksLikeSwapCandidate(vps: Vps): boolean {
  const text = `${String(vps.hostname ?? '')} ${String((vps as any).label ?? '')} ${vpsLocationLabel(vps)} ${nodeLabel(vps)}`.toLowerCase();
  return /\b(playground|pgnd|staging|stage|test|testing|dev)\b/.test(text);
}

function swapCandidateReasonKeys(candidate: Vps, source: Vps, sourceNodeId: number | null, sourceLocationId: number | null): string[] {
  const reasons: string[] = [];
  if (looksLikeSwapCandidate(candidate)) reasons.push('vps.lifecycle.swap.candidate.reason.environment');
  if (resourceId(candidate.user) === resourceId(source.user)) reasons.push('vps.lifecycle.swap.candidate.reason.owner');
  if (resourceId(candidate.node) === sourceNodeId) reasons.push('vps.lifecycle.swap.candidate.reason.node');
  if (vpsLocationId(candidate) === sourceLocationId) reasons.push('vps.lifecycle.swap.candidate.reason.location');
  if (String(candidate.object_state ?? 'active') === 'active') reasons.push('vps.lifecycle.swap.candidate.reason.active');
  return reasons;
}

function rankSwapCandidate(candidate: Vps, source: Vps, sourceNodeId: number | null, sourceLocationId: number | null): number {
  let score = 0;
  if (looksLikeSwapCandidate(candidate)) score += 50;
  if (resourceId(candidate.node) === sourceNodeId) score += 20;
  if (vpsLocationId(candidate) === sourceLocationId) score += 16;
  if (resourceId(candidate.user) === resourceId(source.user)) score += 10;
  if (String(candidate.object_state ?? 'active') === 'active') score += 4;
  return score;
}

function locationEnvironmentId(location: Location | undefined): number | undefined {
  const nested = location?.environment?.id;
  if (typeof nested === 'number' && Number.isFinite(nested)) return nested;

  const raw = location ? (location as any).environment_id : undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim());

  return undefined;
}

function vpsLabel(vps: unknown, fallbackId?: number | null): string {
  if (vps && typeof vps === 'object') {
    const row = vps as any;
    const id = resourceId(row) ?? fallbackId;
    const hostname = row.hostname ? String(row.hostname) : '';
    if (hostname && id) return `${hostname} (#${id})`;
    if (hostname) return hostname;
    if (row.label && id) return `${String(row.label)} (#${id})`;
    if (row.label) return String(row.label);
    if (id) return `#${id}`;
  }
  return fallbackId ? `#${fallbackId}` : '—';
}

function ipAddressText(ip: IpAddress): string {
  const addr = String(ip.addr ?? '').trim();
  const prefix = typeof ip.prefix === 'number' ? `/${ip.prefix}` : '';
  const role = ip.network?.role || ip.network?.purpose;
  return `${addr || `#${ip.id}`}${prefix}${role ? ` · ${String(role)}` : ''}`;
}

function IpList(props: { ips: IpAddress[] | undefined; loading: boolean; empty: string; loadingText: string; testId: string }) {
  if (props.loading) return <div className="text-sm text-muted">{props.loadingText}</div>;
  if (!props.ips?.length) return <div className="text-sm text-muted">{props.empty}</div>;
  return (
    <ul className="space-y-1 text-sm" data-testid={props.testId}>
      {props.ips.map((ip) => (
        <li key={ip.id} className="font-mono text-xs">
          {ipAddressText(ip)}
        </li>
      ))}
    </ul>
  );
}

function CompactValueList(props: { values: string[]; empty: string; testId: string }) {
  if (!props.values.length) return <span className="text-muted" data-testid={props.testId}>{props.empty}</span>;
  return (
    <span className="inline-flex flex-col gap-0.5" data-testid={props.testId}>
      {props.values.map((value) => (
        <span key={value} className="font-mono text-xs">
          {value}
        </span>
      ))}
    </span>
  );
}

function ImpactItem(props: { label: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3" data-testid={props.testId}>
      <div className="text-xs font-medium text-muted">{props.label}</div>
      <div className="mt-1 text-sm">{props.children}</div>
    </div>
  );
}

function mutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message && error.message !== 'invalid-id' && error.message !== 'required-id' && error.message !== 'invalid-date') {
    return error.message;
  }
  return fallback;
}

export function VpsLifecyclePage() {
  const { t } = useI18n();
  const { mode, basePath } = useAppMode();
  const chrome = useChrome();
  const navigate = useNavigate();
  const routeParams = useParams();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { vps, refetch, refetchChains, vpsRef, busyTransaction, busyLocalLock } = useVps();

  const vpsId = Number(vps.id);
  const objectLabel = String((vps as any).hostname ?? '') || `#${vpsId}`;
  const ownerId = resourceId((vps as any).user);
  const nodeId = resourceId((vps as any).node);
  const locationId = resourceId((vps as any).node?.location ?? (vps as any).location);
  const osTemplateId = resourceId((vps as any).os_template);
  const isAdminMode = mode === 'admin';
  const routeActionRaw = routeParams['lifecycleAction'];
  const requestedActionRaw = routeActionRaw ?? searchParams.get('action');
  const requestedAction = lifecycleActionKinds.has(requestedActionRaw as LifecycleActionKind)
    ? (requestedActionRaw as LifecycleActionKind)
    : null;
  const invalidAction = Boolean(routeActionRaw && !requestedAction);
  const templatesNeeded =
    isAdminMode ||
    requestedAction === 'template' ||
    requestedAction === 'boot' ||
    requestedAction === 'reinstall';

  const templatesQ = useQuery({
    queryKey: ['os_templates', 'vps-lifecycle', { limit: 500, enabled: true, hypervisorType: 'vpsadminos' }],
    queryFn: async () => (await fetchOsTemplates({ limit: 500, enabled: true, hypervisorType: 'vpsadminos' })).data,
    enabled: templatesNeeded,
    staleTime: 60_000,
  });

  const locationsQ = useQuery({
    queryKey: ['locations', 'vps-lifecycle', { limit: 500, hasHypervisor: true, hypervisorType: 'vpsadminos', includes: 'environment' }],
    queryFn: async () => (await fetchLocations({ limit: 500, hasHypervisor: true, hypervisorType: 'vpsadminos', includes: 'environment' })).data,
    enabled: !isAdminMode,
    staleTime: 60_000,
  });

  const nodesQ = useQuery({
    queryKey: ['nodes', 'vps-lifecycle-migrate', { limit: 500, includes: 'location__environment' }],
    queryFn: async () => (await fetchNodes({ limit: 500, includes: 'location__environment' })).data,
    enabled: isAdminMode && requestedAction === 'migrate',
    staleTime: 60_000,
  });

  const sourceIpsQ = useQuery({
    queryKey: ['ip_address', 'list', 'vps-lifecycle-source', { vpsId }],
    queryFn: async () => (await fetchIpAddressesForVps(vpsId, { limit: 100 })).data,
    staleTime: 30_000,
  });

  const [clone, setClone] = useState<CloneForm>(() => ({
    user: ownerId ? String(ownerId) : '',
    node: nodeId ? String(nodeId) : '',
    location: locationId ? String(locationId) : '',
    hostname: `${String((vps as any).hostname ?? `vps-${vpsId}`)}-${vpsId}-clone`,
    subdatasets: true,
    datasetPlans: true,
    resources: true,
    features: true,
    stop: true,
    confirm: false,
  }));

  const [swap, setSwap] = useState<SwapForm>({
    targetVps: null,
    hostname: true,
    resources: true,
    expirations: true,
    confirm: false,
  });
  const [replace, setReplace] = useState<ReplaceForm>(() => ({
    node: nodeId ? String(nodeId) : '',
    expirationDate: defaultExpirationInput(),
    start: false,
    reason: '',
    confirm: false,
  }));
  const [replaceNodeLabel, setReplaceNodeLabel] = useState('');
  const [migrateNodeLabel, setMigrateNodeLabel] = useState('');

  const [templateForm, setTemplateForm] = useState<TemplateForm>(() => ({
    osTemplate: osTemplateId ? String(osTemplateId) : '',
    autoUpdate: Boolean((vps as any).enable_os_template_auto_update),
    confirm: false,
  }));

  const [boot, setBoot] = useState<BootForm>(() => ({
    osTemplate: osTemplateId ? String(osTemplateId) : '',
    mountRootDataset: true,
    mountpoint: '/mnt/vps',
    confirm: false,
  }));

  const [reinstall, setReinstall] = useState<ReinstallForm>(() => ({
    osTemplate: osTemplateId ? String(osTemplateId) : '',
    confirm: false,
  }));

  const [migrate, setMigrate] = useState<MigrateForm>(() => ({
    node: '',
    replaceIpAddresses: false,
    transferIpAddresses: true,
    scheduleMode: 'maintenance',
    finishWeekday: '',
    finishHour: '',
    stopOnError: true,
    cleanupData: true,
    noStart: false,
    skipStart: false,
    sendMail: true,
    reason: '',
    confirm: false,
  }));

  const [deleteForm, setDeleteForm] = useState<DeleteForm>({
    lazy: true,
    confirm: false,
  });

  const targetVpsQ = useQuery({
    queryKey: ['vps', 'show', 'swap-target', { id: swap.targetVps ?? -1 }],
    queryFn: async () => (await fetchVps(swap.targetVps!, { includes: 'node__location,user' })).data,
    enabled: Boolean(swap.targetVps),
    staleTime: 30_000,
  });

  const swapCandidatesQ = useQuery({
    queryKey: ['vps', 'swap-candidates', { ownerId: ownerId ?? null, source: vpsId }],
    queryFn: async () => {
      const res = await fetchVpsList({
        limit: 50,
        user: ownerId ?? undefined,
      });
      return res.data
        .filter((candidate) => Number(candidate.id) !== vpsId)
        .sort((a, b) => {
          const byScore =
            rankSwapCandidate(b, vps as Vps, nodeId ?? null, locationId ?? null) -
            rankSwapCandidate(a, vps as Vps, nodeId ?? null, locationId ?? null);
          if (byScore !== 0) return byScore;
          return Number(a.id) - Number(b.id);
        })
        .slice(0, 6);
    },
    enabled: Boolean(ownerId),
    staleTime: 30_000,
  });

  const targetIpsQ = useQuery({
    queryKey: ['ip_address', 'list', 'vps-lifecycle-target', { vpsId: swap.targetVps ?? -1 }],
    queryFn: async () => (await fetchIpAddressesForVps(swap.targetVps!, { limit: 100 })).data,
    enabled: Boolean(swap.targetVps),
    staleTime: 30_000,
  });

  const cloneTargetReady = isAdminMode ? Boolean(clone.user.trim() && clone.node.trim()) : Boolean(clone.location.trim());
  const sourceLocation = ((vps as any).node?.location ?? (vps as any).location) as Location | undefined;
  const sourceLocationId = locationId;
  const sourceEnvironmentId = locationEnvironmentId(sourceLocation);
  const migrateNodeId = parseLookupIdLike(migrate.node.trim());
  const migrateTargetNode = migrateNodeId !== null
    ? nodesQ.data?.find((node) => Number(node.id) === migrateNodeId)
    : undefined;
  const migrateTargetLocation = nodeLocation(migrateTargetNode);
  const migrateTargetLocationId = resourceId(migrateTargetLocation);
  const migrateTargetEnvironmentId = locationEnvironmentId(migrateTargetLocation);
  const migrateCanTransferIpAddresses =
    sourceEnvironmentId !== undefined &&
    migrateTargetEnvironmentId !== undefined &&
    sourceEnvironmentId !== migrateTargetEnvironmentId;
  const migrateCanReplaceIpAddresses =
    sourceLocationId !== null &&
    migrateTargetLocationId !== null &&
    sourceLocationId !== migrateTargetLocationId;
  const migrateTargetSelected = Boolean(migrateTargetNode);
  const cloneLocationId = parseLookupIdLike(clone.location.trim());
  const cloneLocation = cloneLocationId !== null
    ? locationsQ.data?.find((location) => Number(location.id) === cloneLocationId)
    : undefined;
  const cloneEnvironmentId = locationEnvironmentId(cloneLocation);

  const preflight = async () => {
    await preflightVpsNotBusy({ vpsId, t, knownBusy: busyLocalLock || busyTransaction });
  };

  const track = (meta: unknown, labelKey: string) => {
    const asId = getMetaActionStateId(meta);
    if (asId !== undefined) {
      chrome.trackActionState(asId, { actionLabelKey: labelKey, objectLabel, object: vpsRef });
    }
    refetchChains();
    refetch();
  };

  const cloneM = useMutation({
    mutationFn: async () => {
      await preflight();

      const payload: VpsClonePayload = {
        hostname: clone.hostname.trim() || undefined,
        subdatasets: clone.subdatasets,
        dataset_plans: clone.datasetPlans,
        resources: clone.resources,
        features: clone.features,
        stop: clone.stop,
      };

      if (isAdminMode) {
        payload.user = parseRequiredId(clone.user);
        payload.node = parseRequiredId(clone.node);
      } else {
        payload.location = parseRequiredId(clone.location);
        if (cloneEnvironmentId !== undefined) payload.environment = cloneEnvironmentId;
      }

      return vpsClone(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.clone.label');
      const newId = Number((res.data as any)?.id);
      if (Number.isInteger(newId) && newId > 0) navigate(`${basePath}/vps/${newId}`);
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const swapM = useMutation({
    mutationFn: async () => {
      await preflight();
      if (!swap.targetVps) throw new Error('required-id');

      const payload: VpsSwapWithPayload = { vps: swap.targetVps };

      if (isAdminMode) {
        payload.hostname = swap.hostname;
        payload.resources = swap.resources;
        payload.expirations = swap.expirations;
      }

      return vpsSwapWith(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.swap.label');
      void qc.invalidateQueries({ queryKey: ['vps', vpsId] });
      setSwap((p) => ({ ...p, confirm: false }));
      chrome.openTasks();
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const replaceM = useMutation({
    mutationFn: async () => {
      await preflight();

      const payload: VpsReplacePayload = {
        node: parseOptionalId(replace.node),
        expiration_date: toIsoDateTime(replace.expirationDate),
        start: replace.start,
        reason: replace.reason.trim() || undefined,
      };

      return vpsReplace(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.replace.label');
      const newId = Number((res.data as any)?.id);
      if (Number.isInteger(newId) && newId > 0 && newId !== vpsId) navigate(`${basePath}/vps/${newId}`);
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const templateM = useMutation({
    mutationFn: async () => {
      await preflight();
      const payload: Record<string, unknown> = {
        os_template: parseRequiredId(templateForm.osTemplate),
        enable_os_template_auto_update: templateForm.autoUpdate,
      };
      return updateVps(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.template.label');
      void qc.invalidateQueries({ queryKey: ['vps', vpsId] });
      setTemplateForm((p) => ({ ...p, confirm: false }));
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const bootM = useMutation({
    mutationFn: async () => {
      await preflight();
      const payload: VpsBootPayload = {
        os_template: parseRequiredId(boot.osTemplate),
      };
      if (boot.mountRootDataset) {
        const mountpoint = boot.mountpoint.trim();
        if (!mountpoint || !mountpoint.startsWith('/')) throw new Error('invalid-id');
        payload.mount_root_dataset = mountpoint;
      }
      return vpsBoot(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.boot.label');
      setBoot((p) => ({ ...p, confirm: false }));
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const reinstallM = useMutation({
    mutationFn: async () => {
      await preflight();
      return vpsReinstall(vpsId, { os_template: parseRequiredId(reinstall.osTemplate) });
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.reinstall.label');
      setReinstall((p) => ({ ...p, confirm: false }));
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const migrateM = useMutation({
    mutationFn: async () => {
      await preflight();
      const finishWeekday = migrate.scheduleMode === 'custom' ? parseOptionalNonNegativeInt(migrate.finishWeekday) : undefined;
      const finishHour = migrate.scheduleMode === 'custom' ? parseOptionalNonNegativeInt(migrate.finishHour) : undefined;
      if (migrate.scheduleMode === 'custom' && (finishWeekday === undefined || finishHour === undefined || finishHour > 23)) {
        throw new Error('invalid-id');
      }
      const payload: VpsMigratePayload = {
        node: parseRequiredId(migrate.node),
        replace_ip_addresses: migrateCanReplaceIpAddresses ? migrate.replaceIpAddresses : false,
        transfer_ip_addresses: migrateCanTransferIpAddresses ? migrate.transferIpAddresses : false,
        maintenance_window: migrate.scheduleMode === 'maintenance',
        stop_on_error: migrate.stopOnError,
        cleanup_data: migrate.cleanupData,
        no_start: migrate.noStart,
        skip_start: migrate.skipStart,
        send_mail: migrate.sendMail,
      };
      if (finishWeekday !== undefined) payload.finish_weekday = finishWeekday;
      if (finishHour !== undefined) payload.finish_minutes = finishHour * 60;
      const reason = migrate.reason.trim();
      if (reason) payload.reason = reason;
      return vpsMigrate(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.migrate.label');
      setMigrate((p) => ({ ...p, confirm: false }));
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const deleteM = useMutation({
    mutationFn: async () => {
      await preflight();
      return vpsDelete(vpsId, isAdminMode ? { lazy: deleteForm.lazy } : undefined);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.delete.label');
      navigate(`${basePath}/vps`);
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const busyLocal =
    busyLocalLock ||
    cloneM.isPending ||
    swapM.isPending ||
    replaceM.isPending ||
    templateM.isPending ||
    bootM.isPending ||
    reinstallM.isPending ||
    migrateM.isPending ||
    deleteM.isPending;
  const gate = gateVpsMutation({ vps, busyLocal, busyTransaction });

  const sourceIps = sourceIpsQ.data ?? [];
  const targetIps = targetIpsQ.data ?? [];

  const cloneCard = (
    <Card testId="vps.lifecycle.clone">
      <CardBody className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {isAdminMode ? (
            <>
              <Field label={t('vps.lifecycle.field.owner')} help={t('vps.lifecycle.clone.owner_help')}>
                <UserLookupInput
                  value={clone.user}
                  onChange={(user) => setClone((prev) => ({ ...prev, user }))}
                  placeholder={t('vps.lifecycle.placeholder.user')}
                  testId="vps.lifecycle.clone.user"
                  disabled={cloneM.isPending}
                />
              </Field>
              <Field label={t('vps.lifecycle.field.node')} help={t('vps.lifecycle.clone.node_help')}>
                <NodeLookupInput
                  value={clone.node}
                  onChange={(node) => setClone((prev) => ({ ...prev, node }))}
                  placeholder={t('vps.lifecycle.placeholder.node')}
                  testId="vps.lifecycle.clone.node"
                  disabled={cloneM.isPending}
                />
              </Field>
            </>
          ) : (
            <Field label={t('vps.lifecycle.field.location')} help={t('vps.lifecycle.clone.location_help')}>
              <Select
                value={clone.location}
                onChange={(e) => setClone((prev) => ({ ...prev, location: e.target.value }))}
                disabled={cloneM.isPending || locationsQ.isLoading}
                testId="vps.lifecycle.clone.location"
              >
                <option value="">{t('vps.lifecycle.placeholder.location')}</option>
                {locationsQ.data?.map((location) => (
                  <option key={location.id} value={location.id}>
                    {locationLabel(location)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={t('vps.lifecycle.field.hostname')} help={t('vps.lifecycle.clone.hostname_help')}>
            <Input
              value={clone.hostname}
              onChange={(e) => setClone((prev) => ({ ...prev, hostname: e.target.value }))}
              testId="vps.lifecycle.clone.hostname"
              disabled={cloneM.isPending}
            />
          </Field>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Checkbox checked={clone.subdatasets} onChange={(v) => setClone((p) => ({ ...p, subdatasets: v }))} label={t('vps.lifecycle.clone.option.subdatasets')} testId="vps.lifecycle.clone.subdatasets" />
          <Checkbox checked={clone.datasetPlans} onChange={(v) => setClone((p) => ({ ...p, datasetPlans: v }))} label={t('vps.lifecycle.clone.option.dataset_plans')} testId="vps.lifecycle.clone.dataset_plans" />
          <Checkbox checked={clone.resources} onChange={(v) => setClone((p) => ({ ...p, resources: v }))} label={t('vps.lifecycle.clone.option.resources')} testId="vps.lifecycle.clone.resources" />
          <Checkbox checked={clone.features} onChange={(v) => setClone((p) => ({ ...p, features: v }))} label={t('vps.lifecycle.clone.option.features')} testId="vps.lifecycle.clone.features" />
          <Checkbox checked={clone.stop} onChange={(v) => setClone((p) => ({ ...p, stop: v }))} label={t('vps.lifecycle.clone.option.stop')} testId="vps.lifecycle.clone.stop" />
        </div>

        <Checkbox
          checked={clone.confirm}
          onChange={(v) => setClone((p) => ({ ...p, confirm: v }))}
          label={t('vps.lifecycle.confirm.clone')}
          testId="vps.lifecycle.clone.confirm"
        />

        {cloneM.isError ? (
          <Alert title={t('vps.lifecycle.clone.error')} variant="danger">
            {mutationErrorMessage(cloneM.error, t('vps.lifecycle.validation.clone'))}
          </Alert>
        ) : null}

        <div className="flex justify-end">
          <ActionButton
            variant="primary"
            testId="vps.lifecycle.clone.submit"
            disabled={!clone.confirm || !cloneTargetReady || !gate.allowed}
            disabledReason={!gate.allowed ? gate.reason : undefined}
            loading={cloneM.isPending}
            onClick={() => cloneM.mutate()}
          >
            {t('vps.lifecycle.clone.submit')}
          </ActionButton>
        </div>
      </CardBody>
    </Card>
  );

  const candidateRows = swapCandidatesQ.data ?? [];
  const likelyCandidateRows = candidateRows.filter((candidate) => looksLikeSwapCandidate(candidate));
  const selectedTarget = targetVpsQ.data;
  const targetLabel = targetVpsQ.isLoading ? t('common.loading') : targetVpsQ.isError ? `#${swap.targetVps}` : vpsLabel(selectedTarget, swap.targetVps);
  const selectedSourceIps = sourceIps.map(ipAddressText);
  const selectedTargetIps = targetIps.map(ipAddressText);
  const sourceHostnameAfter = isAdminMode && !swap.hostname ? vpsLabel(vps, vpsId) : targetLabel;
  const targetHostnameAfter = isAdminMode && !swap.hostname ? targetLabel : vpsLabel(vps, vpsId);
  const sourceResourcesAfter = isAdminMode && !swap.resources ? resourceSummary(vps) : resourceSummary(selectedTarget);
  const targetResourcesAfter = isAdminMode && !swap.resources ? resourceSummary(selectedTarget) : resourceSummary(vps);
  const sourceExpirationAfter =
    isAdminMode && !swap.expirations ? formatDateTime((vps as any).expiration_date) : formatDateTime((selectedTarget as any)?.expiration_date);
  const targetExpirationAfter =
    isAdminMode && !swap.expirations ? formatDateTime((selectedTarget as any)?.expiration_date) : formatDateTime((vps as any).expiration_date);
  const sourceDatasetAfter = selectedTarget ? datasetLabel(selectedTarget) : '—';
  const targetDatasetAfter = datasetLabel(vps);
  const selectedTargetIsLikely = Boolean(selectedTarget && looksLikeSwapCandidate(selectedTarget as Vps));
  const selectedTargetOwnerId = selectedTarget ? resourceId((selectedTarget as any).user) : null;
  const selectedTargetLocationId = selectedTarget ? vpsLocationId(selectedTarget) : null;
  const selectedTargetSameOwner = selectedTargetOwnerId !== null && ownerId !== null && selectedTargetOwnerId === ownerId;
  const selectedTargetSameLocation = selectedTargetLocationId !== null && locationId !== null && selectedTargetLocationId === locationId;
  const sourceIpCount = sourceIps.length;
  const targetIpCount = targetIps.length;

  const swapPreview = swap.targetVps ? (
    <div className="rounded-md border border-border bg-surface-2 p-3" data-testid="vps.lifecycle.swap.preview">
      <div className="text-sm font-medium">{t('vps.lifecycle.swap.preview.title')}</div>
      <div className="mt-1 text-xs text-faint">{t('vps.lifecycle.swap.preview.help')}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-xs font-medium text-muted">{t('vps.lifecycle.swap.preview.source')}</div>
          <div className="mt-1 text-sm font-medium" data-testid="vps.lifecycle.swap.preview.source_label">
            {vpsLabel(vps, vpsId)}
          </div>
          <dl className="mt-2 space-y-1 text-xs">
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.owner')}</dt><dd className="inline"> {ownerLabel(vps)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.node')}</dt><dd className="inline"> {nodeLabel(vps)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.location')}</dt><dd className="inline"> {vpsLocationLabel(vps)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.resources')}</dt><dd className="inline"> {resourceSummary(vps)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.dataset')}</dt><dd className="inline"> {datasetLabel(vps)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.expiration')}</dt><dd className="inline"> {formatDateTime((vps as any).expiration_date)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.state')}</dt><dd className="inline"> {stateLabel(vps)}</dd></div>
          </dl>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-xs font-medium text-muted">{t('vps.lifecycle.swap.preview.target')}</div>
          <div className="mt-1 text-sm font-medium" data-testid="vps.lifecycle.swap.preview.target_label">
            {targetLabel}
          </div>
          <dl className="mt-2 space-y-1 text-xs">
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.owner')}</dt><dd className="inline"> {ownerLabel(selectedTarget)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.node')}</dt><dd className="inline"> {nodeLabel(selectedTarget)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.location')}</dt><dd className="inline"> {vpsLocationLabel(selectedTarget)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.resources')}</dt><dd className="inline"> {resourceSummary(selectedTarget)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.dataset')}</dt><dd className="inline"> {datasetLabel(selectedTarget)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.expiration')}</dt><dd className="inline"> {formatDateTime((selectedTarget as any)?.expiration_date)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.state')}</dt><dd className="inline"> {stateLabel(selectedTarget)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="vps.lifecycle.swap.impact_summary">
        <ImpactItem label={t('vps.lifecycle.swap.impact.target_fit')} testId="vps.lifecycle.swap.impact.target_fit">
          {selectedTargetIsLikely
            ? t('vps.lifecycle.swap.impact.target_fit_likely')
            : t('vps.lifecycle.swap.impact.target_fit_manual')}
          {' '}
          {selectedTargetSameOwner ? t('vps.lifecycle.swap.impact.same_owner') : t('vps.lifecycle.swap.impact.owner_differs')}
          {' '}
          {selectedTargetSameLocation ? t('vps.lifecycle.swap.impact.same_location') : t('vps.lifecycle.swap.impact.location_differs')}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.swap.impact.network')} testId="vps.lifecycle.swap.impact.network">
          {t('vps.lifecycle.swap.impact.network_body', { source: sourceIpCount, target: targetIpCount })}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.swap.impact.dataset')} testId="vps.lifecycle.swap.impact.dataset">
          {t('vps.lifecycle.swap.impact.dataset_body', { source: datasetLabel(vps), target: datasetLabel(selectedTarget) })}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.swap.impact.options')} testId="vps.lifecycle.swap.impact.options">
          {isAdminMode
            ? t('vps.lifecycle.swap.preview.admin_options', {
                hostname: swap.hostname ? t('common.yes') : t('common.no'),
                resources: swap.resources ? t('common.yes') : t('common.no'),
                expirations: swap.expirations ? t('common.yes') : t('common.no'),
              })
            : t('vps.lifecycle.swap.preview.user_options')}
        </ImpactItem>
      </div>

      {targetVpsQ.isError || sourceIpsQ.isError || targetIpsQ.isError ? (
        <Alert className="mt-3" variant="warn" title={t('vps.lifecycle.swap.preview.partial_title')} testId="vps.lifecycle.swap.preview.partial">
          {t('vps.lifecycle.swap.preview.partial_body')}
        </Alert>
      ) : null}

      <div className="mt-3 overflow-hidden rounded-md border border-border bg-surface" data-testid="vps.lifecycle.swap.preview.after_table">
        <div className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted">
          <div>{t('vps.lifecycle.swap.preview.after_field')}</div>
          <div>{t('vps.lifecycle.swap.preview.after_source')}</div>
          <div>{t('vps.lifecycle.swap.preview.after_target')}</div>
        </div>
        {[
          [t('vps.lifecycle.swap.preview.hostname'), sourceHostnameAfter, targetHostnameAfter],
          [t('vps.lifecycle.swap.preview.owner'), ownerLabel(vps), ownerLabel(selectedTarget)],
          [t('vps.lifecycle.swap.preview.node'), nodeLabel(vps), nodeLabel(selectedTarget)],
          [t('vps.lifecycle.swap.preview.location'), vpsLocationLabel(vps), vpsLocationLabel(selectedTarget)],
          [t('vps.lifecycle.swap.preview.resources'), sourceResourcesAfter, targetResourcesAfter],
          [t('vps.lifecycle.swap.preview.dataset'), sourceDatasetAfter, targetDatasetAfter],
          [t('vps.lifecycle.swap.preview.expiration'), sourceExpirationAfter, targetExpirationAfter],
        ].map(([label, sourceValue, targetValue]) => (
          <div key={label} className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-border px-3 py-2 text-xs last:border-b-0">
            <div className="font-medium text-muted">{label}</div>
            <div className="min-w-0 pr-2">{sourceValue}</div>
            <div className="min-w-0">{targetValue}</div>
          </div>
        ))}
        <div className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] px-3 py-2 text-xs">
          <div className="font-medium text-muted">{t('vps.lifecycle.swap.preview.ip_assignments')}</div>
          <div className="min-w-0 pr-2">
            <CompactValueList values={selectedTargetIps} empty={t('vps.lifecycle.swap.preview.no_target_ips')} testId="vps.lifecycle.swap.preview.after_table.source_ips" />
          </div>
          <div className="min-w-0">
            <CompactValueList values={selectedSourceIps} empty={t('vps.lifecycle.swap.preview.no_source_ips')} testId="vps.lifecycle.swap.preview.after_table.target_ips" />
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-xs font-medium text-muted">{t('vps.lifecycle.swap.preview.source_after')}</div>
          <div className="mt-1 text-xs text-faint">{t('vps.lifecycle.swap.preview.source_after_help')}</div>
          <div className="mt-2">
            <IpList
              ips={targetIps}
              loading={targetIpsQ.isLoading}
              empty={t('vps.lifecycle.swap.preview.no_target_ips')}
              loadingText={t('common.loading')}
              testId="vps.lifecycle.swap.preview.source_ips_after"
            />
          </div>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-xs font-medium text-muted">{t('vps.lifecycle.swap.preview.target_after')}</div>
          <div className="mt-1 text-xs text-faint">{t('vps.lifecycle.swap.preview.target_after_help')}</div>
          <div className="mt-2">
            <IpList
              ips={sourceIps}
              loading={sourceIpsQ.isLoading}
              empty={t('vps.lifecycle.swap.preview.no_source_ips')}
              loadingText={t('common.loading')}
              testId="vps.lifecycle.swap.preview.target_ips_after"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-faint" data-testid="vps.lifecycle.swap.preview.options">
        {isAdminMode
          ? t('vps.lifecycle.swap.preview.admin_options', {
              hostname: swap.hostname ? t('common.yes') : t('common.no'),
              resources: swap.resources ? t('common.yes') : t('common.no'),
              expirations: swap.expirations ? t('common.yes') : t('common.no'),
            })
          : t('vps.lifecycle.swap.preview.user_options')}
      </div>
    </div>
  ) : (
    <Alert variant="neutral">{t('vps.lifecycle.swap.preview.empty')}</Alert>
  );

  const swapCard = (
    <Card testId="vps.lifecycle.swap">
      <CardBody className="space-y-4">
        <div className="text-sm text-muted">
          {isAdminMode ? t('vps.lifecycle.swap.subtitle') : t('vps.lifecycle.swap.subtitle_user')}
        </div>

        <div className="space-y-2" data-testid="vps.lifecycle.swap.candidates">
          <div className="text-xs font-medium text-muted">{t('vps.lifecycle.swap.candidates.title')}</div>
          {swapCandidatesQ.isLoading ? (
            <div className="text-sm text-muted">{t('common.loading')}</div>
          ) : likelyCandidateRows.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {likelyCandidateRows.map((candidate) => {
                const selected = Number(candidate.id) === swap.targetVps;
                const reasons = swapCandidateReasonKeys(candidate, vps as Vps, nodeId ?? null, locationId ?? null);
                return (
                  <button
                    type="button"
                    key={candidate.id}
                    className={[
                      'rounded-md border p-3 text-left text-sm hover:bg-surface-2',
                      selected ? 'border-border bg-surface-2 ring-2 ring-focus/35' : 'border-border bg-surface',
                    ].join(' ')}
                    onClick={() => setSwap((p) => ({ ...p, targetVps: Number(candidate.id), confirm: false }))}
                    data-testid={`vps.lifecycle.swap.candidate.${candidate.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{vpsLabel(candidate, candidate.id)}</div>
                      <span className="shrink-0 rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-muted" data-testid={`vps.lifecycle.swap.candidate.${candidate.id}.badge`}>
                        {selected ? t('vps.lifecycle.swap.candidate.selected') : t('vps.lifecycle.swap.candidate.badge')}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-faint">
                      {nodeLabel(candidate)} / {vpsLocationLabel(candidate)}
                    </div>
                    <div className="mt-1 text-xs text-faint">{resourceSummary(candidate)}</div>
                    <div className="mt-1 text-xs text-faint">
                      {t('vps.lifecycle.swap.preview.dataset')} {datasetLabel(candidate)}
                    </div>
                    <div className="mt-2 text-xs text-muted" data-testid={`vps.lifecycle.swap.candidate.${candidate.id}.reasons`}>
                      {reasons.map((reason) => t(reason)).join(' · ')}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <Alert variant="neutral" title={t('vps.lifecycle.swap.candidates.empty_title')}>
              {t('vps.lifecycle.swap.candidates.empty')}
            </Alert>
          )}
        </div>

        <Field label={t('vps.lifecycle.field.target_vps')} help={t('vps.lifecycle.swap.target_help')}>
          <VpsLookupInput
            value={swap.targetVps}
            onChange={(targetVps) => setSwap((prev) => ({ ...prev, targetVps, confirm: false }))}
            userId={ownerId ?? undefined}
            placeholder={t('vps.lifecycle.placeholder.vps')}
            testId="vps.lifecycle.swap.target"
            disabled={swapM.isPending}
          />
        </Field>

        {isAdminMode ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <Checkbox checked={swap.hostname} onChange={(v) => setSwap((p) => ({ ...p, hostname: v, confirm: false }))} label={t('vps.lifecycle.swap.option.hostname')} testId="vps.lifecycle.swap.hostname" />
            <Checkbox checked={swap.resources} onChange={(v) => setSwap((p) => ({ ...p, resources: v, confirm: false }))} label={t('vps.lifecycle.swap.option.resources')} testId="vps.lifecycle.swap.resources" />
            <Checkbox checked={swap.expirations} onChange={(v) => setSwap((p) => ({ ...p, expirations: v, confirm: false }))} label={t('vps.lifecycle.swap.option.expirations')} testId="vps.lifecycle.swap.expirations" />
          </div>
        ) : (
          <Alert variant="neutral">{t('vps.lifecycle.swap.user_options_hint')}</Alert>
        )}

        {swapPreview}

        <Alert variant="warn" title={t('vps.lifecycle.swap.warning_title')}>
          {t('vps.lifecycle.swap.warning_body')}
        </Alert>

        <Checkbox
          checked={swap.confirm}
          onChange={(v) => setSwap((p) => ({ ...p, confirm: v }))}
          label={t('vps.lifecycle.confirm.swap')}
          testId="vps.lifecycle.swap.confirm"
        />

        {swapM.isError ? (
          <Alert title={t('vps.lifecycle.swap.error')} variant="danger">
            {mutationErrorMessage(swapM.error, t('vps.lifecycle.validation.swap'))}
          </Alert>
        ) : null}

        <div className="flex justify-end">
          <ActionButton
            variant="danger"
            testId="vps.lifecycle.swap.submit"
            disabled={!swap.confirm || !swap.targetVps || !gate.allowed}
            disabledReason={!gate.allowed ? gate.reason : undefined}
            loading={swapM.isPending}
            onClick={() => swapM.mutate()}
          >
            {t('vps.lifecycle.swap.submit')}
          </ActionButton>
        </div>
      </CardBody>
    </Card>
  );

  const deleteCard = (
    <Card testId="vps.lifecycle.delete">
      <CardBody className="space-y-4">
        {!isAdminMode ? <Alert variant="neutral">{t('vps.lifecycle.user_delete.summary')}</Alert> : null}

        <Alert variant="danger" title={t('vps.lifecycle.delete.warning_title')}>
          {t('vps.lifecycle.delete.warning_body')}
        </Alert>

        {isAdminMode ? (
          <Checkbox
            checked={deleteForm.lazy}
            onChange={(v) => setDeleteForm((p) => ({ ...p, lazy: v }))}
            label={t('vps.lifecycle.delete.lazy')}
            description={t('vps.lifecycle.delete.lazy_help')}
            testId="vps.lifecycle.delete.lazy"
          />
        ) : null}
        <Checkbox
          checked={deleteForm.confirm}
          onChange={(v) => setDeleteForm((p) => ({ ...p, confirm: v }))}
          label={t('vps.lifecycle.confirm.delete')}
          testId="vps.lifecycle.delete.confirm"
        />

        {deleteM.isError ? (
          <Alert title={t('vps.lifecycle.delete.error')} variant="danger">
            {mutationErrorMessage(deleteM.error, t('vps.lifecycle.validation.delete'))}
          </Alert>
        ) : null}

        <div className="flex justify-end">
          <ActionButton
            variant="danger"
            testId="vps.lifecycle.delete.submit"
            disabled={!deleteForm.confirm || !gate.allowed}
            disabledReason={!gate.allowed ? gate.reason : undefined}
            loading={deleteM.isPending}
            onClick={() => deleteM.mutate()}
          >
            {t('vps.lifecycle.delete.submit')}
          </ActionButton>
        </div>
      </CardBody>
    </Card>
  );

  const lifecycleBasePath = `${basePath}/vps/${vpsId}/lifecycle`;
  const goToAction = (kind: LifecycleActionKind) => navigate(`${lifecycleBasePath}/${kind}`);
  const allActionChoices: Array<{
    kind: LifecycleActionKind;
    title: string;
    description: string;
    danger?: boolean;
    adminOnly?: boolean;
  }> = [
    { kind: 'reinstall', title: t('vps.lifecycle.reinstall.title'), description: t('vps.lifecycle.reinstall.subtitle'), danger: true },
    { kind: 'clone', title: t('vps.lifecycle.clone.title'), description: isAdminMode ? t('vps.lifecycle.clone.subtitle') : t('vps.lifecycle.clone.subtitle_user') },
    { kind: 'swap', title: t('vps.lifecycle.swap.title'), description: isAdminMode ? t('vps.lifecycle.swap.subtitle') : t('vps.lifecycle.swap.subtitle_user'), danger: true },
    { kind: 'delete', title: t('vps.lifecycle.delete.title'), description: t('vps.lifecycle.delete.subtitle'), danger: true },
    { kind: 'lifetime', title: t('vps.lifecycle.lifetime.title'), description: isAdminMode ? t('vps.lifecycle.lifetime.subtitle_admin') : t('vps.lifecycle.lifetime.subtitle_user'), adminOnly: true },
    { kind: 'template', title: t('vps.lifecycle.template.title'), description: t('vps.lifecycle.template.subtitle'), adminOnly: true },
    { kind: 'boot', title: t('vps.lifecycle.boot.title'), description: t('vps.lifecycle.boot.subtitle'), danger: true, adminOnly: true },
    { kind: 'replace', title: t('vps.lifecycle.replace.title'), description: t('vps.lifecycle.replace.subtitle'), danger: true, adminOnly: true },
    { kind: 'migrate', title: t('vps.lifecycle.migrate.title'), description: t('vps.lifecycle.migrate.subtitle'), adminOnly: true },
  ];
  const actionChoices = allActionChoices.filter((choice) => isAdminMode || !choice.adminOnly);
  const activeChoice = requestedAction ? actionChoices.find((choice) => choice.kind === requestedAction) : undefined;

  if (invalidAction || (requestedAction && !actionChoices.some((choice) => choice.kind === requestedAction))) {
    return (
      <div className="space-y-4" data-testid="vps.lifecycle.page">
        <Card testId="vps.lifecycle.summary">
          <CardHeader title={t('vps.lifecycle.title')} subtitle={t('vps.lifecycle.invalid_action')} />
          <CardBody>
            <Button variant="primary" onClick={() => navigate(lifecycleBasePath)}>
              {t('vps.lifecycle.back_to_actions')}
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!requestedAction) {
    return (
      <div className="space-y-4" data-testid="vps.lifecycle.page">
        <Card testId="vps.lifecycle.summary">
          <CardHeader title={t('vps.lifecycle.title')} subtitle={isAdminMode ? t('vps.lifecycle.subtitle_admin') : t('vps.lifecycle.subtitle_user')} />
          <CardBody className="space-y-4">
            <Alert variant="neutral">
              {isAdminMode ? t('vps.lifecycle.action_index.summary_admin') : t('vps.lifecycle.action_index.summary_user')}
            </Alert>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="vps.lifecycle.action_index">
              {actionChoices.map((choice) => (
                <button
                  key={choice.kind}
                  type="button"
                  className={[
                    'rounded-lg border bg-surface p-4 text-left shadow-card transition hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-focus',
                    choice.danger ? 'border-danger-border' : 'border-border',
                  ].join(' ')}
                  onClick={() => goToAction(choice.kind)}
                  data-testid={`vps.lifecycle.action_link.${choice.kind}`}
                >
                  <span className={choice.danger ? 'block text-sm font-semibold text-danger' : 'block text-sm font-semibold text-fg'}>
                    {choice.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted">{choice.description}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!isAdminMode) {
    return (
      <div className="space-y-4" data-testid="vps.lifecycle.page">
        <Card testId="vps.lifecycle.summary">
          <CardHeader
            title={activeChoice?.title ?? t('vps.lifecycle.title')}
            subtitle={activeChoice?.description ?? t('vps.lifecycle.subtitle_user')}
            actions={
              <Button variant="secondary" onClick={() => navigate(lifecycleBasePath)}>
                {t('vps.lifecycle.back_to_actions')}
              </Button>
            }
          />
          <CardBody>
            <Alert variant="neutral">{t('vps.lifecycle.user_lifecycle.summary')}</Alert>
          </CardBody>
        </Card>

        {requestedAction === 'lifetime' ? (
          <LifecyclePanel
            kind="vps"
            id={vps.id}
            objectLabel={objectLabel}
            objectState={(vps as any).object_state as any}
            expirationDate={(vps as any).expiration_date as any}
            remindAfterDate={(vps as any).remind_after_date as any}
            onUpdated={refetch}
            testId="vps.lifecycle.lifetime"
          />
        ) : null}

        {requestedAction === 'reinstall' ? (
          <Card testId="vps.lifecycle.reinstall">
            <CardBody className="space-y-4">
              <Alert variant="warn" title={t('vps.lifecycle.reinstall.warning_title')}>
                {t('vps.lifecycle.reinstall.warning_body')}
              </Alert>

              <Field label={t('vps.lifecycle.field.os_template')} help={t('vps.lifecycle.reinstall.os_template_help')}>
                <Select
                  value={reinstall.osTemplate}
                  onChange={(e) => setReinstall((prev) => ({ ...prev, osTemplate: e.target.value }))}
                  disabled={reinstallM.isPending || templatesQ.isLoading}
                  testId="vps.lifecycle.reinstall.os_template"
                >
                  <option value="">{t('vps.lifecycle.placeholder.os_template')}</option>
                  {templatesQ.data?.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {templateLabel(tpl)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Checkbox
                checked={reinstall.confirm}
                onChange={(v) => setReinstall((p) => ({ ...p, confirm: v }))}
                label={t('vps.lifecycle.confirm.reinstall')}
                testId="vps.lifecycle.reinstall.confirm"
              />

              {reinstallM.isError ? (
                <Alert title={t('vps.lifecycle.reinstall.error')} variant="danger">
                  {mutationErrorMessage(reinstallM.error, t('vps.lifecycle.validation.reinstall'))}
                </Alert>
              ) : null}

              <div className="flex justify-end">
                <ActionButton
                  variant="danger"
                  testId="vps.lifecycle.reinstall.submit"
                  disabled={!reinstall.confirm || !reinstall.osTemplate || !gate.allowed}
                  disabledReason={!gate.allowed ? gate.reason : undefined}
                  loading={reinstallM.isPending}
                  onClick={() => reinstallM.mutate()}
                >
                  {t('vps.lifecycle.reinstall.submit')}
                </ActionButton>
              </div>
            </CardBody>
          </Card>
        ) : null}

        {requestedAction === 'clone' ? cloneCard : null}

        {requestedAction === 'swap' ? swapCard : null}

        {requestedAction === 'delete' ? deleteCard : null}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="vps.lifecycle.page">
      <Card testId="vps.lifecycle.summary">
        <CardHeader
          title={activeChoice?.title ?? t('vps.lifecycle.title')}
          subtitle={activeChoice?.description ?? t('vps.lifecycle.subtitle_admin')}
          actions={
            <Button variant="secondary" onClick={() => navigate(lifecycleBasePath)}>
              {t('vps.lifecycle.back_to_actions')}
            </Button>
          }
        />
        <CardBody>
          <div className="mt-3 text-xs text-faint">
            {t('vps.lifecycle.current_target', {
              vps: `#${vpsId}`,
              node: nodeId ? `#${nodeId}` : '—',
              owner: ownerId ? `#${ownerId}` : '—',
              expiration: formatDateTime((vps as any).expiration_date),
            })}
          </div>
        </CardBody>
      </Card>

      {requestedAction === 'lifetime' ? (
        <LifecyclePanel
          kind="vps"
          id={vps.id}
          objectLabel={objectLabel}
          objectState={(vps as any).object_state as any}
          expirationDate={(vps as any).expiration_date as any}
          remindAfterDate={(vps as any).remind_after_date as any}
          onUpdated={refetch}
          testId="vps.lifecycle.lifetime"
        />
      ) : null}

      {requestedAction === 'template' ? (
        <Card testId="vps.lifecycle.template">
        <CardBody className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('vps.lifecycle.field.os_template')} help={t('vps.lifecycle.template.os_template_help')}>
              <Select
                value={templateForm.osTemplate}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, osTemplate: e.target.value }))}
                disabled={templateM.isPending || templatesQ.isLoading}
                testId="vps.lifecycle.template.os_template"
              >
                <option value="">{t('vps.lifecycle.placeholder.os_template')}</option>
                {templatesQ.data?.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {templateLabel(tpl)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Checkbox
                checked={templateForm.autoUpdate}
                onChange={(v) => setTemplateForm((p) => ({ ...p, autoUpdate: v }))}
                label={t('vps.lifecycle.template.auto_update')}
                description={t('vps.lifecycle.template.auto_update_help')}
                testId="vps.lifecycle.template.auto_update"
              />
            </div>
          </div>

          <Checkbox
            checked={templateForm.confirm}
            onChange={(v) => setTemplateForm((p) => ({ ...p, confirm: v }))}
            label={t('vps.lifecycle.confirm.template')}
            testId="vps.lifecycle.template.confirm"
          />

          {templateM.isError ? (
            <Alert title={t('vps.lifecycle.template.error')} variant="danger">
              {mutationErrorMessage(templateM.error, t('vps.lifecycle.validation.template'))}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <ActionButton
              variant="primary"
              testId="vps.lifecycle.template.submit"
              disabled={!templateForm.confirm || !templateForm.osTemplate || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={templateM.isPending}
              onClick={() => templateM.mutate()}
            >
              {t('vps.lifecycle.template.submit')}
            </ActionButton>
          </div>
        </CardBody>
        </Card>
      ) : null}

      {requestedAction === 'boot' ? (
        <Card testId="vps.lifecycle.boot">
        <CardBody className="space-y-4">
          <Alert variant="warn" title={t('vps.lifecycle.boot.warning_title')}>
            {t('vps.lifecycle.boot.warning_body')}
          </Alert>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('vps.lifecycle.field.os_template')} help={t('vps.lifecycle.boot.os_template_help')}>
              <Select
                value={boot.osTemplate}
                onChange={(e) => setBoot((prev) => ({ ...prev, osTemplate: e.target.value }))}
                disabled={bootM.isPending || templatesQ.isLoading}
                testId="vps.lifecycle.boot.os_template"
              >
                <option value="">{t('vps.lifecycle.placeholder.os_template')}</option>
                {templatesQ.data?.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {templateLabel(tpl)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('vps.lifecycle.boot.mountpoint')} help={t('vps.lifecycle.boot.mountpoint_help')}>
              <Input
                value={boot.mountpoint}
                onChange={(e) => setBoot((prev) => ({ ...prev, mountpoint: e.target.value }))}
                disabled={bootM.isPending || !boot.mountRootDataset}
                testId="vps.lifecycle.boot.mountpoint"
              />
            </Field>
          </div>

          <Checkbox
            checked={boot.mountRootDataset}
            onChange={(v) => setBoot((p) => ({ ...p, mountRootDataset: v }))}
            label={t('vps.lifecycle.boot.mount_root_dataset')}
            description={t('vps.lifecycle.boot.mount_root_dataset_help')}
            testId="vps.lifecycle.boot.mount_root_dataset"
          />

          <Checkbox
            checked={boot.confirm}
            onChange={(v) => setBoot((p) => ({ ...p, confirm: v }))}
            label={t('vps.lifecycle.confirm.boot')}
            testId="vps.lifecycle.boot.confirm"
          />

          {bootM.isError ? (
            <Alert title={t('vps.lifecycle.boot.error')} variant="danger">
              {mutationErrorMessage(bootM.error, t('vps.lifecycle.validation.boot'))}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <ActionButton
              variant="danger"
              testId="vps.lifecycle.boot.submit"
              disabled={!boot.confirm || !boot.osTemplate || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={bootM.isPending}
              onClick={() => bootM.mutate()}
            >
              {t('vps.lifecycle.boot.submit')}
            </ActionButton>
          </div>
        </CardBody>
        </Card>
      ) : null}

      {requestedAction === 'reinstall' ? (
        <Card testId="vps.lifecycle.reinstall">
        <CardBody className="space-y-4">
          <Alert variant="warn" title={t('vps.lifecycle.reinstall.warning_title')}>
            {t('vps.lifecycle.reinstall.warning_body')}
          </Alert>

          <Field label={t('vps.lifecycle.field.os_template')} help={t('vps.lifecycle.reinstall.os_template_help')}>
            <Select
              value={reinstall.osTemplate}
              onChange={(e) => setReinstall((prev) => ({ ...prev, osTemplate: e.target.value }))}
              disabled={reinstallM.isPending || templatesQ.isLoading}
              testId="vps.lifecycle.reinstall.os_template"
            >
              <option value="">{t('vps.lifecycle.placeholder.os_template')}</option>
              {templatesQ.data?.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {templateLabel(tpl)}
                </option>
              ))}
            </Select>
          </Field>

          <Checkbox
            checked={reinstall.confirm}
            onChange={(v) => setReinstall((p) => ({ ...p, confirm: v }))}
            label={t('vps.lifecycle.confirm.reinstall')}
            testId="vps.lifecycle.reinstall.confirm"
          />

          {reinstallM.isError ? (
            <Alert title={t('vps.lifecycle.reinstall.error')} variant="danger">
              {mutationErrorMessage(reinstallM.error, t('vps.lifecycle.validation.reinstall'))}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <ActionButton
              variant="danger"
              testId="vps.lifecycle.reinstall.submit"
              disabled={!reinstall.confirm || !reinstall.osTemplate || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={reinstallM.isPending}
              onClick={() => reinstallM.mutate()}
            >
              {t('vps.lifecycle.reinstall.submit')}
            </ActionButton>
          </div>
        </CardBody>
        </Card>
      ) : null}

      {requestedAction === 'clone' ? cloneCard : null}

      {requestedAction === 'swap' ? swapCard : null}

      {requestedAction === 'replace' ? (
        <Card testId="vps.lifecycle.replace">
        <CardBody className="space-y-4">
          <Alert variant="warn" title={t('vps.lifecycle.replace.warning_title')}>
            {t('vps.lifecycle.replace.warning_body')}
          </Alert>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('vps.lifecycle.field.node')} help={t('vps.lifecycle.replace.node_help')}>
              <NodeLookupInput
                value={replace.node}
                selectedLabel={replaceNodeLabel}
                onChange={(node) => {
                  setReplaceNodeLabel('');
                  setReplace((prev) => ({ ...prev, node }));
                }}
                onPick={(node) => setReplaceNodeLabel(pickedNodeLabel(node))}
                placeholder={t('vps.lifecycle.placeholder.node_optional')}
                testId="vps.lifecycle.replace.node"
                disabled={replaceM.isPending}
              />
            </Field>
            <Field label={t('vps.lifecycle.field.expiration_date')} help={t('vps.lifecycle.replace.expiration_help')}>
              <Input
                type="datetime-local"
                value={replace.expirationDate}
                onChange={(e) => setReplace((prev) => ({ ...prev, expirationDate: e.target.value }))}
                testId="vps.lifecycle.replace.expiration"
                disabled={replaceM.isPending}
              />
            </Field>
          </div>

          <Checkbox
            checked={replace.start}
            onChange={(v) => setReplace((p) => ({ ...p, start: v }))}
            label={t('vps.lifecycle.replace.start')}
            description={t('vps.lifecycle.replace.start_help')}
            testId="vps.lifecycle.replace.start"
          />

          <Field label={t('vps.lifecycle.field.reason')} help={t('vps.lifecycle.replace.reason_help')}>
            <Textarea
              rows={3}
              value={replace.reason}
              onChange={(e) => setReplace((prev) => ({ ...prev, reason: e.target.value }))}
              testId="vps.lifecycle.replace.reason"
              disabled={replaceM.isPending}
            />
          </Field>

          <Checkbox
            checked={replace.confirm}
            onChange={(v) => setReplace((p) => ({ ...p, confirm: v }))}
            label={t('vps.lifecycle.confirm.replace')}
            testId="vps.lifecycle.replace.confirm"
          />

          {replaceM.isError ? (
            <Alert title={t('vps.lifecycle.replace.error')} variant="danger">
              {mutationErrorMessage(replaceM.error, t('vps.lifecycle.validation.replace'))}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <ActionButton
              variant="danger"
              testId="vps.lifecycle.replace.submit"
              disabled={!replace.confirm || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={replaceM.isPending}
              onClick={() => replaceM.mutate()}
            >
              {t('vps.lifecycle.replace.submit')}
            </ActionButton>
          </div>
        </CardBody>
        </Card>
      ) : null}

      {requestedAction === 'migrate' ? (
        <Card testId="vps.lifecycle.migrate">
        <CardBody className="space-y-4">
          <Field label={t('vps.lifecycle.field.node')} help={t('vps.lifecycle.migrate.node_help')}>
            <NodeLookupInput
              value={migrate.node}
              selectedLabel={migrateNodeLabel}
              onChange={(value) => {
                setMigrateNodeLabel('');
                const nextNodeId = parseLookupIdLike(value);
                const nextNode = nextNodeId !== null
                  ? nodesQ.data?.find((node) => Number(node.id) === nextNodeId)
                  : undefined;
                const nextLocation = nodeLocation(nextNode);
                const nextLocationId = resourceId(nextLocation);
                const nextEnvironmentId = locationEnvironmentId(nextLocation);
                const nextChangedLocation = sourceLocationId !== null && nextLocationId !== null && sourceLocationId !== nextLocationId;
                const nextChangedEnvironment =
                  sourceEnvironmentId !== undefined &&
                  nextEnvironmentId !== undefined &&
                  sourceEnvironmentId !== nextEnvironmentId;

                setMigrate((prev) => ({
                  ...prev,
                  node: value,
                  transferIpAddresses: nextChangedEnvironment ? prev.transferIpAddresses : false,
                  replaceIpAddresses: nextChangedLocation ? prev.replaceIpAddresses : false,
                  scheduleMode: nextChangedEnvironment || nextChangedLocation ? 'now' : 'maintenance',
                  confirm: false,
                }));
              }}
              onPick={(node) => setMigrateNodeLabel(pickedNodeLabel(node))}
              placeholder={t('vps.lifecycle.placeholder.node')}
              loadingLabel={t('common.loading')}
              noResultsLabel={t('vps.lifecycle.migrate.no_nodes')}
              testId="vps.lifecycle.migrate.node"
              disabled={migrateM.isPending || nodesQ.isError}
            />
            {nodesQ.isError ? (
              <div className="mt-1 text-xs text-danger">{t('vps.lifecycle.migrate.nodes_load_error')}</div>
            ) : null}
          </Field>

          <div className="rounded-md border border-border bg-surface p-3" data-testid="vps.lifecycle.migrate.schedule_panel">
            <div className="mb-3">
              <div className="text-sm font-semibold text-fg">{t('vps.lifecycle.migrate.schedule.title')}</div>
              <div className="text-xs text-muted">{t('vps.lifecycle.migrate.schedule.subtitle')}</div>
            </div>
            <div className="space-y-3">
              <Field label={t('vps.lifecycle.migrate.schedule.label')} help={t('vps.lifecycle.migrate.schedule.help')}>
                <Select
                  value={migrate.scheduleMode}
                  onChange={(e) =>
                    setMigrate((prev) => ({
                      ...prev,
                      scheduleMode: e.target.value as MigrateForm['scheduleMode'],
                      confirm: false,
                    }))
                  }
                  testId="vps.lifecycle.migrate.schedule"
                  disabled={migrateM.isPending}
                >
                  <option value="maintenance">{t('vps.lifecycle.migrate.schedule.maintenance')}</option>
                  <option value="now">{t('vps.lifecycle.migrate.schedule.now')}</option>
                  <option value="custom">{t('vps.lifecycle.migrate.schedule.custom')}</option>
                </Select>
              </Field>

              {migrate.scheduleMode === 'custom' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label={t('vps.lifecycle.migrate.finish_weekday')} help={t('vps.lifecycle.migrate.finish_weekday_help')}>
                    <Select
                      value={migrate.finishWeekday}
                      onChange={(e) => setMigrate((prev) => ({ ...prev, finishWeekday: e.target.value, confirm: false }))}
                      testId="vps.lifecycle.migrate.finish_weekday"
                      disabled={migrateM.isPending}
                    >
                      <option value="">{t('vps.lifecycle.migrate.schedule.choose_day')}</option>
                      {migrateWeekdayOptions.map((day) => (
                        <option key={day.value} value={day.value}>
                          {t(day.labelKey)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('vps.lifecycle.migrate.finish_hour')} help={t('vps.lifecycle.migrate.finish_hour_help')}>
                    <Select
                      value={migrate.finishHour}
                      onChange={(e) => setMigrate((prev) => ({ ...prev, finishHour: e.target.value, confirm: false }))}
                      testId="vps.lifecycle.migrate.finish_hour"
                      disabled={migrateM.isPending}
                    >
                      <option value="">{t('vps.lifecycle.migrate.schedule.choose_hour')}</option>
                      {migrateHourOptions.map((hour) => (
                        <option key={hour.value} value={hour.value}>
                          {hour.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {migrateTargetSelected && migrateCanTransferIpAddresses ? (
              <Checkbox checked={migrate.transferIpAddresses} onChange={(v) => setMigrate((p) => ({ ...p, transferIpAddresses: v, confirm: false }))} label={t('vps.lifecycle.migrate.option.transfer_ip_addresses')} testId="vps.lifecycle.migrate.transfer_ip_addresses" />
            ) : null}
            {migrateTargetSelected && migrateCanReplaceIpAddresses ? (
              <Checkbox checked={migrate.replaceIpAddresses} onChange={(v) => setMigrate((p) => ({ ...p, replaceIpAddresses: v, confirm: false }))} label={t('vps.lifecycle.migrate.option.replace_ip_addresses')} testId="vps.lifecycle.migrate.replace_ip_addresses" />
            ) : null}
            <Checkbox checked={migrate.stopOnError} onChange={(v) => setMigrate((p) => ({ ...p, stopOnError: v, confirm: false }))} label={t('vps.lifecycle.migrate.option.stop_on_error')} testId="vps.lifecycle.migrate.stop_on_error" />
            <Checkbox checked={migrate.cleanupData} onChange={(v) => setMigrate((p) => ({ ...p, cleanupData: v, confirm: false }))} label={t('vps.lifecycle.migrate.option.cleanup_data')} testId="vps.lifecycle.migrate.cleanup_data" />
            <Checkbox checked={migrate.sendMail} onChange={(v) => setMigrate((p) => ({ ...p, sendMail: v, confirm: false }))} label={t('vps.lifecycle.migrate.option.send_mail')} testId="vps.lifecycle.migrate.send_mail" />
          </div>

          <details className="rounded-md border border-border bg-surface p-3" data-testid="vps.lifecycle.migrate.advanced">
            <summary className="cursor-pointer text-sm font-semibold text-fg">{t('vps.lifecycle.migrate.advanced.title')}</summary>
            <div className="mt-3 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Checkbox checked={migrate.noStart} onChange={(v) => setMigrate((p) => ({ ...p, noStart: v, confirm: false }))} label={t('vps.lifecycle.migrate.option.no_start')} testId="vps.lifecycle.migrate.no_start" />
                <Checkbox checked={migrate.skipStart} onChange={(v) => setMigrate((p) => ({ ...p, skipStart: v, confirm: false }))} label={t('vps.lifecycle.migrate.option.skip_start')} testId="vps.lifecycle.migrate.skip_start" />
              </div>
              <Field label={t('vps.lifecycle.migrate.reason')} help={t('vps.lifecycle.migrate.reason_help')}>
                <Textarea
                  value={migrate.reason}
                  onChange={(e) => setMigrate((prev) => ({ ...prev, reason: e.target.value, confirm: false }))}
                  testId="vps.lifecycle.migrate.reason"
                  disabled={migrateM.isPending}
                />
              </Field>
            </div>
          </details>

          <Checkbox
            checked={migrate.confirm}
            onChange={(v) => setMigrate((p) => ({ ...p, confirm: v }))}
            label={t('vps.lifecycle.confirm.migrate')}
            testId="vps.lifecycle.migrate.confirm"
          />

          {migrateM.isError ? (
            <Alert title={t('vps.lifecycle.migrate.error')} variant="danger">
              {mutationErrorMessage(migrateM.error, t('vps.lifecycle.validation.migrate'))}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <ActionButton
              variant="danger"
              testId="vps.lifecycle.migrate.submit"
              disabled={
                !migrate.confirm ||
                !migrate.node.trim() ||
                (migrate.scheduleMode === 'custom' && (!migrate.finishWeekday || !migrate.finishHour)) ||
                !gate.allowed
              }
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={migrateM.isPending}
              onClick={() => migrateM.mutate()}
            >
              {t('vps.lifecycle.migrate.submit')}
            </ActionButton>
          </div>
        </CardBody>
        </Card>
      ) : null}

      {requestedAction === 'delete' ? deleteCard : null}
    </div>
  );
}
