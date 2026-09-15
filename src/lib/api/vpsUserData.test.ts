import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  deployVpsUserData,
  fetchVpsUserDataList,
  VPS_USER_DATA_SCAN_BATCH_SIZE,
  VPS_USER_DATA_SCAN_MAX_ROWS,
  VpsUserDataScanIncompleteError,
  type VpsUserData,
} from './vpsUserData';

function setMockRuntime() {
  window.vpsAdmin = {
    api: { url: 'https://api.example.test', version: 'v7.0' },
    sessionToken: 'tok_123',
    description: {
      meta: { namespace: '_meta' },
      authentication: { token: { http_header: 'X-Auth-Token' } },
    },
  };
}

function makeResponse(response: unknown) {
  return new Response(JSON.stringify({ status: true, response }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeListResponse(rows: VpsUserData[], meta?: Record<string, unknown>) {
  return makeResponse({
    vps_user_data: rows,
    ...(meta ? { _meta: meta } : {}),
  });
}

function userData(id: number, label = `Template ${id}`, format = 'script'): VpsUserData {
  return { id, label, format };
}

function requestUrl(fetchMock: ReturnType<typeof vi.fn>, index: number): URL {
  return new URL(String(fetchMock.mock.calls[index]?.[0]));
}

beforeEach(() => {
  setMockRuntime();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.vpsAdmin = undefined;
});

describe('fetchVpsUserDataList', () => {
  test('uses one raw request without q and sends only supported index parameters', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      makeListResponse([userData(41), userData(42)], { total_count: 2 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchVpsUserDataList({
      user: 7,
      format: 'script',
      q: '   ',
      limit: 2,
      fromId: 40,
    });

    expect(result).toEqual({
      data: [userData(41), userData(42)],
      meta: { total_count: 2 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const url = requestUrl(fetchMock, 0);
    expect(url.pathname).toBe('/v7.0/vps_user_data');
    expect(url.searchParams.get('vps_user_data[user]')).toBe('7');
    expect(url.searchParams.get('vps_user_data[format]')).toBe('script');
    expect(url.searchParams.get('vps_user_data[limit]')).toBe('2');
    expect(url.searchParams.get('vps_user_data[from_id]')).toBe('40');
    expect(url.searchParams.has('vps_user_data[q]')).toBe(false);
  });

  test('finds case-insensitive label matches in a later raw batch while retaining scope', async () => {
    const firstPage = Array.from(
      { length: VPS_USER_DATA_SCAN_BATCH_SIZE },
      (_, index) => userData(index + 1, `Unrelated ${index + 1}`),
    );
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input));
      const fromId = url.searchParams.get('vps_user_data[from_id]');

      if (fromId === null) return makeListResponse(firstPage, { total_count: VPS_USER_DATA_SCAN_BATCH_SIZE + 4 });
      if (fromId === String(VPS_USER_DATA_SCAN_BATCH_SIZE)) {
        return makeListResponse([
          userData(VPS_USER_DATA_SCAN_BATCH_SIZE + 1, 'Still unrelated'),
          userData(VPS_USER_DATA_SCAN_BATCH_SIZE + 2, 'Provision Nginx'),
          userData(VPS_USER_DATA_SCAN_BATCH_SIZE + 3, 'NGINX backup'),
          userData(VPS_USER_DATA_SCAN_BATCH_SIZE + 4, 'nginx sentinel'),
        ]);
      }
      throw new Error(`Unexpected cursor ${fromId}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchVpsUserDataList({
      user: 7,
      format: 'script',
      q: '  nGiNx  ',
      limit: 2,
    });

    expect(result).toEqual({
      data: [
        userData(VPS_USER_DATA_SCAN_BATCH_SIZE + 2, 'Provision Nginx'),
        userData(VPS_USER_DATA_SCAN_BATCH_SIZE + 3, 'NGINX backup'),
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    for (let index = 0; index < 2; index += 1) {
      const url = requestUrl(fetchMock, index);
      expect(url.searchParams.get('vps_user_data[user]')).toBe('7');
      expect(url.searchParams.get('vps_user_data[format]')).toBe('script');
      expect(url.searchParams.get('vps_user_data[limit]')).toBe(String(VPS_USER_DATA_SCAN_BATCH_SIZE));
      expect(url.searchParams.has('vps_user_data[q]')).toBe(false);
    }
    expect(requestUrl(fetchMock, 0).searchParams.has('vps_user_data[from_id]')).toBe(false);
    expect(requestUrl(fetchMock, 1).searchParams.get('vps_user_data[from_id]')).toBe(
      String(VPS_USER_DATA_SCAN_BATCH_SIZE),
    );
  });

  test('keeps the 200-row UI option compatible with its lookahead request', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(makeListResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchVpsUserDataList({ q: 'needle', limit: 201 })).resolves.toEqual({ data: [] });
    expect(requestUrl(fetchMock, 0).searchParams.get('vps_user_data[limit]')).toBe('201');
  });

  test.each(['12', '#12'])('matches a full numeric search %s by exact ID only', async (q) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      makeListResponse([
        userData(12, 'Exact'),
        userData(120, 'Template 12'),
        userData(212, '#12 in a label'),
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchVpsUserDataList({ q, limit: 5 });

    expect(result.data.map((row) => row.id)).toEqual([12]);
    expect(requestUrl(fetchMock, 0).searchParams.has('vps_user_data[q]')).toBe(false);
  });

  test('stops an exact-ID search as soon as the unique match is found', async () => {
    const page = Array.from(
      { length: VPS_USER_DATA_SCAN_BATCH_SIZE },
      (_, index) => userData(index + 1, index === 11 ? 'Exact' : 'unrelated'),
    );
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(makeListResponse(page));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchVpsUserDataList({ q: '#12', limit: 51 })).resolves.toEqual({
      data: [userData(12, 'Exact')],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('stops an absent exact-ID search as soon as the ascending cursor passes it', async () => {
    const page = Array.from(
      { length: VPS_USER_DATA_SCAN_BATCH_SIZE },
      (_, index) => userData(index + 13, 'unrelated'),
    );
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(makeListResponse(page));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchVpsUserDataList({ q: '#12', limit: 51 })).resolves.toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('does not request an exact ID at or behind the supplied cursor', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchVpsUserDataList({ q: '12', fromId: 12, limit: 51 })).resolves.toEqual({
      data: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each([
    { options: { user: 0 }, field: 'user ID' },
    { options: { fromId: Number.MAX_SAFE_INTEGER + 1 }, field: 'from_id' },
  ])('rejects an invalid positive-safe $field before making a request', async ({ options }) => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchVpsUserDataList({ ...options, q: 'needle' })).rejects.toMatchObject({
      code: 'VPS_USER_DATA_SCAN_INCOMPLETE',
      reason: 'invalid_id',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each([undefined, 'needle'])('rejects invalid result IDs when q is %s', async (q) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      makeListResponse([userData(0, 'needle')]),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchVpsUserDataList({ q, limit: 1 })).rejects.toMatchObject({
      code: 'VPS_USER_DATA_SCAN_INCOMPLETE',
      reason: 'invalid_id',
    });
  });

  test('fails explicitly when a full follow-up page does not advance beyond from_id', async () => {
    const firstPage = Array.from(
      { length: VPS_USER_DATA_SCAN_BATCH_SIZE },
      (_, index) => userData(index + 1, 'unrelated'),
    );
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(makeListResponse(firstPage))
      .mockResolvedValueOnce(makeListResponse([
        userData(VPS_USER_DATA_SCAN_BATCH_SIZE, 'still repeated'),
      ]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchVpsUserDataList({ q: 'needle', limit: 1 })).rejects.toMatchObject({
      code: 'VPS_USER_DATA_SCAN_INCOMPLETE',
      reason: 'cursor_stalled',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestUrl(fetchMock, 1).searchParams.get('vps_user_data[from_id]')).toBe(
      String(VPS_USER_DATA_SCAN_BATCH_SIZE),
    );
  });

  test.each([
    { label: 'decreasing filtered', q: 'needle', rows: [userData(2, 'unrelated'), userData(1, 'needle')] },
    { label: 'duplicate filtered', q: 'needle', rows: [userData(1, 'unrelated'), userData(1, 'needle')] },
    { label: 'decreasing unfiltered', q: undefined, rows: [userData(2), userData(1)] },
  ])('rejects a $label raw page instead of advancing an unsafe cursor', async ({ q, rows }) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(makeListResponse(rows));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchVpsUserDataList({ q, limit: 2 })).rejects.toMatchObject({
      code: 'VPS_USER_DATA_SCAN_INCOMPLETE',
      reason: 'cursor_stalled',
    });
  });

  test('fails explicitly at the scan bound even with requestedLimit - 1 matches', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input));
      const fromId = Number(url.searchParams.get('vps_user_data[from_id]') ?? 0);
      return makeListResponse(Array.from(
        { length: VPS_USER_DATA_SCAN_BATCH_SIZE },
        (_, index) => userData(
          fromId + index + 1,
          fromId === 0 && index < 2 ? `needle ${index + 1}` : 'unrelated',
        ),
      ));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchVpsUserDataList({ q: 'needle', limit: 3 })).rejects.toEqual(
      expect.objectContaining({
        name: VpsUserDataScanIncompleteError.name,
        code: 'VPS_USER_DATA_SCAN_INCOMPLETE',
        reason: 'scan_limit',
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(
      VPS_USER_DATA_SCAN_MAX_ROWS / VPS_USER_DATA_SCAN_BATCH_SIZE,
    );
    expect(
      requestUrl(fetchMock, fetchMock.mock.calls.length - 1).searchParams.get('vps_user_data[from_id]'),
    ).toBe(String(VPS_USER_DATA_SCAN_MAX_ROWS - VPS_USER_DATA_SCAN_BATCH_SIZE));
  });
});

describe('VPS user-data blocking mutation contract', () => {
  test('fails closed when deploy omits its action-state id', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(makeResponse({ _meta: {} })));

    await expect(deployVpsUserData(17, 42)).rejects.toMatchObject({ code: 'MISSING_ACTION_STATE' });
  });

  test('accepts deploy only with a valid action-state id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(makeResponse({ _meta: { action_state_id: 731 } })),
    );

    await expect(deployVpsUserData(17, 42)).resolves.toEqual({ meta: { action_state_id: 731 } });
  });
});
