import { normalizeObjectRef, objectRefKey, type ObjectRef } from './objectRef';

export interface LocalLock {
  /** Stable object key: `${kind}:${id}` */
  key: string;
  kind: ObjectRef['kind'];
  id: number;

  /** When the lock was first acquired (epoch ms). */
  acquiredAt: number;

  /** When the lock expires if not released earlier (epoch ms). */
  expiresAt: number;

  /** Optional backend action_state_id that this lock is bound to. */
  actionStateId?: number;
}

export const LOCAL_LOCK_STORAGE_KEY = 'webui-next.local_locks';

// Default TTLs
export const LOCAL_LOCK_TTL_UNBOUND_MS = 60_000;
export const LOCAL_LOCK_TTL_BOUND_MS = 6 * 60 * 60 * 1000;

export function isLocalLockActive(lock: LocalLock, nowMs: number): boolean {
  return Number(lock.expiresAt) > nowMs;
}

export function normalizeActionStateId(raw: unknown): number | undefined {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

export function normalizeEpochMs(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function createLocalLock(ref: ObjectRef, nowMs: number, opts?: { actionStateId?: number; ttlMs?: number }): LocalLock {
  const actionStateId = normalizeActionStateId(opts?.actionStateId);
  const ttl =
    typeof opts?.ttlMs === 'number' && Number.isFinite(opts.ttlMs) && opts.ttlMs > 0
      ? Math.floor(opts.ttlMs)
      : actionStateId
        ? LOCAL_LOCK_TTL_BOUND_MS
        : LOCAL_LOCK_TTL_UNBOUND_MS;

  return {
    key: objectRefKey(ref),
    kind: ref.kind,
    id: ref.id,
    acquiredAt: Math.floor(nowMs),
    expiresAt: Math.floor(nowMs) + ttl,
    actionStateId,
  };
}

export function normalizeLocalLock(raw: unknown): LocalLock | null {
  if (!raw || typeof raw !== 'object') return null;
  const anyRaw = raw as LegacyAny;

  // We accept either:
  // - { key: 'Kind:123', acquiredAt, expiresAt, actionStateId }
  // - { kind: 'Kind', id: 123, acquiredAt, expiresAt, actionStateId }
  // - { ref: { kind, id }, ... }
  const ref = normalizeObjectRef(anyRaw.ref ?? anyRaw);
  if (!ref) return null;

  const acquiredAt = normalizeEpochMs(anyRaw.acquiredAt ?? anyRaw.acquired_at);
  const expiresAt = normalizeEpochMs(anyRaw.expiresAt ?? anyRaw.expires_at);
  if (acquiredAt === null || expiresAt === null) return null;

  const actionStateId = normalizeActionStateId(anyRaw.actionStateId ?? anyRaw.action_state_id);

  return {
    key: objectRefKey(ref),
    kind: ref.kind,
    id: ref.id,
    acquiredAt,
    expiresAt,
    actionStateId,
  };
}

export function parseLocalLocksFromStorage(rawJson: string | null, nowMs: number): LocalLock[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    return pruneLocalLocks(parsed.map(normalizeLocalLock).filter(Boolean) as LocalLock[], nowMs);
  } catch {
    return [];
  }
}

export function pruneLocalLocks(locks: LocalLock[], nowMs: number): LocalLock[] {
  const seen = new Set<string>();
  const out: LocalLock[] = [];

  for (const l of locks) {
    if (!l) continue;
    if (!isLocalLockActive(l, nowMs)) continue;
    if (!l.key || typeof l.key !== 'string') continue;
    if (seen.has(l.key)) continue;
    seen.add(l.key);
    out.push(l);
  }

  return out;
}

export function upsertLocalLock(
  locks: LocalLock[],
  ref: ObjectRef,
  nowMs: number,
  opts?: { actionStateId?: number; ttlMs?: number }
): LocalLock[] {
  const key = objectRefKey(ref);
  const existing = locks.find((l) => l.key === key);

  const incomingAsId = normalizeActionStateId(opts?.actionStateId);

  if (!existing) {
    return [createLocalLock(ref, nowMs, { actionStateId: incomingAsId, ttlMs: opts?.ttlMs }), ...locks].slice(0, 200);
  }

  const nextAsId = incomingAsId ?? existing.actionStateId;

  const ttl =
    typeof opts?.ttlMs === 'number' && Number.isFinite(opts.ttlMs) && opts.ttlMs > 0
      ? Math.floor(opts.ttlMs)
      : nextAsId
        ? LOCAL_LOCK_TTL_BOUND_MS
        : LOCAL_LOCK_TTL_UNBOUND_MS;

  const next: LocalLock = {
    ...existing,
    key,
    kind: ref.kind,
    id: ref.id,
    actionStateId: nextAsId,
    // Preserve the original acquiredAt, but refresh expiry.
    expiresAt: Math.max(existing.expiresAt, Math.floor(nowMs) + ttl),
  };

  return [next, ...locks.filter((l) => l.key !== key)].slice(0, 200);
}

/**
 * Release an unbound lock for the object (if present).
 *
 * Bound locks (actionStateId) are not released by this function.
 */
export function releaseLocalLock(locks: LocalLock[], ref: ObjectRef): LocalLock[] {
  const key = objectRefKey(ref);
  return locks.filter((l) => !(l.key === key && l.actionStateId === undefined));
}

export function releaseLocalLocksByActionStateId(locks: LocalLock[], actionStateId: number): LocalLock[] {
  const asId = normalizeActionStateId(actionStateId);
  if (asId === undefined) return locks;
  return locks.filter((l) => l.actionStateId !== asId);
}

export function localLockActionStateIds(locks: LocalLock[]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();

  for (const l of locks) {
    const id = normalizeActionStateId(l.actionStateId);
    if (id === undefined) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 40) break;
  }

  return out;
}
