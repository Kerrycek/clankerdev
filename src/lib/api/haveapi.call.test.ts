import { afterEach, describe, expect, it, vi } from 'vitest';

import { getMetaActionStateId, haveApiCall, isExpiredSessionError, SESSION_EXPIRED_EVENT } from './haveapi';

function makeOkResponse(body: unknown, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders ?? {}) },
  });
}

function setMockRuntime(metaNamespace = '_meta') {
  window.vpsAdmin = {
    api: { url: 'https://api.example.test', version: 'v7.0' },
    sessionToken: 'tok_123',
    description: {
      meta: { namespace: metaNamespace },
      authentication: {
        token: { http_header: 'X-Auth-Token' },
      },
    },
  };
}

function installOkFetch(response: unknown) {
  const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
    makeOkResponse({ status: true, response })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function getFetchCall(fetchMock: ReturnType<typeof installOkFetch>, index = 0): Parameters<typeof fetch> {
  return fetchMock.mock.calls[index]! as Parameters<typeof fetch>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.vpsAdmin = undefined;
});

describe('haveApiCall', () => {
  it('sends token via provider-specific http_header from description and uses meta namespace for query', async () => {
    setMockRuntime();
    const fetchMock = installOkFetch({ _meta: { elapsed: 1 }, vps: [] });

    await haveApiCall<any[]>({
      method: 'GET',
      path: '/vps',
      namespace: 'vps',
      params: { limit: 10, hostname_any: 'abc' },
      meta: { count: true },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = getFetchCall(fetchMock);

    expect(String(url)).toContain('https://api.example.test/v7.0/vps?');
    expect(String(url)).toContain('vps%5Blimit%5D=10');
    expect(String(url)).toContain('vps%5Bhostname_any%5D=abc');
    expect(String(url)).toContain('_meta%5Bcount%5D=true');

    const headers = new Headers(init?.headers);
    expect(headers.get('X-Auth-Token')).toBe('tok_123');
    expect(init?.credentials).toBe('same-origin');
  });

  it('sends JSON body (even for DELETE) and uses meta namespace for body key', async () => {
    setMockRuntime('meta');
    const fetchMock = installOkFetch({ meta: { elapsed: 1 }, ok: true });

    await haveApiCall<any>({
      method: 'DELETE',
      path: '/vps/1',
      namespace: 'vps',
      params: { force: true },
      meta: { api: 'test' },
    });

    const [, init] = getFetchCall(fetchMock);
    expect(init?.method).toBe('DELETE');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');

    const parsed = JSON.parse(String(init?.body));
    expect(parsed).toEqual({ vps: { force: true }, meta: { api: 'test' } });
  });

  it('sends {} body for POST with no params/meta to match legacy clients', async () => {
    setMockRuntime('meta');
    const fetchMock = installOkFetch({ meta: { elapsed: 1 }, ok: true });

    await haveApiCall<any>({
      method: 'POST',
      path: '/vps/1/start',
    });

    const [, init] = getFetchCall(fetchMock);
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(init?.body).toBe('{}');
  });

  it('uses the current runtime session token for each request (no internal token caching)', async () => {
    setMockRuntime();
    const fetchMock = installOkFetch({ _meta: { elapsed: 1 }, ok: true });

    await haveApiCall<any>({ method: 'GET', path: '/users/current' });
    const [, init1] = getFetchCall(fetchMock, 0);
    expect(new Headers(init1?.headers).get('X-Auth-Token')).toBe('tok_123');

    if (window.vpsAdmin) {
      window.vpsAdmin.sessionToken = 'tok_456';
    }

    await haveApiCall<any>({ method: 'GET', path: '/users/current' });
    const [, init2] = getFetchCall(fetchMock, 1);
    expect(new Headers(init2?.headers).get('X-Auth-Token')).toBe('tok_456');
  });

  it('emits a session-expired event on HTTP 401 responses', async () => {
    setMockRuntime();
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ status: false, message: 'Unauthorized', response: null }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    try {
      await haveApiCall<any>({ method: 'GET', path: '/action_states' });
      throw new Error('expected request to fail');
    } catch (err) {
      expect(isExpiredSessionError(err)).toBe(true);
    }
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });

  it('emits a session-expired event on HaveAPI expired-session envelopes', async () => {
    setMockRuntime();
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        makeOkResponse({ status: false, message: 'Session expired', response: null })
      )
    );

    try {
      await haveApiCall<any>({ method: 'GET', path: '/action_states' });
      throw new Error('expected request to fail');
    } catch (err) {
      expect(isExpiredSessionError(err)).toBe(true);
    }
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });
});

describe('getMetaActionStateId', () => {
  it('accepts current and legacy action-state meta shapes', () => {
    expect(getMetaActionStateId({ action_state_id: 42 })).toBe(42);
    expect(getMetaActionStateId({ state_id: '43' })).toBe(43);
    expect(getMetaActionStateId({ action_state: 44 })).toBe(44);
    expect(getMetaActionStateId({ action_state: { id: '45' } })).toBe(45);
  });
});
