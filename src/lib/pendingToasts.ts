export type PendingToastKind = 'scope_all_objects';

/**
 * This module provides a tiny cross-route (AppShell) toast mechanism.
 *
 * Why?
 * Switching between `/app` and `/admin` unmounts the React tree, including
 * ToastsProvider. To display a toast *after* a scope switch, we queue a short
 * toast intent in sessionStorage and consume it on the next mount.
 */

const PENDING_TOAST_KEY = 'webui-next.pendingToast.v1';
const SCOPE_ALL_WARNED_KEY = 'webui-next.scope.all.warned.v1';

interface PendingToastRecord {
  kind: PendingToastKind;
}

function safeParse(raw: string | null): PendingToastRecord | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    const kind = (p as LegacyAny).kind;
    if (kind !== 'scope_all_objects') return null;
    return { kind };
  } catch {
    return null;
  }
}

export function queuePendingToast(storage: Storage | undefined, kind: PendingToastKind): void {
  if (!storage) return;
  try {
    storage.setItem(PENDING_TOAST_KEY, JSON.stringify({ kind } satisfies PendingToastRecord));
  } catch {
    // Best-effort.
  }
}

export function consumePendingToast(storage: Storage | undefined): PendingToastKind | null {
  if (!storage) return null;
  try {
    const rec = safeParse(storage.getItem(PENDING_TOAST_KEY));
    storage.removeItem(PENDING_TOAST_KEY);
    return rec?.kind ?? null;
  } catch {
    return null;
  }
}

/**
 * Queue the one-time "All objects" warning toast for this browser tab/session.
 *
 * Returns true if a toast was queued, false if it was already shown.
 */
export function queueScopeAllObjectsWarning(storage: Storage | undefined): boolean {
  if (!storage) return false;
  try {
    if (storage.getItem(SCOPE_ALL_WARNED_KEY)) return false;
    storage.setItem(SCOPE_ALL_WARNED_KEY, '1');
    queuePendingToast(storage, 'scope_all_objects');
    return true;
  } catch {
    return false;
  }
}
