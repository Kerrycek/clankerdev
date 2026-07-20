import { describe, expect, it } from 'vitest';

import { csCommon_navigation } from '../../i18n/locales/cs/common/navigation';
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

  it('does not show the old Czech action states label in the sidebar', () => {
    const t = (key: keyof typeof csCommon_navigation) => csCommon_navigation[key] ?? key;

    for (const appMode of ['user', 'admin'] as const) {
      const items = buildSidebarNavItems({ basePath: appMode === 'user' ? '/app' : '/admin', appMode, t });

      expect(items.map((item) => item.label)).not.toContain('Stavy akcí');
    }
  });
});
