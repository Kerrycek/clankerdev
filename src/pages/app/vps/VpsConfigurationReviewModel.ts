import {
  CONFIG_FIELD_META,
  type VpsConfigDraft,
  type VpsConfigFieldKey,
  type VpsConfigRequestOptionKey,
  type VpsConfigReviewKey,
  type VpsConfigRisk,
  type VpsConfigSection,
} from './VpsConfigurationModel';

export type VpsConfigChangeSummary = {
  key: VpsConfigReviewKey;
  label: string;
  section: VpsConfigSection;
  risks: readonly VpsConfigRisk[];
  before: string;
  after: string;
  requestOption?: boolean;
};

function hasPayloadKey(payload: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(payload, key);
}

export function getReviewRequestOptionKeys(payload: Record<string, unknown>): VpsConfigRequestOptionKey[] {
  return (['change_reason', 'admin_override', 'admin_lock_type'] as const).filter((key) => hasPayloadKey(payload, key));
}

function draftRawValue(draft: VpsConfigDraft, key: VpsConfigReviewKey): unknown {
  switch (key) {
    case 'manage_hostname':
      return draft.hostnameMode;
    case 'hostname':
      return draft.hostname;
    case 'user':
      return draft.user;
    case 'cpu':
      return draft.cpu;
    case 'cpu_limit':
      return draft.cpuLimit;
    case 'memory':
      return draft.memory;
    case 'swap':
      return draft.swap;
    case 'dns_resolver':
      return draft.dnsResolver;
    case 'user_namespace_map':
      return draft.userNamespaceMap;
    case 'autostart_priority':
      return draft.autostartPriority;
    case 'start_menu_timeout':
      return draft.startMenuTimeout;
    case 'cgroup_version':
      return draft.cgroupVersion;
    case 'allow_admin_modifications':
      return draft.allowAdminModifications;
    case 'change_reason':
      return draft.changeReason;
    case 'admin_override':
      return draft.adminOverride;
    case 'admin_lock_type':
      return draft.adminLockType;
  }
}

export function buildChangeSummaries(args: {
  changedKeys: readonly VpsConfigFieldKey[];
  requestOptionKeys?: readonly VpsConfigRequestOptionKey[];
  baseline: VpsConfigDraft;
  draft: VpsConfigDraft;
  labelForKey: (key: VpsConfigReviewKey) => string;
  valueForKey: (key: VpsConfigReviewKey, draft: VpsConfigDraft, rawValue: unknown) => string;
  emptyValueLabel: string;
}): VpsConfigChangeSummary[] {
  const changed = args.changedKeys.map((key): VpsConfigChangeSummary => {
    const meta = CONFIG_FIELD_META[key];
    return {
      key,
      label: args.labelForKey(key),
      section: meta.section,
      risks: meta.risks,
      before: args.valueForKey(key, args.baseline, draftRawValue(args.baseline, key)) || args.emptyValueLabel,
      after: args.valueForKey(key, args.draft, draftRawValue(args.draft, key)) || args.emptyValueLabel,
    };
  });

  const requestOptions = (args.requestOptionKeys ?? []).map((key): VpsConfigChangeSummary => {
    const meta = CONFIG_FIELD_META[key];
    return {
      key,
      label: args.labelForKey(key),
      section: meta.section,
      risks: meta.risks,
      before: args.emptyValueLabel,
      after: args.valueForKey(key, args.draft, draftRawValue(args.draft, key)) || args.emptyValueLabel,
      requestOption: true,
    };
  });

  return [...changed, ...requestOptions];
}
