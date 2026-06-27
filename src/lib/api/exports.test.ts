import { afterEach, describe, expect, test, vi } from 'vitest';

import { createExport, fetchExports } from './exports';

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

function firstFetchCall(fetchMock: ReturnType<typeof mockFetchOk>): Parameters<typeof fetch> {
  return fetchMock.mock.calls[0]! as Parameters<typeof fetch>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.vpsAdmin = undefined;
});

describe('exports API wrappers', () => {
  test('fetchExports uses legacy index whitelist and omits client-only filters', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({
      exports: [{ id: 1, path: '/export/spec', enabled: true }],
      _meta: { total_count: 1 },
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchExports({
      limit: 25,
      fromId: 99,
      q: 'spec',
      dataset: 123,
      user: 55,
      enabled: false,
      includes: 'dataset,snapshot,host_ip_address,user',
    });

    const [url] = firstFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/exports');
    expect(u.searchParams.get('export[limit]')).toBe('25');
    expect(u.searchParams.get('export[from_id]')).toBe('99');
    expect(u.searchParams.get('export[q]')).toBeNull();
    expect(u.searchParams.get('export[dataset]')).toBeNull();
    expect(u.searchParams.get('export[user]')).toBeNull();
    expect(u.searchParams.get('export[enabled]')).toBeNull();
    expect(u.searchParams.get('_meta[includes]')).toBe('dataset,snapshot,host_ip_address,user');
  });

  test('createExport sends export namespace', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({ export: { id: 9, path: '/export/spec' } });
    vi.stubGlobal('fetch', fetchMock);

    await createExport({ dataset: 123, host_ip_address: 456, enabled: true, rw: true, threads: 8 });

    const [, init] = firstFetchCall(fetchMock);
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');

    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      export: {
        dataset: 123,
        host_ip_address: 456,
        enabled: true,
        rw: true,
      },
    });
  });
});
