const SESSION_EXPIRED_NOTICE_KEY = 'webui-next:session-expired-notice-at';
const SESSION_EXPIRED_NOTICE_MAX_AGE_MS = 5 * 60 * 1000;

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markSessionExpiredNotice(now = Date.now()): void {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.setItem(SESSION_EXPIRED_NOTICE_KEY, String(now));
  } catch {
    // Storage can be disabled in private modes. The redirect still works.
  }
}

export function consumeSessionExpiredNotice(now = Date.now()): boolean {
  const storage = getSessionStorage();
  if (!storage) return false;

  let raw: string | null = null;
  try {
    raw = storage.getItem(SESSION_EXPIRED_NOTICE_KEY);
    storage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
  } catch {
    return false;
  }

  if (!raw) return false;

  const markedAt = Number(raw);
  if (!Number.isFinite(markedAt)) return false;

  const age = now - markedAt;
  return age >= 0 && age <= SESSION_EXPIRED_NOTICE_MAX_AGE_MS;
}
