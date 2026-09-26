import { getRuntimeConfig } from '../../app/config';

interface BffSession {
  runtime: Window['vpsAdmin'];
  url: string;
  key: string;
  token: string;
  pending?: Promise<boolean>;
}

let session: BffSession | undefined;

/** Called only after a successful same-origin bootstrap. Older BFFs opt out. */
export function rememberBffSession(url: string, key: unknown, token?: string): void {
  session = undefined;
  if (typeof window === 'undefined' || !token || typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) return;
  if (new URL(url, window.location.href).origin !== window.location.origin) return;
  session = { runtime: window.vpsAdmin, url, key, token };
}

function stillCurrent(state: BffSession): boolean {
  const auth = getRuntimeConfig().auth;
  return session === state && window.vpsAdmin === state.runtime
    && auth.kind === 'oauth2' && auth.accessToken === state.token;
}

/** Non-credential identity for browser-local state; stable across token rotation. */
export function getBffSessionKey(): string | undefined {
  return session && stillCurrent(session) ? session.key : undefined;
}

/** One bounded recovery per rejected request; concurrent callers share the lookup. */
export async function recoverBffSession(failedToken: string): Promise<boolean> {
  const state = session;
  if (!state || !stillCurrent(state)) return false;
  // A slower response may refer to the token another request already replaced.
  if (failedToken !== state.token) return true;
  if (state.pending) return state.pending;

  state.pending = (async () => {
    try {
      const response = await fetch(state.url, {
        credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('application/json')) return false;
      const value: unknown = await response.json();
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const data = value as Record<string, unknown>;
      // A different login, even for the same user, must reload auth and caches.
      if (data['sessionKey'] !== state.key || typeof data['accessToken'] !== 'string'
        || !data['accessToken'].trim() || data['accessToken'] === state.token || !stillCurrent(state)) return false;
      const runtime = state.runtime;
      if (!runtime) return false;
      state.token = data['accessToken'];
      runtime.accessToken = state.token;
      const expiresAt = data['sessionExpiresAt'];
      runtime.webuiNext = { ...runtime.webuiNext,
        sessionExpiresAt: typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null };
      return true;
    } catch {
      return false;
    } finally {
      state.pending = undefined;
    }
  })();
  return state.pending;
}
