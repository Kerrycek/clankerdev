import { describe, expect, test } from 'vitest';

import {
  normalizeResourcePackageScope,
  resolveResourcePackageEnvironment,
  resourcePackageScopeFilters,
} from './ResourcePackagesListModel';

describe('resource package list model', () => {
  test('maps visible scopes to the exact nullable-user API contract', () => {
    expect(resourcePackageScopeFilters('global', 4, 7)).toEqual({
      environmentId: undefined,
      userId: null,
      personalUserRequired: false,
    });
    expect(resourcePackageScopeFilters('personal', 4, 7)).toEqual({
      environmentId: 4,
      userId: 7,
      personalUserRequired: false,
    });
    expect(resourcePackageScopeFilters('personal', 4, undefined)).toEqual({
      environmentId: 4,
      userId: undefined,
      personalUserRequired: true,
    });
    expect(resourcePackageScopeFilters('all', 4, 7)).toEqual({
      environmentId: 4,
      userId: undefined,
      personalUserRequired: false,
    });
  });

  test('normalizes unknown scopes and resolves only exact environment labels', () => {
    expect(normalizeResourcePackageScope('personal')).toBe('personal');
    expect(normalizeResourcePackageScope('unexpected')).toBe('global');

    const environments = [
      { id: 1, label: 'Production' },
      { id: 2, label: 'Production lab' },
    ];
    expect(resolveResourcePackageEnvironment(environments, '2')).toBe(2);
    expect(resolveResourcePackageEnvironment(environments, 'production')).toBe(1);
    expect(resolveResourcePackageEnvironment(environments, 'prod')).toBeUndefined();
  });
});
