import { describe, expect, test, vi } from 'vitest';

import { fetchVps, fetchVpsList, fetchVpsStatuses } from './vps';

function mockFetchOk(response: any) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response }) });
}

function lastFetchCall() {
  const calls = (globalThis.fetch as any).mock.calls;
  return calls[calls.length - 1] as [string, RequestInit?];
}

describe('vps API wrappers', () => {
  test('fetchVpsList forwards list filters', async () => {
    globalThis.fetch = mockFetchOk({ vpses: [], _meta: { total_count: 0 } }) as any;

    await fetchVpsList({
      limit: 25,
      fromId: 123,
      hostnameAny: 'db',
      user: 42,
      node: 7,
      userNamespaceMap: 3,
      location: 2,
      environment: 9,
    });

    const [url] = lastFetchCall();
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/vpses');
    expect(u.searchParams.get('vps[limit]')).toBe('25');
    expect(u.searchParams.get('vps[from_id]')).toBe('123');
    expect(u.searchParams.get('vps[hostname_any]')).toBe('db');
    expect(u.searchParams.get('vps[user]')).toBe('42');
    expect(u.searchParams.get('vps[node]')).toBe('7');
    expect(u.searchParams.get('vps[user_namespace_map]')).toBe('3');
    expect(u.searchParams.get('vps[location]')).toBe('2');
    expect(u.searchParams.get('vps[environment]')).toBe('9');
  });

  test('fetchVpsStatuses forwards time-window and cursor params', async () => {
    globalThis.fetch = mockFetchOk({ statuses: [], _meta: { total_count: 0 } }) as any;

    await fetchVpsStatuses(321, {
      limit: 80,
      fromId: 456,
      from: '2026-03-01T00:00:00Z',
      to: '2026-03-08T00:00:00Z',
    });

    const [url] = lastFetchCall();
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/vpses/321/statuses');
    expect(u.searchParams.get('status[limit]')).toBe('80');
    expect(u.searchParams.get('status[from_id]')).toBe('456');
    expect(u.searchParams.get('status[from]')).toBe('2026-03-01T00:00:00Z');
    expect(u.searchParams.get('status[to]')).toBe('2026-03-08T00:00:00Z');
  });

  test('fetchVps forwards include meta', async () => {
    globalThis.fetch = mockFetchOk({ vps: { id: 1 } }) as any;

    await fetchVps(1, { includes: 'user,node,dataset' });

    const [url] = lastFetchCall();
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/vpses/1');
    expect(u.searchParams.get('_meta[includes]')).toBe('user,node,dataset');
  });
});
