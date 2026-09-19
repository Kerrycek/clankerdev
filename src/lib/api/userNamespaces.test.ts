import { afterEach, describe, expect, test, vi } from 'vitest';

import { fetchUserNamespaceMaps, fetchUserNamespaces } from './userNamespaces';

function setMockRuntime() {
  window.vpsAdmin = {
    api: { url: 'https://api.example.test', version: 'v7.0' },
    description: { meta: { namespace: '_meta' } },
  };
}

function mockFetchOk(response: unknown) {
  return vi.fn(async (..._args: Parameters<typeof fetch>) =>
    new Response(JSON.stringify({ status: true, response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.vpsAdmin = undefined;
});

describe('user namespace API wrappers', () => {
  test('namespace index sends only supported pagination, owner, size and block fields', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({ user_namespaces: [{ id: 101, size: 65536 }] });
    vi.stubGlobal('fetch', fetchMock);

    await fetchUserNamespaces({
      limit: 25,
      fromId: 900,
      size: 65536,
      userId: 84,
      blockCount: 3,
      // Runtime callers with an obsolete shape still cannot leak q to HaveAPI.
      q: 'legacy',
    } as Parameters<typeof fetchUserNamespaces>[0] & { q: string });

    const [url] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));

    expect(parsed.pathname).toBe('/v7.0/user_namespaces');
    expect(Object.fromEntries(parsed.searchParams.entries())).toEqual({
      'user_namespace[limit]': '25',
      'user_namespace[from_id]': '900',
      'user_namespace[size]': '65536',
      'user_namespace[user]': '84',
      'user_namespace[block_count]': '3',
    });
    expect(parsed.searchParams.has('user_namespace[q]')).toBe(false);
  });

  test('map index sends only supported pagination, owner and namespace fields', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({ user_namespace_maps: [{ id: 501, label: 'default' }] });
    vi.stubGlobal('fetch', fetchMock);

    await fetchUserNamespaceMaps({
      limit: 50,
      fromId: 800,
      userId: 84,
      userNamespaceId: 101,
      includeUserNamespace: true,
      q: 'default',
    } as Parameters<typeof fetchUserNamespaceMaps>[0] & { q: string });

    const [url] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));

    expect(parsed.pathname).toBe('/v7.0/user_namespace_maps');
    expect(Object.fromEntries(parsed.searchParams.entries())).toEqual({
      '_meta[includes]': 'user_namespace',
      'user_namespace_map[limit]': '50',
      'user_namespace_map[from_id]': '800',
      'user_namespace_map[user]': '84',
      'user_namespace_map[user_namespace]': '101',
    });
    expect(parsed.searchParams.has('user_namespace_map[q]')).toBe(false);
    expect(parsed.searchParams.get('_meta[includes]')).toBe('user_namespace');
  });

  test('map index does not force expansion on consumers that only need references', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({ user_namespace_maps: [{ id: 501, label: 'default' }] });
    vi.stubGlobal('fetch', fetchMock);

    await fetchUserNamespaceMaps({ limit: 250, userId: 84 });

    const [url] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.searchParams.get('_meta[includes]')).toBeNull();
  });
});
