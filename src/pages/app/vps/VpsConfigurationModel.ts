import type { SelectOption } from '../../../components/ui/Select';
import type { DnsResolver } from '../../../lib/api/dnsResolvers';
import type { UserNamespaceMap } from '../../../lib/api/userNamespaces';
import type { Vps } from '../../../lib/api/vps';

export type HostnameMode = 'managed' | 'manual';
export type CgroupVersion = 'cgroup_any' | 'cgroup_v1' | 'cgroup_v2';
export type AdminLockType = 'no_lock' | 'absolute' | 'not_less' | 'not_more';

export type VpsConfigDraft = {
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

export type VpsConfigFieldKey =
  | 'manage_hostname'
  | 'hostname'
  | 'user'
  | 'cpu'
  | 'cpu_limit'
  | 'memory'
  | 'swap'
  | 'dns_resolver'
  | 'user_namespace_map'
  | 'autostart_priority'
  | 'start_menu_timeout'
  | 'cgroup_version'
  | 'allow_admin_modifications';

export type VpsConfigRequestOptionKey = 'change_reason' | 'admin_override' | 'admin_lock_type';
export type VpsConfigReviewKey = VpsConfigFieldKey | VpsConfigRequestOptionKey;

export type VpsConfigSection = 'identity' | 'resources' | 'network' | 'boot' | 'admin';
export type VpsConfigRisk = 'safe' | 'requires_restart' | 'admin_only' | 'boot' | 'network';

export type VpsConfigFieldMeta = {
  labelKey: string;
  section: VpsConfigSection;
  risks: readonly VpsConfigRisk[];
};

export type VpsConfigBuildResult = {
  payload: Record<string, unknown>;
  validationError: string | null;
  validationFieldKey?: VpsConfigReviewKey;
  changedKeys: VpsConfigFieldKey[];
  sensitive: boolean;
};


export const CGROUP_VERSIONS: readonly CgroupVersion[] = ['cgroup_any', 'cgroup_v1', 'cgroup_v2'];
export const ADMIN_LOCK_TYPES: readonly AdminLockType[] = ['no_lock', 'absolute', 'not_less', 'not_more'];
export const START_MENU_TIMEOUT_MAX = 24 * 60 * 60;

export const CONFIG_FIELD_META: Record<VpsConfigReviewKey, VpsConfigFieldMeta> = {
  manage_hostname: {
    labelKey: 'vps.config.field.hostname_mode',
    section: 'identity',
    risks: ['safe'],
  },
  hostname: {
    labelKey: 'vps.config.field.hostname',
    section: 'identity',
    risks: ['safe'],
  },
  user: {
    labelKey: 'vps.config.field.owner',
    section: 'admin',
    risks: ['admin_only'],
  },
  cpu: {
    labelKey: 'vps.config.field.cpu',
    section: 'resources',
    risks: ['requires_restart'],
  },
  cpu_limit: {
    labelKey: 'vps.config.field.cpu_limit',
    section: 'admin',
    risks: ['requires_restart', 'admin_only'],
  },
  memory: {
    labelKey: 'vps.config.field.memory',
    section: 'resources',
    risks: ['requires_restart'],
  },
  swap: {
    labelKey: 'vps.config.field.swap',
    section: 'resources',
    risks: ['requires_restart'],
  },
  dns_resolver: {
    labelKey: 'vps.config.field.dns_resolver',
    section: 'network',
    risks: ['network'],
  },
  user_namespace_map: {
    labelKey: 'vps.config.field.user_namespace_map',
    section: 'network',
    risks: ['requires_restart', 'network'],
  },
  autostart_priority: {
    labelKey: 'vps.config.field.autostart_priority',
    section: 'admin',
    risks: ['boot', 'admin_only'],
  },
  start_menu_timeout: {
    labelKey: 'vps.config.field.start_menu_timeout',
    section: 'boot',
    risks: ['boot'],
  },
  cgroup_version: {
    labelKey: 'vps.config.field.cgroup_version',
    section: 'boot',
    risks: ['requires_restart', 'boot'],
  },
  allow_admin_modifications: {
    labelKey: 'vps.config.field.allow_admin_modifications',
    section: 'boot',
    risks: ['admin_only'],
  },
  change_reason: {
    labelKey: 'vps.config.field.change_reason',
    section: 'admin',
    risks: ['admin_only'],
  },
  admin_override: {
    labelKey: 'vps.config.field.admin_override',
    section: 'admin',
    risks: ['admin_only'],
  },
  admin_lock_type: {
    labelKey: 'vps.config.field.admin_lock_type',
    section: 'admin',
    risks: ['admin_only'],
  },
} as const;

const SENSITIVE_KEYS = new Set<VpsConfigFieldKey>([
  'user',
  'user_namespace_map',
  'cgroup_version',
  'allow_admin_modifications',
]);


export class VpsConfigValidationError extends Error {
  public readonly fieldKey?: VpsConfigReviewKey;

  constructor(message: string, fieldKey?: VpsConfigReviewKey) {
    super(message);
    this.name = 'VpsConfigValidationError';
    this.fieldKey = fieldKey;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function resourceId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  if (isRecord(value)) {
    const raw = value['id'];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  }
  return null;
}

export function numericText(value: unknown): string {
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

export function normalizeDraft(vps: Vps): VpsConfigDraft {
  return {
    hostnameMode: vps.manage_hostname === false ? 'manual' : 'managed',
    hostname: String(vps.hostname ?? ''),
    user: numericText(resourceId(vps.user)),
    cpu: numericText(vps.cpu),
    cpuLimit: numericText(vps['cpu_limit']),
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

function validationError(message: string, fieldKey?: VpsConfigReviewKey): VpsConfigValidationError {
  return new VpsConfigValidationError(message, fieldKey);
}

function parseInteger(
  raw: string,
  label: string,
  t: (key: string, vars?: Record<string, unknown>) => string,
  opts?: { min?: number; max?: number; fieldKey?: VpsConfigReviewKey }
): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value)) {
    throw validationError(t('vps.config.validation.integer', { field: label }), opts?.fieldKey);
  }
  if (opts?.min !== undefined && value < opts.min) {
    throw validationError(t('vps.config.validation.min', { field: label, min: opts.min }), opts.fieldKey);
  }
  if (opts?.max !== undefined && value > opts.max) {
    throw validationError(t('vps.config.validation.max', { field: label, max: opts.max }), opts.fieldKey);
  }
  return value;
}

function parseRequiredId(
  raw: string,
  label: string,
  t: (key: string, vars?: Record<string, unknown>) => string,
  fieldKey: VpsConfigReviewKey
): number {
  const value = parseInteger(raw, label, t, { min: 1, fieldKey });
  if (value === null) {
    throw validationError(t('vps.config.validation.required', { field: label }), fieldKey);
  }
  return value;
}

function setChangedInt(args: {
  payload: Record<string, unknown>;
  changedKeys: VpsConfigFieldKey[];
  key: VpsConfigFieldKey;
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

  const parsed = parseInteger(raw, args.label, args.t, {
    min: args.min,
    max: args.max,
    fieldKey: args.key,
  });
  if (parsed === null) {
    if (!args.allowNull) {
      throw validationError(args.t('vps.config.validation.required', { field: args.label }), args.key);
    }
    args.payload[args.key] = null;
  } else {
    args.payload[args.key] = parsed;
  }
  args.changedKeys.push(args.key);
}

export function currentResourceLabel(value: unknown, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return `#${value}`;
  if (isRecord(value)) {
    const id = value['id'];
    const idLabel = typeof id === 'number' || typeof id === 'string' ? `#${id}` : fallback;
    const label = value['label'] ?? value['name'] ?? value['login'] ?? value['ip_addr'] ?? idLabel;
    return String(label);
  }
  return fallback;
}

export function dnsResolverLabel(resolver: DnsResolver): string {
  const label = String(resolver.label ?? '').trim();
  const ip = String(resolver.ip_addr ?? '').trim();
  if (label && ip) return `${label} · ${ip}`;
  return label || ip || `#${resolver.id}`;
}

export function userNamespaceMapLabel(map: UserNamespaceMap): string {
  const label = String(map.label ?? '').trim();
  const nsLabel = currentResourceLabel(map.user_namespace, '');
  return [label || `#${map.id}`, nsLabel && nsLabel !== '—' ? nsLabel : ''].filter(Boolean).join(' · ');
}

export function ensureCurrentOption(options: SelectOption[], currentId: string, currentLabel: string): SelectOption[] {
  if (!currentId) return options;
  if (options.some((option) => option.value === currentId)) return options;
  return [...options, { value: currentId, label: currentLabel }];
}

export function buildPayload(args: {
  baseline: VpsConfigDraft;
  draft: VpsConfigDraft;
  isAdminMode: boolean;
  t: (key: string, vars?: Record<string, unknown>) => string;
}): VpsConfigBuildResult {
  const payload: Record<string, unknown> = {};
  const changedKeys: VpsConfigFieldKey[] = [];
  const { baseline, draft, isAdminMode, t } = args;

  const hostname = draft.hostname.trim();
  if (draft.hostnameMode !== baseline.hostnameMode) {
    if (draft.hostnameMode === 'manual') {
      payload['manage_hostname'] = false;
      changedKeys.push('manage_hostname');
    } else {
      if (!hostname) {
        throw validationError(t('vps.config.validation.required', { field: t('vps.config.field.hostname') }), 'hostname');
      }
      payload['manage_hostname'] = true;
      payload['hostname'] = hostname;
      changedKeys.push('manage_hostname', 'hostname');
    }
  } else if (draft.hostnameMode === 'managed' && hostname !== baseline.hostname.trim()) {
    if (!hostname) {
      throw validationError(t('vps.config.validation.required', { field: t('vps.config.field.hostname') }), 'hostname');
    }
    payload['hostname'] = hostname;
    changedKeys.push('hostname');
  }

  if (isAdminMode && draft.user.trim() !== baseline.user.trim()) {
    payload['user'] = parseRequiredId(draft.user, t('vps.config.field.owner'), t, 'user');
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
    const next = draft.dnsResolver.trim() ? parseRequiredId(draft.dnsResolver, t('vps.config.field.dns_resolver'), t, 'dns_resolver') : null;
    payload['dns_resolver'] = next;
    changedKeys.push('dns_resolver');
  }

  if (draft.userNamespaceMap.trim() !== baseline.userNamespaceMap.trim()) {
    payload['user_namespace_map'] = parseRequiredId(draft.userNamespaceMap, t('vps.config.field.user_namespace_map'), t, 'user_namespace_map');
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
      throw validationError(t('vps.config.validation.enum', { field: t('vps.config.field.cgroup_version') }), 'cgroup_version');
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
    throw validationError(t('vps.config.validation.owner_resources'));
  }
  if (ownerChanged && namespaceMapChanged) {
    throw validationError(t('vps.config.validation.owner_namespace_map'));
  }

  if (isAdminMode && resourceChanged) {
    const reason = draft.changeReason.trim();
    if (reason) payload['change_reason'] = reason;
    if (draft.adminOverride) payload['admin_override'] = true;
    const lockType = draft.adminLockType.trim();
    if (lockType) {
      if (!ADMIN_LOCK_TYPES.includes(lockType as AdminLockType)) {
        throw validationError(t('vps.config.validation.enum', { field: t('vps.config.field.admin_lock_type') }), 'admin_lock_type');
      }
      payload['admin_lock_type'] = lockType;
    }
  }

  return {
    payload,
    validationError: null,
    changedKeys,
    sensitive: changedKeys.some((key) => SENSITIVE_KEYS.has(key)),
  };
}

export function createBuildErrorResult(error: unknown): VpsConfigBuildResult {
  const message = error instanceof Error ? error.message : String(error);
  const validationFieldKey = error instanceof VpsConfigValidationError ? error.fieldKey : undefined;
  return {
    payload: {},
    validationError: message,
    validationFieldKey,
    changedKeys: [],
    sensitive: false,
  };
}
