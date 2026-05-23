import { describe, expect, it } from 'vitest';

import { objectRef } from './objectRef';
import {
  LOCAL_LOCK_TTL_BOUND_MS,
  LOCAL_LOCK_TTL_UNBOUND_MS,
  createLocalLock,
  localLockActionStateIds,
  parseLocalLocksFromStorage,
  pruneLocalLocks,
  releaseLocalLock,
  releaseLocalLocksByActionStateId,
  upsertLocalLock,
} from './localLocks';

describe('localLocks', () => {
  it('creates unbound lock with default TTL', () => {
    const now = 1_000_000;
    const lock = createLocalLock(objectRef('Vps', 1), now);
    expect(lock.actionStateId).toBeUndefined();
    expect(lock.expiresAt - now).toBe(LOCAL_LOCK_TTL_UNBOUND_MS);
  });

  it('creates bound lock with default TTL', () => {
    const now = 1_000_000;
    const lock = createLocalLock(objectRef('Vps', 1), now, { actionStateId: 55 });
    expect(lock.actionStateId).toBe(55);
    expect(lock.expiresAt - now).toBe(LOCAL_LOCK_TTL_BOUND_MS);
  });

  it('prunes expired and malformed locks on parse', () => {
    const now = 1_000_000;
    const raw = JSON.stringify([
      { key: 'Vps:1', acquiredAt: now - 1_000, expiresAt: now + 1_000 },
      { key: 'Dataset:2', acquiredAt: now - 1_000, expiresAt: now - 1 }, // expired
      { key: 'Nope:3', acquiredAt: now - 1_000, expiresAt: now + 1_000 }, // invalid kind
      { foo: 'bar' },
    ]);
    const locks = parseLocalLocksFromStorage(raw, now);
    expect(locks).toHaveLength(1);
    expect(locks[0]?.key).toBe('Vps:1');
  });

  it('upserts and upgrades to bound lock', () => {
    const now = 1_000_000;
    const ref = objectRef('Dataset', 10);
    let locks = upsertLocalLock([], ref, now);
    expect(locks).toHaveLength(1);
    expect(locks[0]?.actionStateId).toBeUndefined();

    locks = upsertLocalLock(locks, ref, now + 10, { actionStateId: 123 });
    expect(locks).toHaveLength(1);
    expect(locks[0]?.actionStateId).toBe(123);
  });

  it('releaseLocalLock removes only unbound locks', () => {
    const now = 1_000_000;
    const ref = objectRef('Vps', 3);
    let locks = upsertLocalLock([], ref, now);
    locks = releaseLocalLock(locks, ref);
    expect(locks).toHaveLength(0);

    locks = upsertLocalLock([], ref, now, { actionStateId: 999 });
    locks = releaseLocalLock(locks, ref);
    expect(locks).toHaveLength(1);
  });

  it('releaseLocalLocksByActionStateId removes bound locks', () => {
    const now = 1_000_000;
    const a = objectRef('Vps', 1);
    const b = objectRef('Vps', 2);
    let locks = upsertLocalLock([], a, now, { actionStateId: 11 });
    locks = upsertLocalLock(locks, b, now, { actionStateId: 12 });
    locks = releaseLocalLocksByActionStateId(locks, 11);
    expect(locks).toHaveLength(1);
    expect(locks[0]?.key).toBe('Vps:2');
  });

  it('lists unique actionStateIds', () => {
    const now = 1_000_000;
    const a = objectRef('Vps', 1);
    const b = objectRef('Vps', 2);
    let locks = upsertLocalLock([], a, now, { actionStateId: 11 });
    locks = upsertLocalLock(locks, b, now, { actionStateId: 11 });
    locks = upsertLocalLock(locks, b, now, { actionStateId: 12 });
    const ids = localLockActionStateIds(pruneLocalLocks(locks, now));
    expect(ids.sort((x, y) => x - y)).toEqual([11, 12]);
  });
});
