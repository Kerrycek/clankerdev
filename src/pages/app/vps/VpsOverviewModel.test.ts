import { describe, expect, it } from 'vitest';

import { resourceLabel, shouldShowVpsOwner } from './VpsOverviewModel';

describe('VpsOverviewModel', () => {
  describe('shouldShowVpsOwner', () => {
    it('hides the owner row for the current owner in user mode', () => {
      expect(shouldShowVpsOwner({ mode: 'user', ownerId: 10, currentUserId: 10 })).toBe(false);
    });

    it('keeps user mode quiet when the current user is not known yet', () => {
      expect(shouldShowVpsOwner({ mode: 'user', ownerId: 10 })).toBe(false);
    });

    it('can still show a non-self owner in user mode when that context is explicit', () => {
      expect(shouldShowVpsOwner({ mode: 'user', ownerId: 11, currentUserId: 10 })).toBe(true);
    });

    it('always shows owner context in admin mode', () => {
      expect(shouldShowVpsOwner({ mode: 'admin', ownerId: 10, currentUserId: 10 })).toBe(true);
      expect(shouldShowVpsOwner({ mode: 'admin' })).toBe(true);
    });
  });

  it('prefers operational labels commonly returned by admin includes', () => {
    expect(resourceLabel({ id: 1, domain_name: 'node1.example' })).toBe('node1.example');
    expect(resourceLabel({ id: 2, full_name: 'tank/vps/123/root' })).toBe('tank/vps/123/root');
    expect(resourceLabel({ id: 3, login: 'alice' })).toBe('alice');
  });
});
