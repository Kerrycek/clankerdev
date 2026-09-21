import { describe, expect, it } from 'vitest';

import { canAdministerUser } from './AdminUserOverviewPermissions';

describe('canAdministerUser', () => {
  it('matches administrator-only user update and lifecycle API fields', () => {
    expect(canAdministerUser('admin')).toBe(true);
    expect(canAdministerUser('support')).toBe(false);
    expect(canAdministerUser('user')).toBe(false);
    expect(canAdministerUser('unknown')).toBe(false);
  });
});
