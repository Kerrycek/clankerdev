import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useChrome } from '../../../components/layout/ChromeContext';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Select, type SelectOption } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';
import { fetchDnsResolvers, type DnsResolver } from '../../../lib/api/dnsResolvers';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { fetchUserNamespaceMaps, type UserNamespaceMap } from '../../../lib/api/userNamespaces';
import { updateVps } from '../../../lib/api/vps';
import { gateVpsMutation } from '../../../lib/gates/vps';
import { preflightVpsNotBusy } from './vpsPreflight';
import { useVps } from './VpsContext';

type HostnameMode = 'managed' | 'manual';
type CgroupVersion = 'cgroup_any' | 'cgroup_v1' | 'cgroup_v2';
type AdminLockType = 'no_lock' | 'absolute' | 'not_less' | 'not_more';

type Draft = {
  hostnameMode: HostnameMode;
  hostname: string;
  user: string;
  cpu: string;
  cpuLimit: string;
  memory: string;
  swap: string;
  dnsResolver: string;
  userNamespaceMap: string;
  autostartPriority: string;
  startMenuTimeout: string;
  cgroupVersion: CgroupVersion;
  allowAdminModifications: boolean;
  changeReason: string;
  adminOverride: boolean;
  adminLockType: string;
};

type BuildResult = {
  payload: Record<string, unknown>;
  validationError: string | null;
  changedKeys: string[];
  sensitive: boolean;
};

const CGROUP_VERSIONS: readonly CgroupVersion[] = ['cgroup_any', 'cgroup_v1', 'cgroup_v2'];
const ADMIN_LOCK_TYPES: readonly AdminLockType[] = ['no_lock', 'absolute', 'not_less', 'not_more'];
const START_MENU_TIMEOUT_MAX = 24 * 60 * 60;

function resourceId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  if (value && typeof value === 'object') {
    const raw = (value as LegacyAny).id;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  }
  return null;
}

function numericText(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (value === true) return true;
  if (value === false) return false;
  return fallback;
}

function cgroupVersionText(value: unknown): CgroupVersion {
  if (typeof value === 'string' && CGROUP_VERSIONS.includes(value as CgroupVersion)) return value as CgroupVersion;
  return 'cgroup_any';
}

function normalizeDraft(vps: any): Draft {
  return {
    hostnameMode: vps.manage_hostname === false ? 'manual' : 'managed',
    hostname: String(vps.hostname ?? ''),
    user: numericText(resourceId(vps.user)),
    cpu: numericText(vps.cpu),
    cpuLimit: numericText(vps.cpu_limit),
    memory: numericText(vps.memory),
    swap: numericText(vps.swap),
    dnsResolver: numericText(resourceId(vps.dns_resolver)),
    userNamespaceMap: numericText(resourceId(vps.user_namespace_map)),
    autostartPriority: numericText(vps.autostart_priority),
    startMenuTimeout: numericText(vps.start_menu_timeout),
    cgroupVersion: cgroupVersionText(vps.cgroup_version),
    allowAdminModifications: booleanValue(vps.allow_admin_modifications, false),
    changeReason: '',
    adminOverride: false,
    adminLockType: '',
  };
}

function parseInteger(raw: string, label: string, t: (key: string, vars?: Record<string, unknown>) => string, opts?: { min?: number; max?: number }): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value)) {
    throw new Error(t('vps.config.validation.integer', { field: label }));
  }
  if (opts?.min !== undefined && value < opts.min) {
    throw new Error(t('vps.config.validation.min', { field: label, min: opts.min }));
  }
  if (opts?.max !== undefined && value > opts.max) {
    throw new Error(t('vps.config.validation.max', { field: label, max: opts.max }));
  }
  return value;
}

function parseRequiredId(raw: string, label: string, t: (key: string, vars?: Record<string, unknown>) => string): number {
  const value = parseInteger(raw, label, t, { min: 1 });
  if (value === null) {
    throw new Error(t('vps.config.validation.required', { field: label }));
  }
  return value;
}

function setChangedInt(args: {
  payload: Record<string, unknown>;
  changedKeys: string[];
  key: string;
  draftValue: string;
  baselineValue: string;
  label: string;
  t: (key: string, vars?: Record<string, unknown>) => string;
  min?: number;
  max?: number;
  allowNull?: boolean;
}): void {
  const raw = args.draftValue.trim();
  const baseRaw = args.baselineValue.trim();
  if (raw === baseRaw) return;

  const parsed = parseInteger(raw, args.label, args.t, { min: args.min, max: args.max });
  if (parsed === null) {
    if (!args.allowNull) {
      throw new Error(args.t('vps.config.validation.required', { field: args.label }));
    }
    args.payload[args.key] = null;
  } else {
    args.payload[args.key] = parsed;
  }
  args.changedKeys.push(args.key);
}

function currentResourceLabel(value: unknown, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return `#${value}`;
  if (typeof value === 'object') {
    const obj = value as LegacyAny;
    return String(obj.label ?? obj.name ?? obj.login ?? obj.ip_addr ?? (obj.id ? `#${obj.id}` : fallback));
  }
  return fallback;
}

function dnsResolverLabel(resolver: DnsResolver): string {
  const label = String(resolver.label ?? '').trim();
  const ip = String(resolver.ip_addr ?? '').trim();
  if (label && ip) return `${label} · ${ip}`;
  return label || ip || `#${resolver.id}`;
}

function userNamespaceMapLabel(map: UserNamespaceMap): string {
  const label = String(map.label ?? '').trim();
  const ns = map.user_namespace as LegacyAny;
  const nsLabel = currentResourceLabel(ns, '');
  return [label || `#${map.id}`, nsLabel && nsLabel !== '—' ? nsLabel : ''].filter(Boolean).join(' · ');
}

function ensureCurrentOption(options: SelectOption[], currentId: string, currentLabel: string): SelectOption[] {
  if (!currentId) return options;
  if (options.some((option) => option.value === currentId)) return options;
  return [...options, { value: currentId, label: currentLabel }];
}

function buildPayload(args: {
  baseline: Draft;
  draft: Draft;
  vps: any;
  isAdminMode: boolean;
  t: (key: string, vars?: Record<string, unknown>) => string;
}): BuildResult {
  const payload: Record<string, unknown> = {};
  const changedKeys: string[] = [];
  const sensitiveKeys = new Set(['user', 'user_namespace_map', 'cgroup_version', 'allow_admin_modifications']);
  const { baseline, draft, isAdminMode, t } = args;

  const hostname = draft.hostname.trim();
  if (draft.hostnameMode !== baseline.hostnameMode) {
    if (draft.hostnameMode === 'manual') {
      payload['manage_hostname'] = false;
      changedKeys.push('manage_hostname');
    } else {
      if (!hostname) throw new Error(t('vps.config.validation.required', { field: t('vps.config.field.hostname') }));
      payload['manage_hostname'] = true;
      payload['hostname'] = hostname;
      changedKeys.push('manage_hostname', 'hostname');
    }
  } else if (draft.hostnameMode === 'managed' && hostname !== baseline.hostname.trim()) {
    if (!hostname) throw new Error(t('vps.config.validation.required', { field: t('vps.config.field.hostname') }));
    payload['hostname'] = hostname;
    changedKeys.push('hostname');
  }

  if (isAdminMode && draft.user.trim() !== baseline.user.trim()) {
    payload['user'] = parseRequiredId(draft.user, t('vps.config.field.owner'), t);
    changedKeys.push('user');
  }

  setChangedInt({
    payload,
    changedKeys,
    key: 'cpu',
    draftValue: draft.cpu,
    baselineValue: baseline.cpu,
    label: t('vps.config.field.cpu'),
    t,
    min: 1,
  });
  if (isAdminMode) {
    setChangedInt({
      payload,
      changedKeys,
      key: 'cpu_limit',
      draftValue: draft.cpuLimit,
      baselineValue: baseline.cpuLimit,
      label: t('vps.config.field.cpu_limit'),
      t,
      min: 0,
      allowNull: true,
    });
  }
  setChangedInt({
    payload,
    changedKeys,
    key: 'memory',
    draftValue: draft.memory,
    baselineValue: baseline.memory,
    label: t('vps.config.field.memory'),
    t,
    min: 1,
  });
  setChangedInt({
    payload,
    changedKeys,
    key: 'swap',
    draftValue: draft.swap,
    baselineValue: baseline.swap,
    label: t('vps.config.field.swap'),
    t,
    min: 0,
  });

  if (draft.dnsResolver.trim() !== baseline.dnsResolver.trim()) {
    const next = draft.dnsResolver.trim() ? parseRequiredId(draft.dnsResolver, t('vps.config.field.dns_resolver'), t) : null;
    payload['dns_resolver'] = next;
    changedKeys.push('dns_resolver');
  }

  if (draft.userNamespaceMap.trim() !== baseline.userNamespaceMap.trim()) {
    payload['user_namespace_map'] = parseRequiredId(draft.userNamespaceMap, t('vps.config.field.user_namespace_map'), t);
    changedKeys.push('user_namespace_map');
  }

  if (isAdminMode) {
    setChangedInt({
      payload,
      changedKeys,
      key: 'autostart_priority',
      draftValue: draft.autostartPriority,
      baselineValue: baseline.autostartPriority,
      label: t('vps.config.field.autostart_priority'),
      t,
      min: 0,
    });
  }
  setChangedInt({
    payload,
    changedKeys,
    key: 'start_menu_timeout',
    draftValue: draft.startMenuTimeout,
    baselineValue: baseline.startMenuTimeout,
    label: t('vps.config.field.start_menu_timeout'),
    t,
    min: 0,
    max: START_MENU_TIMEOUT_MAX,
  });

  if (draft.cgroupVersion !== baseline.cgroupVersion) {
    if (!CGROUP_VERSIONS.includes(draft.cgroupVersion)) {
      throw new Error(t('vps.config.validation.enum', { field: t('vps.config.field.cgroup_version') }));
    }
    payload['cgroup_version'] = draft.cgroupVersion;
    changedKeys.push('cgroup_version');
  }

  if (draft.allowAdminModifications !== baseline.allowAdminModifications) {
    payload['allow_admin_modifications'] = draft.allowAdminModifications;
    changedKeys.push('allow_admin_modifications');
  }

  const ownerChanged = Object.prototype.hasOwnProperty.call(payload, 'user');
  const namespaceMapChanged = Object.prototype.hasOwnProperty.call(payload, 'user_namespace_map');
  const resourceChanged = ['cpu', 'cpu_limit', 'memory', 'swap'].some((key) => Object.prototype.hasOwnProperty.call(payload, key));
  if (ownerChanged && resourceChanged) {
    throw new Error(t('vps.config.validation.owner_resources'));
  }
  if (ownerChanged && namespaceMapChanged) {
    throw new Error(t('vps.config.validation.owner_namespace_map'));
  }

  if (isAdminMode && resourceChanged) {
    const reason = draft.changeReason.trim();
    if (reason) payload['change_reason'] = reason;
    if (draft.adminOverride) payload['admin_override'] = true;
    const lockType = draft.adminLockType.trim();
    if (lockType) {
      if (!ADMIN_LOCK_TYPES.includes(lockType as AdminLockType)) {
        throw new Error(t('vps.config.validation.enum', { field: t('vps.config.field.admin_lock_type') }));
      }
      payload['admin_lock_type'] = lockType;
    }
  }

  return {
    payload,
    validationError: null,
    changedKeys,
    sensitive: changedKeys.some((key) => sensitiveKeys.has(key)),
  };
}

function Field(props: { label: React.ReactNode; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <div className="text-sm font-medium text-fg">{props.label}</div>
      {props.children}
      {props.help ? <div className="text-xs text-muted">{props.help}</div> : null}
    </label>
  );
}

export function VpsConfigurationPage() {
  const { mode } = useAppMode();
  const isAdminMode = mode === 'admin';
  const chrome = useChrome();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { vps, refetch, refetchChains, vpsRef, busyTransaction, busyLocalLock } = useVps();
  const vpsId = Number(vps.id);
  const objectLabel = String((vps as LegacyAny).hostname ?? '') || `#${vpsId}`;

  const baseline = useMemo(() => normalizeDraft(vps), [vps]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const effective = draft ?? baseline;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const patchDraft = (patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...(prev ?? baseline), ...patch }));
  };

  const dnsResolversQ = useQuery({
    queryKey: ['dns_resolver', 'list', { limit: 250 }],
    queryFn: async () => (await fetchDnsResolvers({ limit: 250 })).data,
    refetchOnWindowFocus: false,
  });

  const ownerId = resourceId((vps as LegacyAny).user) ?? undefined;
  const userNamespaceMapsQ = useQuery({
    queryKey: ['user_namespace_map', 'list', { limit: 250, userId: ownerId ?? null }],
    queryFn: async () => (await fetchUserNamespaceMaps({ limit: 250, userId: ownerId })).data,
    refetchOnWindowFocus: false,
  });

  const result = useMemo<BuildResult>(() => {
    try {
      return buildPayload({ baseline, draft: effective, vps, isAdminMode, t });
    } catch (e: any) {
      return { payload: {}, validationError: String(e?.message ?? e), changedKeys: [], sensitive: false };
    }
  }, [baseline, effective, isAdminMode, t, vps]);

  const saveM = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      return updateVps(vpsId, payload);
    },
    onMutate: () => {
      chrome.acquireLocalLock(vpsRef);
    },
    onSuccess: (res) => {
      setDraft(null);
      setConfirmOpen(false);
      void qc.invalidateQueries({ queryKey: ['vps', 'show', { id: vpsId }] });
      refetch();
      refetchChains();
      const asId = getMetaActionStateId(res.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.vps.config.save.label',
          objectLabel,
          object: vpsRef,
        });
      }
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => {
      chrome.releaseLocalLock(vpsRef);
    },
  });

  const busyLocal = busyLocalLock || saveM.isPending;
  const gate = gateVpsMutation({ vps, busyLocal, busyTransaction });
  const dirty = result.changedKeys.length > 0;
  const saveDisabled = !dirty || Boolean(result.validationError) || !gate.allowed || saveM.isPending;

  const dnsOptions = useMemo<SelectOption[]>(() => {
    const options: SelectOption[] = [
      { value: '', label: t('vps.config.option.dns_unmanaged') },
      ...(dnsResolversQ.data ?? []).map((resolver) => ({ value: String(resolver.id), label: dnsResolverLabel(resolver) })),
    ];
    return ensureCurrentOption(
      options,
      baseline.dnsResolver,
      currentResourceLabel((vps as LegacyAny).dns_resolver, t('vps.config.option.current_dns_resolver'))
    );
  }, [baseline.dnsResolver, dnsResolversQ.data, t, vps]);

  const userNamespaceMapOptions = useMemo<SelectOption[]>(() => {
    const listed = (userNamespaceMapsQ.data ?? []).map((map) => ({ value: String(map.id), label: userNamespaceMapLabel(map) }));
    const withCurrent = ensureCurrentOption(
      listed,
      baseline.userNamespaceMap,
      currentResourceLabel((vps as LegacyAny).user_namespace_map, t('vps.config.option.current_user_namespace_map'))
    );
    return withCurrent.length > 0 ? withCurrent : [{ value: '', label: t('vps.config.option.no_user_namespace_maps_available') }];
  }, [baseline.userNamespaceMap, t, userNamespaceMapsQ.data, vps]);

  const applySave = () => {
    if (saveDisabled) return;
    if (result.sensitive) {
      setConfirmOpen(true);
      return;
    }
    saveM.mutate(result.payload);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t('vps.config.title')}
          subtitle={t(isAdminMode ? 'vps.config.subtitle_admin' : 'vps.config.subtitle_user')}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft(null);
                  void dnsResolversQ.refetch();
                  void userNamespaceMapsQ.refetch();
                }}
                disabled={saveM.isPending}
              >
                {t('common.reset')}
              </Button>
              <ActionButton
                onClick={applySave}
                loading={saveM.isPending}
                disabled={saveDisabled}
                disabledReason={!gate.allowed ? gate.reason : undefined}
              >
                {dirty ? t('vps.config.save_changes', { n: result.changedKeys.length }) : t('vps.config.save_changes_empty')}
              </ActionButton>
            </div>
          }
        />
      </Card>

      {!gate.allowed ? (
        <Alert variant="warn" title={t(gate.reason.titleKey)}>
          {gate.reason.descriptionKey ? <p>{t(gate.reason.descriptionKey)}</p> : null}
          <Button variant="secondary" onClick={() => chrome.openTasks()}>
            {t('common.open_tasks')}
          </Button>
        </Alert>
      ) : null}

      {result.validationError ? <Alert variant="danger">{result.validationError}</Alert> : null}
      {saveM.error ? <Alert variant="danger">{String((saveM.error as LegacyAny)?.message ?? saveM.error)}</Alert> : null}

      <Card>
        <CardHeader title={t('vps.config.section.identity')} subtitle={t('vps.config.section.identity_help')} />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label={t('vps.config.field.hostname_mode')} help={t('vps.config.help.hostname_mode')}>
            <Select
              value={effective.hostnameMode}
              onChange={(e) => patchDraft({ hostnameMode: e.target.value as HostnameMode })}
              disabled={saveM.isPending}
              options={[
                { value: 'managed', label: t('vps.config.option.hostname_managed') },
                { value: 'manual', label: t('vps.config.option.hostname_manual') },
              ]}
            />
          </Field>
          <Field label={t('vps.config.field.hostname')} help={t('vps.config.help.hostname')}>
            <Input
              value={effective.hostname}
              onChange={(e) => patchDraft({ hostname: e.target.value })}
              disabled={saveM.isPending || effective.hostnameMode === 'manual'}
              autoComplete="off"
            />
          </Field>
          {isAdminMode ? (
            <Field label={t('vps.config.field.owner')} help={t('vps.config.help.owner')}>
              <UserLookupInput
                value={effective.user}
                onChange={(value) => patchDraft({ user: value })}
                placeholder={t('vps.create.placeholder.user')}
                disabled={saveM.isPending}
                allowRawId
              />
            </Field>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('vps.config.section.resources')} subtitle={t('vps.config.section.resources_help')} />
        <CardBody className={`grid gap-4 md:grid-cols-2 ${isAdminMode ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          <Field label={t('vps.config.field.cpu')}>
            <Input value={effective.cpu} type="number" min={1} step={1} onChange={(e) => patchDraft({ cpu: e.target.value })} disabled={saveM.isPending} />
          </Field>
          {isAdminMode ? (
            <Field label={t('vps.config.field.cpu_limit')} help={t('vps.config.help.cpu_limit_nullable')}>
              <Input value={effective.cpuLimit} type="number" min={0} step={1} onChange={(e) => patchDraft({ cpuLimit: e.target.value })} disabled={saveM.isPending} />
            </Field>
          ) : null}
          <Field label={t('vps.config.field.memory')} help={t('vps.config.help.mib')}>
            <Input value={effective.memory} type="number" min={1} step={1} onChange={(e) => patchDraft({ memory: e.target.value })} disabled={saveM.isPending} />
          </Field>
          <Field label={t('vps.config.field.swap')} help={t('vps.config.help.mib')}>
            <Input value={effective.swap} type="number" min={0} step={1} onChange={(e) => patchDraft({ swap: e.target.value })} disabled={saveM.isPending} />
          </Field>
          {isAdminMode ? (
            <div className="md:col-span-2 lg:col-span-4 grid gap-4 md:grid-cols-3">
              <Field label={t('vps.config.field.change_reason')} help={t('vps.config.help.change_reason')}>
                <Input value={effective.changeReason} onChange={(e) => patchDraft({ changeReason: e.target.value })} disabled={saveM.isPending} autoComplete="off" />
              </Field>
              <Field label={t('vps.config.field.admin_lock_type')} help={t('vps.config.help.admin_lock_type')}>
                <Select
                  value={effective.adminLockType}
                  onChange={(e) => patchDraft({ adminLockType: e.target.value })}
                  disabled={saveM.isPending}
                  options={[
                    { value: '', label: t('vps.config.option.admin_lock_type_none') },
                    ...ADMIN_LOCK_TYPES.map((lockType) => ({ value: lockType, label: t(`vps.config.option.admin_lock_type.${lockType}`) })),
                  ]}
                />
              </Field>
              <div className="flex items-end">
                <Checkbox
                  checked={effective.adminOverride}
                  onChange={(checked) => patchDraft({ adminOverride: checked })}
                  label={t('vps.config.field.admin_override')}
                  description={t('vps.config.help.admin_override')}
                  disabled={saveM.isPending}
                />
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('vps.config.section.resolvers')} subtitle={t('vps.config.section.resolvers_help')} />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label={t('vps.config.field.dns_resolver')} help={t('vps.config.help.dns_resolver_nullable')}>
            {dnsResolversQ.isLoading ? (
              <Spinner />
            ) : dnsResolversQ.isError ? (
              <Alert variant="danger">{String((dnsResolversQ.error as LegacyAny)?.message ?? dnsResolversQ.error)}</Alert>
            ) : (
              <Select value={effective.dnsResolver} onChange={(e) => patchDraft({ dnsResolver: e.target.value })} disabled={saveM.isPending} options={dnsOptions} />
            )}
          </Field>
          <Field label={t('vps.config.field.user_namespace_map')} help={t('vps.config.help.user_namespace_map')}>
            {userNamespaceMapsQ.isLoading ? (
              <Spinner />
            ) : userNamespaceMapsQ.isError ? (
              <Alert variant="danger">{String((userNamespaceMapsQ.error as LegacyAny)?.message ?? userNamespaceMapsQ.error)}</Alert>
            ) : (
              <Select
                value={effective.userNamespaceMap}
                onChange={(e) => patchDraft({ userNamespaceMap: e.target.value })}
                disabled={saveM.isPending || userNamespaceMapOptions.length === 0}
                options={userNamespaceMapOptions}
              />
            )}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('vps.config.section.boot')} subtitle={t('vps.config.section.boot_help')} />
        <CardBody className={`grid gap-4 md:grid-cols-2 ${isAdminMode ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {isAdminMode ? (
            <Field label={t('vps.config.field.autostart_priority')} help={t('vps.config.help.autostart_priority')}>
              <Input value={effective.autostartPriority} type="number" min={0} step={1} onChange={(e) => patchDraft({ autostartPriority: e.target.value })} disabled={saveM.isPending} />
            </Field>
          ) : null}
          <Field label={t('vps.config.field.start_menu_timeout')} help={t('vps.config.help.start_menu_timeout')}>
            <Input value={effective.startMenuTimeout} type="number" min={0} max={START_MENU_TIMEOUT_MAX} step={1} onChange={(e) => patchDraft({ startMenuTimeout: e.target.value })} disabled={saveM.isPending} />
          </Field>
          <Field label={t('vps.config.field.cgroup_version')}>
            <Select
              value={effective.cgroupVersion}
              onChange={(e) => patchDraft({ cgroupVersion: e.target.value as CgroupVersion })}
              disabled={saveM.isPending}
              options={[
                { value: 'cgroup_any', label: t('vps.config.option.cgroup_any') },
                { value: 'cgroup_v1', label: 'cgroup v1' },
                { value: 'cgroup_v2', label: 'cgroup v2' },
              ]}
            />
          </Field>
          <div className="flex items-end">
            <Checkbox
              checked={effective.allowAdminModifications}
              onChange={(checked) => patchDraft({ allowAdminModifications: checked })}
              label={t('vps.config.field.allow_admin_modifications')}
              description={t('vps.config.help.allow_admin_modifications')}
              disabled={saveM.isPending}
            />
          </div>
        </CardBody>
      </Card>

      {dirty ? <Alert variant="info">{t('vps.config.unsaved', { n: result.changedKeys.length })}</Alert> : null}

      <ConfirmDialog
        open={confirmOpen}
        title={t('vps.config.confirm.title')}
        description={t('vps.config.confirm.description', { n: result.changedKeys.length })}
        confirmLabel={t('common.save')}
        confirmLoading={saveM.isPending}
        confirmDisabled={saveDisabled}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => saveM.mutate(result.payload)}
      />
    </div>
  );
}
