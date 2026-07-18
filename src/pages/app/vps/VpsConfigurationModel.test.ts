import { describe, expect, it } from 'vitest';

import { HaveApiError } from '../../../lib/api/haveapi';
import type { Vps } from '../../../lib/api/vps';
import {
  buildPayload,
  createBuildErrorResult,
  normalizeDraft,
  type VpsConfigReviewKey,
} from './VpsConfigurationModel';
import { parseVpsConfigFieldErrors } from './VpsConfigurationErrors';
import { buildChangeSummaries, getReviewRequestOptionKeys } from './VpsConfigurationReviewModel';

function t(key: string, vars?: Record<string, unknown>): string {
  if (!vars) return key;
  return Object.entries(vars).reduce((acc, [name, value]) => acc.replace(`{${name}}`, String(value)), key);
}

const baseVps: Vps = {
  id: 101,
  hostname: 'vps101.example',
  manage_hostname: true,
  cpu: 2,
  memory: 2048,
  swap: 512,
  user: { id: 7, login: 'alice', level: 0 },
  dns_resolver: { id: 3, label: 'default resolver' },
  user_namespace_map: { id: 8, label: 'default map' },
  autostart_priority: 10,
  start_menu_timeout: 5,
  cgroup_version: 'cgroup_any',
  allow_admin_modifications: false,
  cpu_limit: 200,
};

function labelForKey(key: VpsConfigReviewKey): string {
  return `label:${key}`;
}

describe('VpsConfigurationModel', () => {
  it('keeps legacy update payload shape while adding admin request options to review', () => {
    const baseline = normalizeDraft(baseVps);
    const draft = {
      ...baseline,
      memory: '4096',
      changeReason: 'capacity increase',
      adminOverride: true,
      adminLockType: 'absolute',
    };

    const result = buildPayload({ baseline, draft, isAdminMode: true, t });

    expect(result.changedKeys).toEqual(['memory']);
    expect(result.payload).toEqual({
      memory: 4096,
      change_reason: 'capacity increase',
      admin_override: true,
      admin_lock_type: 'absolute',
    });
    expect(getReviewRequestOptionKeys(result.payload)).toEqual(['change_reason', 'admin_override', 'admin_lock_type']);

    const summaries = buildChangeSummaries({
      changedKeys: result.changedKeys,
      requestOptionKeys: getReviewRequestOptionKeys(result.payload),
      baseline,
      draft,
      labelForKey,
      valueForKey: (_key, _draft, raw) => String(raw ?? ''),
      emptyValueLabel: 'none',
    });

    expect(summaries.map((summary) => summary.key)).toEqual(['memory', 'change_reason', 'admin_override', 'admin_lock_type']);
    expect(summaries.filter((summary) => summary.requestOption).map((summary) => summary.key)).toEqual([
      'change_reason',
      'admin_override',
      'admin_lock_type',
    ]);
  });

  it('maps local validation errors to a specific field when possible', () => {
    const baseline = normalizeDraft(baseVps);
    const draft = { ...baseline, cpu: '0' };

    let result;
    try {
      result = buildPayload({ baseline, draft, isAdminMode: false, t });
    } catch (error) {
      result = createBuildErrorResult(error);
    }

    expect(result.validationFieldKey).toBe('cpu');
    expect(result.validationError).toContain('vps.config.validation.min');
  });

  it('does not let user mode change start menu timeout', () => {
    const baseline = normalizeDraft(baseVps);
    const draft = { ...baseline, startMenuTimeout: '30' };

    const result = buildPayload({ baseline, draft, isAdminMode: false, t });

    expect(result.changedKeys).toEqual([]);
    expect(result.payload).toEqual({});
  });

  it('drops admin-only fields from user mode payloads', () => {
    const baseline = normalizeDraft(baseVps);
    const draft = {
      ...baseline,
      user: '9',
      cpuLimit: '75',
      autostartPriority: '20',
      startMenuTimeout: '30',
      changeReason: 'admin-only reason',
      adminOverride: true,
      adminLockType: 'absolute',
    };

    const result = buildPayload({ baseline, draft, isAdminMode: false, t });

    expect(result.changedKeys).toEqual([]);
    expect(result.payload).toEqual({});
  });

  it('keeps start menu timeout configurable in admin mode', () => {
    const baseline = normalizeDraft(baseVps);
    const draft = { ...baseline, startMenuTimeout: '30' };

    const result = buildPayload({ baseline, draft, isAdminMode: true, t });

    expect(result.changedKeys).toEqual(['start_menu_timeout']);
    expect(result.payload).toEqual({ start_menu_timeout: 30 });
  });

  it('keeps owner changes separate from resource changes', () => {
    const baseline = normalizeDraft(baseVps);
    const draft = { ...baseline, user: '9', memory: '4096' };

    expect(() => buildPayload({ baseline, draft, isAdminMode: true, t })).toThrow('vps.config.validation.owner_resources');
  });

  it('maps HaveAPI validation errors back to configuration fields', () => {
    const err = new HaveApiError({
      status: false,
      message: 'Validation failed',
      errors: {
        vps: {
          memory: ['must be at least 1'],
          dns_resolver_id: ['does not exist'],
        },
        admin_lock_type: { message: 'is invalid' },
      },
    });

    const mapped = parseVpsConfigFieldErrors(err);

    expect(mapped.map((item) => item.key)).toEqual(['memory', 'dns_resolver', 'admin_lock_type']);
    expect(mapped.find((item) => item.key === 'memory')?.messages).toEqual(['must be at least 1']);
  });
});
