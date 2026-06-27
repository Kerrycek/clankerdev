import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  createUserClusterResourcePackage,
  fetchClusterResourcePackages,
  fetchUserClusterResourcePackageItems,
  fetchUserClusterResourcePackages,
} from './clusterResourcePackages';

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

describe('cluster resource packages API wrappers', () => {
  test('fetchClusterResourcePackages forwards q, is_personal, environment, and user filters', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOk({
        cluster_resource_packages: [{ id: 77, label: 'Personal package', is_personal: true }],
        _meta: { total_count: 1 },
      })
    );

    const res = await fetchClusterResourcePackages({
      q: 'alice',
      isPersonal: true,
      environmentId: 5,
      userId: 9,
      limit: 20,
      fromId: 40,
    });

    expect(res.data).toEqual([{ id: 77, label: 'Personal package', is_personal: true }]);

    const [url] = (globalThis.fetch as LegacyAny).mock.calls.find(([u]: [string]) => new URL(u).pathname.endsWith('/cluster_resource_packages'));
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/cluster_resource_packages');
    expect(u.searchParams.get('cluster_resource_package[q]')).toBe('alice');
    expect(u.searchParams.get('cluster_resource_package[is_personal]')).toBe('true');
    expect(u.searchParams.get('cluster_resource_package[environment]')).toBe('5');
    expect(u.searchParams.get('cluster_resource_package[user]')).toBe('9');
    expect(u.searchParams.get('cluster_resource_package[limit]')).toBe('20');
    expect(u.searchParams.get('cluster_resource_package[from_id]')).toBe('40');
    expect(u.searchParams.get('_meta[includes]')).toBe('environment,user');
  });

  test('fetchUserClusterResourcePackages forwards admin filters and package includes', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOk({
        user_cluster_resource_packages: [
          {
            id: 55,
            user: { id: 7, login: 'alice' },
            environment: { id: 1, label: 'Production' },
            cluster_resource_package: { id: 20, label: 'Default' },
            added_by: { id: 1, login: 'admin' },
          },
        ],
      })
    );

    const res = await fetchUserClusterResourcePackages({
      userId: 7,
      environmentId: 1,
      clusterResourcePackageId: 20,
      addedById: 1,
      limit: 25,
      fromId: 100,
    });

    expect(res.data).toHaveLength(1);

    const [url] = (globalThis.fetch as LegacyAny).mock.calls[0] as [string, RequestInit];
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/user_cluster_resource_packages');
    expect(u.searchParams.get('user_cluster_resource_package[user]')).toBe('7');
    expect(u.searchParams.get('user_cluster_resource_package[environment]')).toBe('1');
    expect(u.searchParams.get('user_cluster_resource_package[cluster_resource_package]')).toBe('20');
    expect(u.searchParams.get('user_cluster_resource_package[added_by]')).toBe('1');
    expect(u.searchParams.get('user_cluster_resource_package[limit]')).toBe('25');
    expect(u.searchParams.get('user_cluster_resource_package[from_id]')).toBe('100');
    expect(u.searchParams.get('_meta[includes]')).toBe('environment,user,added_by,cluster_resource_package');
  });

  test('createUserClusterResourcePackage posts assignment payload through the user_cluster_resource_package namespace', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOk({
        user_cluster_resource_package: {
          id: 88,
          user: { id: 7 },
          environment: { id: 1 },
          cluster_resource_package: { id: 20 },
        },
      })
    );

    await createUserClusterResourcePackage({
      environmentId: 1,
      userId: 7,
      clusterResourcePackageId: 20,
      comment: 'base quota',
      fromPersonal: true,
    });

    const [url, init] = (globalThis.fetch as LegacyAny).mock.calls[0] as [string, RequestInit];
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/user_cluster_resource_packages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      user_cluster_resource_package: {
        environment: 1,
        user: 7,
        cluster_resource_package: 20,
        comment: 'base quota',
        from_personal: true,
      },
    });
  });

  test('fetchUserClusterResourcePackageItems uses nested items endpoint with resource includes', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOk({
        items: [{ id: 90, value: 4, cluster_resource: { id: 2, label: 'CPU' } }],
      })
    );

    const res = await fetchUserClusterResourcePackageItems(88, { limit: 10, fromId: 90 });

    expect(res.data).toEqual([{ id: 90, value: 4, cluster_resource: { id: 2, label: 'CPU' } }]);

    const [url] = (globalThis.fetch as LegacyAny).mock.calls[0] as [string, RequestInit];
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/user_cluster_resource_packages/88/items');
    expect(u.searchParams.get('item[limit]')).toBe('10');
    expect(u.searchParams.get('item[from_id]')).toBe('90');
    expect(u.searchParams.get('_meta[includes]')).toBe('cluster_resource');
  });
});
