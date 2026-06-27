import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchUserClusterResources } from './clusterResources';

function mockFetchOk(response: any) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response }) });
}

function installApiFixture() {
  (window as LegacyAny).vpsAdmin = {
    api: { url: 'https://api.example.test', version: 'v7.0' },
    sessionToken: 'tok_123',
    description: {
      meta: { namespace: '_meta' },
      authentication: {
        token: { http_header: 'X-Auth-Token' },
      },
    },
  };
}

beforeEach(() => {
  installApiFixture();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  (window as LegacyAny).vpsAdmin = undefined;
});

describe('cluster resources API wrappers', () => {
  test('fetchUserClusterResources uses nested user cluster_resources endpoint and includes resource metadata', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOk({
        cluster_resources: [
          {
            id: 501,
            environment: { id: 1, label: 'Production' },
            cluster_resource: { id: 2, label: 'CPU' },
            value: 4,
          },
        ],
      })
    );

    const res = await fetchUserClusterResources(7, { limit: 50, fromId: 99 });

    expect(res.data).toEqual([
      {
        id: 501,
        environment: { id: 1, label: 'Production' },
        cluster_resource: { id: 2, label: 'CPU' },
        value: 4,
      },
    ]);

    const [url] = (globalThis.fetch as LegacyAny).mock.calls[0] as [string, RequestInit];
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/users/7/cluster_resources');
    expect(u.searchParams.get('cluster_resource[limit]')).toBe('50');
    expect(u.searchParams.get('cluster_resource[from_id]')).toBe('99');
    expect(u.searchParams.get('_meta[includes]')).toBe('environment,cluster_resource');
  });
});
