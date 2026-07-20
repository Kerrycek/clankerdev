import { describe, expect, test } from 'vitest';

import { isMaintenanceLocked } from './nodeMaintenance';

describe('nodeMaintenance', () => {
  test('recognizes explicit unlocked values from the API', () => {
    for (const value of [undefined, null, false, 0, '', 'no', 'false', '0', 'none', 'unlocked', 'not_locked']) {
      expect(isMaintenanceLocked(value)).toBe(false);
    }
  });

  test('recognizes explicit locked values', () => {
    for (const value of [true, 1, 'yes', 'true', '1', 'locked', 'lock', 'maint', 'maintenance']) {
      expect(isMaintenanceLocked(value)).toBe(true);
    }
  });

  test('uses nested lock state when API returns an object', () => {
    expect(isMaintenanceLocked({ state: 'no', reason: 'old reason' })).toBe(false);
    expect(isMaintenanceLocked({ reason: 'HW upgrade' })).toBe(true);
  });
});
