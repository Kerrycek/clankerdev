import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  createDatasetSnapshot,
  createSnapshotDownload,
  fetchDatasetSnapshots,
  fetchDatasets,
  fetchSnapshotDownloads,
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
  test('fetchDatasets uses dataset namespace and preserves params', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({
      datasets: [{ id: 1, name: 'tank/user' }],
      _meta: { total_count: 1 },
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchDatasets({ limit: 42, includes: 'vps' });

    const [url] = firstFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/datasets');
    expect(u.searchParams.get('dataset[limit]')).toBe('42');
    expect(u.searchParams.get('_meta[includes]')).toBe('vps');
  });

  test('fetchDatasetSnapshots uses snapshot namespace and dataset-scoped endpoint', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({
      snapshots: [{ id: 9, name: '@s1', dataset: { id: 123 } }],
      _meta: { total_count: 1 },
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchDatasetSnapshots(123, { limit: 10 });

    const [url] = firstFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/datasets/123/snapshots');
    expect(u.searchParams.get('snapshot[limit]')).toBe('10');
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

  test('createSnapshotDownload sends snapshot_download namespace', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({ snapshot_download: { id: 5, state: 'ready' } });
    vi.stubGlobal('fetch', fetchMock);

    await createSnapshotDownload({ snapshot: 9, format: 'archive', send_mail: false });

    const [, init] = firstFetchCall(fetchMock);
    const body = JSON.parse(String(init?.body));

    expect(body).toEqual({ snapshot_download: { snapshot: 9, format: 'archive', send_mail: false } });
  });

  test('fetchSnapshotDownloads preserves dataset and q params', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({
      snapshot_downloads: [{ id: 7, snapshot: { id: 9 }, format: 'archive' }],
      _meta: { total_count: 1 },
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchSnapshotDownloads({ dataset: 123, q: 'archive', limit: 5 });

    const [url] = firstFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/snapshot_downloads');
    expect(u.searchParams.get('snapshot_download[dataset]')).toBe('123');
    expect(u.searchParams.get('snapshot_download[q]')).toBe('archive');
    expect(u.searchParams.get('snapshot_download[limit]')).toBe('5');
  });
});
