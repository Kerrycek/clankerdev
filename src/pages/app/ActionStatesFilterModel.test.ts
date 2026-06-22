import { describe, expect, it } from 'vitest';

import type { ActionState } from '../../lib/api/actionStates';
import {
  actionStateMatchesVisibilityFilter,
  actionStateVisibilityFromUrl,
  canonicalActionStateSmartKey,
  parseVisibilityToken,
} from './ActionStatesFilterModel';

describe('ActionStatesFilterModel', () => {
  it('parses visibility filters and smart aliases', () => {
    expect(parseVisibilityToken('system')).toBe('system');
    expect(parseVisibilityToken('operator')).toBe('admin');
    expect(actionStateVisibilityFromUrl('mine')).toBe('user');
    expect(actionStateVisibilityFromUrl('unknown')).toBe('all');
    expect(canonicalActionStateSmartKey('activity')).toBe('visibility');
  });

  it('uses operation taxonomy for visibility filtering', () => {
    const userAction: ActionState = { id: 1, label: 'Restart VPS #16' };
    const systemAction: ActionState = { id: 2, label: 'Automatic backup retention cleanup' };
    const adminAction: ActionState = { id: 3, label: 'Evacuate node #4' };

    expect(actionStateMatchesVisibilityFilter(userAction, 'user')).toBe(true);
    expect(actionStateMatchesVisibilityFilter(userAction, 'system')).toBe(false);
    expect(actionStateMatchesVisibilityFilter(systemAction, 'system')).toBe(true);
    expect(actionStateMatchesVisibilityFilter(adminAction, 'admin')).toBe(true);
    expect(actionStateMatchesVisibilityFilter(adminAction, 'all')).toBe(true);
  });
});
