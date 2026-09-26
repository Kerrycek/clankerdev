/** Browser inactivity policy. API polling and OAuth refresh are not user activity. */
export function readSessionIdleLimitSeconds(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export function startIdleSession(options: {
  seconds: number;
  sessionKey?: string;
  onDeadline: (deadline: number) => void;
  onExpire: () => void;
}): () => void {
  const duration = options.seconds * 1000;
  if (!(duration > 0) || !Number.isFinite(duration)) return () => {};
  // Never persist access tokens. Only the BFF's non-credential session fingerprint
  // scopes state across tabs/reloads; standalone deployments keep tab-local state.
  const key = options.sessionKey ? `vpsadmin.idle.${options.sessionKey}` : undefined;
  let lastActivity = Date.now();
  let expired = false;
  const read = () => {
    try {
      const stored = key ? Number(window.localStorage.getItem(key)) : NaN;
      if (Number.isFinite(stored) && stored > 0 && stored <= Date.now()) lastActivity = stored;
    } catch { /* Storage can be disabled; retain the in-memory deadline. */ }
  };
  const write = () => {
    try { if (key) window.localStorage.setItem(key, String(lastActivity)); } catch { /* Best effort. */ }
  };
  read();
  write();
  const check = () => {
    if (expired) return false;
    read();
    options.onDeadline(lastActivity + duration);
    if (Date.now() >= lastActivity + duration) {
      expired = true;
      options.onExpire();
      return false;
    }
    return true;
  };
  const activity = (event: Event) => {
    // Synthetic events, focus changes and polling cannot extend the session.
    if (!event.isTrusted || !check()) return;
    if (Date.now() - lastActivity < 1000) return;
    lastActivity = Date.now();
    write();
    options.onDeadline(lastActivity + duration);
  };
  const storage = (event: StorageEvent) => { if (key && event.key === key) check(); };
  const events = ['pointerdown', 'keydown', 'wheel', 'touchmove'] as const;
  check();
  const timer = window.setInterval(check, 1000);
  for (const name of events) window.addEventListener(name, activity, { capture: true, passive: true });
  window.addEventListener('storage', storage);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', check);
  return () => {
    window.clearInterval(timer);
    for (const name of events) window.removeEventListener(name, activity, true);
    window.removeEventListener('storage', storage);
    window.removeEventListener('focus', check);
    document.removeEventListener('visibilitychange', check);
  };
}
