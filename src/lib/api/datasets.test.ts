import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  createDataset,
  createDatasetSnapshot,
  createSnapshotDownload,
  deleteDataset,
  fetchDatasetPlans,
  fetchDatasetSnapshots,
  fetchDatasets,
  fetchEnvironmentDatasetPlans,
  fetchSnapshotDownloads,
  findDatasetByName,
  rollbackDatasetSnapshot,
  updateDataset,
} from './datasets';

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

describe('datasets API wrappers', () => {
  test('fetchDatasets uses only declared Dataset#index params', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({
      datasets: [{ id: 1, name: 'tank/user' }],
      _meta: { total_count: 1 },
    });
    vi.stubGlobal('fetch', fetchMock);

    if (false) {
      // @ts-expect-error Dataset#index has no q filter in the API contract.
      void fetchDatasets({ q: 'legacy-search' });
    }
    await fetchDatasets({
      limit: 42,
      includes: 'vps',
      count: true,
      role: 'hypervisor',
      q: 'legacy-search',
    } as never);

    const [url] = firstFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/datasets');
    expect(u.searchParams.get('dataset[limit]')).toBe('42');
    expect(u.searchParams.has('dataset[q]')).toBe(false);
    expect(u.searchParams.get('dataset[role]')).toBe('hypervisor');
    expect(u.searchParams.get('_meta[includes]')).toBe('vps');
    expect(u.searchParams.get('_meta[count]')).toBe('true');
  });

  test('fetchDatasetSnapshots uses only supported pagination params', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({
      snapshots: [{ id: 9, name: '@s1', dataset: { id: 123 } }],
      _meta: { total_count: 1 },
    });
    vi.stubGlobal('fetch', fetchMock);

    if (false) {
      // @ts-expect-error Snapshot#index has no q filter in the API contract.
      void fetchDatasetSnapshots(123, { q: 'legacy-search' });
    }
    await fetchDatasetSnapshots(123, {
      fromId: 9,
      limit: 10,
      count: true,
      q: 'legacy-search',
    } as never);

    const [url] = firstFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/datasets/123/snapshots');
    expect(u.searchParams.get('snapshot[from_id]')).toBe('9');
    expect(u.searchParams.get('snapshot[limit]')).toBe('10');
    expect(u.searchParams.has('snapshot[q]')).toBe(false);
    expect(u.searchParams.get('_meta[count]')).toBe('true');
  });

  test('findDatasetByName uses the declared exact-name action and optional owner', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({ dataset: { id: 9, name: 'tank/user/app' } });
    vi.stubGlobal('fetch', fetchMock);

    await findDatasetByName('tank/user/app', 42);

    const [url] = firstFetchCall(fetchMock);
    const u = new URL(String(url));
    expect(u.pathname).toBe('/v7.0/datasets/find_by_name');
    expect(u.searchParams.get('dataset[name]')).toBe('tank/user/app');
    expect(u.searchParams.get('dataset[user]')).toBe('42');
    expect(u.searchParams.has('dataset[q]')).toBe(false);
  });

  test('dataset plan lists serialize the requested nested resource includes', async () => {
    setMockRuntime();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          status: true,
          response: { plans: [], _meta: { total_count: 0 } },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          status: true,
          response: { dataset_plans: [], _meta: { total_count: 0 } },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await fetchDatasetPlans(123, {
      limit: 200,
      includes: 'environment_dataset_plan__dataset_plan',
    });
    await fetchEnvironmentDatasetPlans(7, { limit: 200, includes: 'dataset_plan' });

    const assignedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const availableUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));

    expect(assignedUrl.pathname).toBe('/v7.0/datasets/123/plans');
    expect(assignedUrl.searchParams.get('plan[limit]')).toBe('200');
    expect(assignedUrl.searchParams.get('_meta[includes]')).toBe(
      'environment_dataset_plan__dataset_plan'
    );
    expect(availableUrl.pathname).toBe('/v7.0/environments/7/dataset_plans');
    expect(availableUrl.searchParams.get('dataset_plan[limit]')).toBe('200');
    expect(availableUrl.searchParams.get('_meta[includes]')).toBe('dataset_plan');
  });

  test('createDatasetSnapshot sends namespaced payload', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({ snapshot: { id: 9, name: '@s1' } });
    vi.stubGlobal('fetch', fetchMock);

    await createDatasetSnapshot(123, { label: 'before-upgrade' });

    const [, init] = firstFetchCall(fetchMock);
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');

    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ snapshot: { label: 'before-upgrade' } });
  });

  test('rollback requires a valid action-state id', async () => {
    setMockRuntime();
    vi.stubGlobal('fetch', mockFetchOk({ ok: true, _meta: {} }));

    await expect(rollbackDatasetSnapshot(123, 9)).rejects.toMatchObject({
      code: 'MISSING_ACTION_STATE',
    });
  });

  test('rollback accepts and preserves a valid action-state id', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({ _meta: { action_state_id: 812 } });
    vi.stubGlobal('fetch', fetchMock);

    await expect(rollbackDatasetSnapshot(123, 9)).resolves.toMatchObject({
      meta: { action_state_id: 812 },
    });
    const [url, init] = firstFetchCall(fetchMock);
    expect(String(url)).toContain('/v7.0/datasets/123/snapshots/9/rollback');
    expect(init?.method).toBe('POST');
  });

  test('createDataset sends dataset namespace with parent and properties', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({ dataset: { id: 124, name: 'tank/user/app' } });
    vi.stubGlobal('fetch', fetchMock);

    await createDataset({ dataset: 123, name: 'app', automount: true, refquota: 10240, compression: true });

    const [url, init] = firstFetchCall(fetchMock);
    expect(String(url)).toContain('/v7.0/datasets');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      dataset: { dataset: 123, name: 'app', automount: true, refquota: 10240, compression: true },
    });
  });

  test('updateDataset sends editable properties to dataset namespace', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk(null);
    vi.stubGlobal('fetch', fetchMock);

    await updateDataset(123, { quota: 20480, sync: 'standard', admin_override: true, admin_lock_type: 'not_more' });

    const [url, init] = firstFetchCall(fetchMock);
    expect(String(url)).toContain('/v7.0/datasets/123');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({
      dataset: { quota: 20480, sync: 'standard', admin_override: true, admin_lock_type: 'not_more' },
    });
  });

  test('deleteDataset uses dataset endpoint', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk(null);
    vi.stubGlobal('fetch', fetchMock);

    await deleteDataset(123);

    const [url, init] = firstFetchCall(fetchMock);
    expect(String(url)).toContain('/v7.0/datasets/123');
    expect(init?.method).toBe('DELETE');
  });

  test('createSnapshotDownload sends snapshot_download namespace', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({ snapshot_download: { id: 5, state: 'ready' } });
    vi.stubGlobal('fetch', fetchMock);

    await createSnapshotDownload({ snapshot: 9, format: 'archive', send_mail: false });

    const [, init] = firstFetchCall(fetchMock);
    const body = JSON.parse(String(init?.body));

    expect(body).toEqual({ snapshot_download: { snapshot: 9, format: 'archive', send_mail: false } });
  });

  test('fetchSnapshotDownloads preserves supported filters and omits unsupported q', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({
      snapshot_downloads: [{ id: 7, snapshot: { id: 9 }, format: 'archive' }],
      _meta: { total_count: 1 },
    });
    vi.stubGlobal('fetch', fetchMock);

    if (false) {
      // @ts-expect-error SnapshotDownload#index has no q filter in the API contract.
      void fetchSnapshotDownloads({ q: 'legacy-search' });
    }
    await fetchSnapshotDownloads({
      dataset: 123,
      snapshot: 9,
      fromId: 7,
      limit: 5,
      includes: 'snapshot__dataset',
      count: true,
      q: 'legacy-search',
    } as never);

    const [url] = firstFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/snapshot_downloads');
    expect(u.searchParams.get('snapshot_download[dataset]')).toBe('123');
    expect(u.searchParams.get('snapshot_download[snapshot]')).toBe('9');
    expect(u.searchParams.get('snapshot_download[from_id]')).toBe('7');
    expect(u.searchParams.get('snapshot_download[limit]')).toBe('5');
    expect(u.searchParams.has('snapshot_download[q]')).toBe(false);
    expect(u.searchParams.get('_meta[includes]')).toBe('snapshot__dataset');
    expect(u.searchParams.get('_meta[count]')).toBe('true');
  });
});
