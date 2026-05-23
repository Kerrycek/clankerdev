import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchUsers } from './users';

function makeOkResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeUsersResponse(rows: unknown[]) {
  return makeOkResponse({ status: true, response: { users: rows } });
}

afterEach(() => {
  vi.restoreAllMocks();
  (window as any).vpsAdmin = undefined;
});

describe('fetchUsers', () => {
  function installApiFixture() {
    (window as any).vpsAdmin = {
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

  it('uses only supported upstream params when no compatibility scan is needed', async () => {
    installApiFixture();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeUsersResponse([{ id: 125, login: 'admin', level: 90, mailer_enabled: false }])
    );

    const res = await fetchUsers({
      limit: 25,
      fromId: 150,
      role: 'admin',
      level: 90,
      mailerEnabled: false,
    });

    expect(res.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.searchParams.get('user[limit]')).toBe('25');
    expect(parsed.searchParams.get('user[from_id]')).toBe('150');
    expect(parsed.searchParams.get('user[level]')).toBe('90');
    expect(parsed.searchParams.get('user[mailer_enabled]')).toBe('false');
    expect(parsed.searchParams.get('user[admin]')).toBe('true');

    expect(parsed.searchParams.get('user[q]')).toBeNull();
    expect(parsed.searchParams.get('user[role]')).toBeNull();
    expect(init.headers).toMatchObject({ 'X-Auth-Token': 'tok_123' });
  });

  it('scans keyset pages and filters client-side for legacy q/role filters', async () => {
    installApiFixture();

    const firstBatch = Array.from({ length: 100 }, (_, idx) => ({
      id: 200 - idx,
      login: `plain-${200 - idx}`,
      level: idx % 3 === 0 ? 21 : 10,
    }));

    const secondBatch = [
      { id: 100, login: 'alpha', level: 21 },
      { id: 99, login: 'bobby', level: 21 },
      { id: 98, login: 'bobette', level: 10 },
      { id: 97, login: 'delta', level: 21 },
      { id: 96, login: 'bob-support', level: 21 },
    ];

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const parsed = new URL(String(input));
      const fromId = parsed.searchParams.get('user[from_id]');

      if (!fromId) {
        return makeUsersResponse(firstBatch);
      }

      if (fromId === '101') {
        return makeUsersResponse(secondBatch);
      }

      return makeUsersResponse([]);
    });

    const res = await fetchUsers({
      limit: 2,
      q: 'bob',
      role: 'support',
    });

    expect(res.data.map((u) => u.id)).toEqual([99, 96]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const secondUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));

    // Compatibility scan intentionally avoids stale upstream params like q/role.
    expect(firstUrl.searchParams.get('user[q]')).toBeNull();
    expect(firstUrl.searchParams.get('user[role]')).toBeNull();
    expect(firstUrl.searchParams.get('user[limit]')).toBe('100');

    expect(secondUrl.searchParams.get('user[from_id]')).toBe('101');
    expect(secondUrl.searchParams.get('user[q]')).toBeNull();
    expect(secondUrl.searchParams.get('user[role]')).toBeNull();
  });

  it('applies boolean compatibility filters client-side', async () => {
    installApiFixture();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeUsersResponse([
        { id: 120, login: 'plain', level: 21, lockout: false },
        { id: 119, login: 'locked', level: 21, lockout: true },
        { id: 118, login: 'reset', level: 21, password_reset: true },
      ])
    );

    const res = await fetchUsers({ limit: 5, lockout: true });

    expect(res.data.map((u) => u.id)).toEqual([119]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get('user[lockout]')).toBeNull();
  });
});
