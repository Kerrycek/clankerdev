import { describe, expect, it } from 'vitest';

import { canManageUserResourcePackages } from './AdminUserPackageGate';

describe('canManageUserResourcePackages', () => {
  it('matches administrator-only package assignment API actions', () => {
    expect(canManageUserResourcePackages('admin')).toBe(true);
    expect(canManageUserResourcePackages('support')).toBe(false);
    expect(canManageUserResourcePackages('user')).toBe(false);
    expect(canManageUserResourcePackages('unknown')).toBe(false);
  });
});
