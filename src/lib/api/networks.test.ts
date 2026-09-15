import { describe, expect, test, vi } from 'vitest';

import { fetchNetworks } from './networks';

function mockFetchOk(response: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ status: true, response }),
  });
}

describe('networks API wrappers', () => {
  test('fetchNetworks forwards only filters supported by Network.Index', async () => {
    const fetchMock = mockFetchOk({ networks: [{ id: 101, purpose: 'vps' }] });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await fetchNetworks({
      limit: 25,
      fromId: 90,
      locationId: 1,
      purpose: 'vps',
      // Exercise a stale runtime caller while the public type rejects these fields.
      q: 'public',
      ipVersion: 4,
      role: 'public_access',
      managed: true,
    } as Parameters<typeof fetchNetworks>[0] & {
      q: string;
      ipVersion: number;
      role: string;
      managed: boolean;
    });

    expect(res.data).toEqual([{ id: 101, purpose: 'vps' }]);

    const call = fetchMock.mock.calls.find(([requestUrl]) =>
      new URL(String(requestUrl)).pathname.endsWith('/networks')
    );
    if (!call) throw new Error('Expected a networks#index request');
    const url = String(call[0]);
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/v7.0/networks');
    expect([...parsed.searchParams.keys()].sort()).toEqual(
      [
        'network[from_id]',
        'network[limit]',
        'network[location]',
        'network[purpose]',
      ].sort()
    );
    expect(parsed.searchParams.get('network[from_id]')).toBe('90');
    expect(parsed.searchParams.get('network[limit]')).toBe('25');
    expect(parsed.searchParams.get('network[location]')).toBe('1');
    expect(parsed.searchParams.get('network[purpose]')).toBe('vps');
  });
});
