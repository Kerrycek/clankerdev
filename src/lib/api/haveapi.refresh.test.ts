import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBffRuntimeSession } from '../../app/runtimeBootstrap';
import { rememberBffSession } from '../auth/bffSession';
import { haveApiCall, isExpiredSessionError, isAmbiguousMutationError, SESSION_EXPIRED_EVENT } from './haveapi';

const key = 'a'.repeat(64);
const sessionUrl = new URL('/session.json', window.location.href).href;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
const denied = () => json({ status: false, message: 'Unauthorized' }, 401);
function setup() {
  window.vpsAdmin = {
    api: { url: 'https://api.example.test', version: 'v7.0' }, accessToken: 'old',
    description: { authentication: { oauth2: { http_header: 'X-Token' } } },
    webuiNext: { haveApi: { authHeader: 'X-Token' } },
  };
  rememberBffSession(sessionUrl, key, 'old');
}
afterEach(() => {
  rememberBffSession(sessionUrl, null);
  window.vpsAdmin = undefined;
  document.documentElement.lang = '';
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('BFF request recovery', () => {
  it('uses the session fingerprint registered by actual runtime bootstrap', async () => {
    setup(); rememberBffSession(sessionUrl, null);
    const bootstrapFetch = vi.fn(async () => json({ sessionKey: key, accessToken: 'old' }));
    await loadBffRuntimeSession({ fetchImpl: bootstrapFetch });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === sessionUrl) return json({ sessionKey: key, accessToken: 'new' });
      return (init?.headers as Record<string, string>)['X-Token'] === 'old'
        ? denied() : json({ status: true, response: { things: [1] } });
    });
    vi.stubGlobal('fetch', fetchMock);
    expect((await haveApiCall({ path: '/things' })).data).toEqual([1]);
  });

  it.each([403, 500])('does not recover HTTP %s', async status => {
    setup(); const fetchMock = vi.fn(async () => json({ status: false }, status));
    vi.stubGlobal('fetch', fetchMock);
    await expect(haveApiCall({ path: '/things' })).rejects.toMatchObject({ httpStatus: status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares a session lookup for overlapping 401s and preserves request metadata', async () => {
    setup();
    const expired = vi.fn(); window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === sessionUrl) return json({ sessionKey: key, accessToken: 'new', sessionExpiresAt: 12345 });
      if ((init?.headers as Record<string, string>)['X-Token'] === 'old') return denied();
      return json({ status: true, response: { things: [42] } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const opts = { path: '/things', namespace: 'thing', params: { owner: 3 }, meta: { limit: 2 } };
    const results = await Promise.all([haveApiCall(opts), haveApiCall(opts)]);
    expect(results.map(r => r.data)).toEqual([[42], [42]]);
    expect(fetchMock.mock.calls.filter(([url]) => url === sessionUrl)).toHaveLength(1);
    const calls = fetchMock.mock.calls.filter(([url]) => url !== sessionUrl);
    expect(new Set(calls.map(([url]) => url)).size).toBe(1);
    expect(calls).toHaveLength(4);
    expect(window.vpsAdmin?.webuiNext?.sessionExpiresAt).toBe(12345);
    expect(expired).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });

  it.each(['other-login', 'anonymous', 'same-token', 'malformed', 'offline', 'forbidden'])('fails closed for %s', async mode => {
    setup();
    const fetchMock = vi.fn(async (url: string) => {
      if (url !== sessionUrl) return denied();
      if (mode === 'offline') throw new TypeError('offline');
      if (mode === 'forbidden') return json({}, 403);
      if (mode === 'malformed') return new Response('<html>');
      return json({ sessionKey: mode === 'other-login' ? 'b'.repeat(64) : key,
        accessToken: mode === 'anonymous' ? null : mode === 'same-token' ? 'old' : 'new' });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(haveApiCall({ path: '/things' })).rejects.toMatchObject({ httpStatus: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(window.vpsAdmin?.accessToken).toBe('old');
  });

  it('stops after one retry when the replacement is also rejected', async () => {
    setup();
    const fetchMock = vi.fn(async (url: string) => url === sessionUrl
      ? json({ sessionKey: key, accessToken: 'new' }) : denied());
    vi.stubGlobal('fetch', fetchMock);
    await expect(haveApiCall({ path: '/things' })).rejects.toMatchObject({ httpStatus: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('renews after rejected %s but only repeats on an explicit second call', async method => {
    setup(); const expired = vi.fn(); window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === sessionUrl) return json({ sessionKey: key, accessToken: 'new' });
      return (init?.headers as Record<string, string>)['X-Token'] === 'old'
        ? denied() : json({ status: true, response: { thing: { id: 42 } } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const opts = { method, path: '/things', namespace: 'thing', params: { name: 'original' } };
    const error = await haveApiCall(opts).catch(error => error);
    expect(error).toBeInstanceOf(Error);
    expect(isExpiredSessionError(error)).toBe(false);
    expect(isAmbiguousMutationError(error)).toBe(false);
    expect(fetchMock.mock.calls.filter(([url]) => url !== sessionUrl)).toHaveLength(1);
    expect(expired).not.toHaveBeenCalled();
    const result = await haveApiCall(opts);
    expect(result.data).toEqual({ id: 42 });
    const writes = fetchMock.mock.calls.filter(([url]) => url !== sessionUrl);
    expect(writes).toHaveLength(2);
    expect(writes[0]?.[1]?.body).toBe(writes[1]?.[1]?.body);
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });

  it('shares renewal between a read and a write without replaying the write', async () => {
    setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === sessionUrl) return json({ sessionKey: key, accessToken: 'new' });
      return (init?.headers as Record<string, string>)['X-Token'] === 'old'
        ? denied() : json({ status: true, response: { things: [42] } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const [read, write] = await Promise.allSettled([
      haveApiCall({ path: '/things' }), haveApiCall({ method: 'POST', path: '/things' }),
    ]);
    expect(read.status).toBe('fulfilled'); expect(write.status).toBe('rejected');
    if (write.status === 'rejected') expect(isExpiredSessionError(write.reason)).toBe(false);
    expect(fetchMock.mock.calls.filter(([url]) => url === sessionUrl)).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it.each(['cs', 'en'])('localizes the explicit resubmission message in %s', async language => {
    setup(); document.documentElement.lang = language;
    const fetchMock = vi.fn(async (url: string) => url === sessionUrl
      ? json({ sessionKey: key, accessToken: 'new' }) : denied());
    vi.stubGlobal('fetch', fetchMock);
    await expect(haveApiCall({ method: 'POST', path: '/things' })).rejects.toThrow(
      language === 'cs' ? 'Přihlášení bylo obnoveno.' : 'Your session was renewed.');
  });

  it('still expires a rejected write if the BFF login changed', async () => {
    setup();
    const fetchMock = vi.fn(async (url: string) => url === sessionUrl
      ? json({ sessionKey: 'b'.repeat(64), accessToken: 'new-account' }) : denied());
    vi.stubGlobal('fetch', fetchMock);
    const error = await haveApiCall({ method: 'POST', path: '/things' }).catch(error => error);
    expect(isExpiredSessionError(error)).toBe(true);
    expect(window.vpsAdmin?.accessToken).toBe('old');
    expect(fetchMock.mock.calls.filter(([url]) => url !== sessionUrl)).toHaveLength(1);
  });

  it.each(['<html>proxy failure</html>', '{}'])('preserves ambiguous write handling for malformed 401 %s', async body => {
    setup(); const fetchMock = vi.fn(async () => new Response(body, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const error = await haveApiCall({ method: 'POST', path: '/things' }).catch(error => error);
    expect(isAmbiguousMutationError(error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not recover a standalone token or a legacy BFF without a fingerprint', async () => {
    setup(); rememberBffSession(sessionUrl, undefined, 'old');
    const fetchMock = vi.fn(async () => denied()); vi.stubGlobal('fetch', fetchMock);
    await expect(haveApiCall({ path: '/things' })).rejects.toMatchObject({ httpStatus: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a cancelled read or emit a session-expired event', async () => {
    setup(); const controller = new AbortController(); const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    const fetchMock = vi.fn(async (url: string) => {
      if (url !== sessionUrl) return denied();
      controller.abort(); return json({ sessionKey: key, accessToken: 'new' });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(haveApiCall({ path: '/things', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(expired).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });

  it('does not overwrite a local logout while the lookup is pending', async () => {
    setup();
    const fetchMock = vi.fn(async (url: string) => {
      if (url !== sessionUrl) return denied();
      window.vpsAdmin!.accessToken = undefined;
      return json({ sessionKey: key, accessToken: 'new' });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(haveApiCall({ path: '/things' })).rejects.toMatchObject({ httpStatus: 401 });
    expect(window.vpsAdmin?.accessToken).toBeUndefined();
  });
});
