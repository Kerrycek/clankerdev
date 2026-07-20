const FALSE_LOCK_VALUES = new Set([
  '',
  '0',
  'false',
  'n',
  'no',
  'none',
  'off',
  'disabled',
  'unlock',
  'unlocked',
  'not locked',
  'not_locked',
]);

const TRUE_LOCK_VALUES = new Set([
  '1',
  'true',
  'y',
  'yes',
  'on',
  'enabled',
  'lock',
  'locked',
  'maint',
  'maintenance',
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object';
}

function hasReason(v: Record<string, unknown>): boolean {
  const reason = v['reason'] ?? v['maintenance_lock_reason'];
  return typeof reason === 'string' && reason.trim().length > 0;
}

export function isMaintenanceLocked(lock: unknown): boolean {
  if (lock === undefined || lock === null || lock === false) return false;
  if (lock === true) return true;

  if (typeof lock === 'number') {
    return Number.isFinite(lock) && lock !== 0;
  }

  if (typeof lock === 'string') {
    const value = lock.trim().toLowerCase();
    if (FALSE_LOCK_VALUES.has(value)) return false;
    if (TRUE_LOCK_VALUES.has(value)) return true;
    return value.length > 0;
  }

  if (isRecord(lock)) {
    for (const key of ['maintenance_lock', 'locked', 'lock', 'state', 'status', 'enabled', 'active']) {
      if (key in lock) return isMaintenanceLocked(lock[key]);
    }
    return hasReason(lock);
  }

  return Boolean(lock);
}
