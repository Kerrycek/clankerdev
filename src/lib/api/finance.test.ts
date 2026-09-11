import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchFinanceUsersSnapshot } from './finance';

function makeOkResponse(resource: string, rows: unknown[]) {
  return new Response(JSON.stringify({ status: true, response: { [resource]: rows } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installApiFixture() {
  window.vpsAdmin = {
    api: { url: 'https://api.example.test', version: 'v7.0' },
    sessionToken: 'tok_123',
    description: {
      meta: { namespace: '_meta' },
      authentication: { token: { http_header: 'X-Auth-Token' } },
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  window.vpsAdmin = undefined;
});

describe('fetchFinanceUsersSnapshot', () => {
  it('uses the documented 1,000-row API page size to minimize global snapshot requests', async () => {
    installApiFixture();

    const activeUsers = Array.from({ length: 2_200 }, (_, index) => ({
      id: index + 1,
      login: `active-${index + 1}`,
      level: 1,
      object_state: 'active',
    }));
    const suspendedUsers = Array.from({ length: 300 }, (_, index) => ({
      id: 3_001 + index,
      login: `suspended-${index + 1}`,
      level: 1,
      object_state: 'suspended',
    }));

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      const fromId = Number(url.searchParams.get('user[from_id]') ?? 0);
      const limit = Number(url.searchParams.get('user[limit]'));
      const users = url.searchParams.get('user[object_state]') === 'suspended'
        ? suspendedUsers
        : activeUsers;
      return makeOkResponse('users', users.filter((user) => user.id > fromId).slice(0, limit));
    });

    const result = await fetchFinanceUsersSnapshot();

    expect(result).toMatchObject({ complete: true, scannedRows: 2_500, batches: 4 });
    expect(result.rows).toHaveLength(2_500);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get('user[limit]')))
      .toEqual(['1000', '1000', '1000', '1000']);
  });

  it('collects every keyset page and marks a trustworthy KPI snapshot complete', async () => {
    installApiFixture();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      const fromId = url.searchParams.get('user[from_id]');
      const objectState = url.searchParams.get('user[object_state]');
      if (objectState === 'suspended') {
        return makeOkResponse('users', [{ id: 4, login: 'four', level: 1, object_state: 'suspended' }]);
      }
      if (!fromId) {
        return makeOkResponse('users', [
          { id: 1, login: 'one', level: 1, object_state: 'active' },
          { id: 2, login: 'two', level: 1, object_state: 'active' },
        ]);
      }
      if (fromId === '2') {
        return makeOkResponse('users', [{ id: 3, login: 'three', level: 1, object_state: 'active' }]);
      }
      return makeOkResponse('users', []);
    });

    const result = await fetchFinanceUsersSnapshot({ batchSize: 2 });

    expect(result.rows.map((user) => user.id)).toEqual([1, 2, 3, 4]);
    expect(result).toMatchObject({ complete: true, scannedRows: 4, batches: 3 });
    expect(result.nextFromId).toBeUndefined();
    expect(result.incompleteReason).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get('user[object_state]')))
      .toEqual(['active', 'active', 'suspended']);
  });

  it('never presents a scan-limited user snapshot as a complete global set', async () => {
    installApiFixture();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      const fromId = Number(url.searchParams.get('user[from_id]') ?? 0);
      const limit = Number(url.searchParams.get('user[limit]'));
      return makeOkResponse(
        'users',
        Array.from({ length: limit }, (_, index) => ({
          id: fromId + index + 1,
          login: `user-${fromId + index + 1}`,
          level: 1,
        })),
      );
    });

    const result = await fetchFinanceUsersSnapshot({ batchSize: 2, scanLimit: 3 });

    expect(result.rows.map((user) => user.id)).toEqual([1, 2, 3]);
    expect(result).toMatchObject({
      nextFromId: 3,
      complete: false,
      scannedRows: 3,
      batches: 2,
      incompleteReason: 'scan_limit',
    });
  });

  it('fails closed when a full page does not advance the ascending user cursor', async () => {
    installApiFixture();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => (
      makeOkResponse('users', [
        { id: 1, login: 'one', level: 1, object_state: 'active' },
        { id: 2, login: 'two', level: 1, object_state: 'active' },
      ])
    ));

    const result = await fetchFinanceUsersSnapshot({ batchSize: 2 });

    expect(result).toMatchObject({
      complete: false,
      scannedRows: 4,
      batches: 2,
      incompleteReason: 'cursor_stalled',
    });
    expect(result.nextFromId).toBeUndefined();
  });
});
