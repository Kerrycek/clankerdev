const CREATE_TAB_SESSION_KEY = 'webui-next.vps-create-tab-session';

function createOpaqueSessionId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function vpsCreatePageSessionId(locationKey: string): string {
  if (typeof window === 'undefined') return `server:${locationKey}`;
  let tabSessionId = '';
  try {
    tabSessionId = window.sessionStorage.getItem(CREATE_TAB_SESSION_KEY)?.trim() ?? '';
    if (!tabSessionId) {
      tabSessionId = createOpaqueSessionId();
      window.sessionStorage.setItem(CREATE_TAB_SESSION_KEY, tabSessionId);
      if (window.sessionStorage.getItem(CREATE_TAB_SESSION_KEY) !== tabSessionId) tabSessionId = '';
    }
  } catch {
    // A per-render fallback still prevents an unrelated persisted receipt from
    // being presented as the result of this form. Durable guard storage remains
    // fail-closed in vpsCreateOutcomeGuard.
  }
  return `${tabSessionId || createOpaqueSessionId()}:${locationKey}`;
}
