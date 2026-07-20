import { describe, expect, it } from 'vitest';

import { buildSidebarNavItems } from './AppSidebar';

function fakeT(key: string) {
  return key;
}

describe('buildSidebarNavItems', () => {
  it('does not expose action states as a primary navigation item', () => {
    for (const appMode of ['user', 'admin'] as const) {
      const items = buildSidebarNavItems({ basePath: appMode === 'user' ? '/app' : '/admin', appMode, t: fakeT });

      expect(items.map((item) => item.id)).not.toContain('action-states');
      expect(items.map((item) => item.to)).not.toContain(`${appMode === 'user' ? '/app' : '/admin'}/action-states`);
    }
  });
});
