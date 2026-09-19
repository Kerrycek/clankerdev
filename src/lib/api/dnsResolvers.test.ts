import { describe, expect, test, vi } from 'vitest';

import { fetchDnsResolvers } from './dnsResolvers';

function mockFetchOk(response: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response }) });
}

describe('DNS resolver API wrapper', () => {
  test('forwards only pagination and the API-supported VPS selector', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ dns_resolvers: [] }));

    const optionsWithUnsupportedFilters = {
      limit: 25,
      fromId: 91,
      vpsId: 17,
      q: 'google',
      isUniversal: true,
      locationId: 2,
    };
    await fetchDnsResolvers(optionsWithUnsupportedFilters);

    const [url] = vi.mocked(globalThis.fetch).mock.calls.at(-1) as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/v7.0/dns_resolvers');
    expect(Array.from(parsed.searchParams.entries()).filter(([key]) => key.startsWith('dns_resolver['))).toEqual([
      ['dns_resolver[limit]', '25'],
      ['dns_resolver[from_id]', '91'],
      ['dns_resolver[vps]', '17'],
    ]);
    expect(Array.from(parsed.searchParams.keys()).sort()).toEqual([
      '_meta[includes]',
      'dns_resolver[from_id]',
      'dns_resolver[limit]',
      'dns_resolver[vps]',
    ]);
    expect(parsed.searchParams.get('_meta[includes]')).toBe('location');
  });
});
