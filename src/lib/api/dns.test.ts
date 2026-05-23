import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  createDnsRecord,
  fetchDnsRecordLogs,
  fetchDnsRecords,
  fetchDnsServers,
  fetchDnsTsigKeys,
  fetchDnsZones,
} from './dns';

function mockFetchOk(response: unknown) {
  return vi.fn(async (..._args: Parameters<typeof fetch>) =>
    new Response(JSON.stringify({ status: true, response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

function lastFetchCall(fetchMock: ReturnType<typeof mockFetchOk>): Parameters<typeof fetch> {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1]! as Parameters<typeof fetch>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('dns API wrappers', () => {
  test('fetchDnsZones uses dns_zone namespace', async () => {
    const fetchMock = mockFetchOk({ dns_zones: [], _meta: { total_count: 0 } });
    vi.stubGlobal('fetch', fetchMock);

    await fetchDnsZones({ limit: 5 });

    const [url] = lastFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/dns_zones');
    expect(u.searchParams.get('dns_zone[limit]')).toBe('5');
  });

  test('fetchDnsZones forwards q, user and dnssec filters', async () => {
    const fetchMock = mockFetchOk({ dns_zones: [], _meta: { total_count: 0 } });
    vi.stubGlobal('fetch', fetchMock);

    await fetchDnsZones({ q: 'example', user: 42, dnssec_enabled: true });

    const [url] = lastFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.searchParams.get('dns_zone[q]')).toBe('example');
    expect(u.searchParams.get('dns_zone[user]')).toBe('42');
    expect(u.searchParams.get('dns_zone[dnssec_enabled]')).toBe('true');
  });

  test('fetchDnsRecords filters by dns_zone', async () => {
    const fetchMock = mockFetchOk({ dns_records: [], _meta: { total_count: 0 } });
    vi.stubGlobal('fetch', fetchMock);

    await fetchDnsRecords({ dns_zone: 123, limit: 10 });

    const [url] = lastFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/dns_records');
    expect(u.searchParams.get('dns_record[dns_zone]')).toBe('123');
    expect(u.searchParams.get('dns_record[limit]')).toBe('10');
  });

  test('fetchDnsRecords forwards q filter', async () => {
    const fetchMock = mockFetchOk({ dns_records: [], _meta: { total_count: 0 } });
    vi.stubGlobal('fetch', fetchMock);

    await fetchDnsRecords({ dns_zone: 123, q: 'mail' });

    const [url] = lastFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.searchParams.get('dns_record[q]')).toBe('mail');
  });

  test('createDnsRecord sends namespaced payload', async () => {
    const fetchMock = mockFetchOk({ dns_record: { id: 1 } });
    vi.stubGlobal('fetch', fetchMock);

    await createDnsRecord({ dns_zone: 123, name: 'www', type: 'A', content: '203.0.113.10' });

    const [url, init] = lastFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/dns_records');
    expect(init?.method).toBe('POST');

    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ dns_record: { dns_zone: 123, name: 'www', type: 'A', content: '203.0.113.10' } });
  });

  test('fetchDnsRecordLogs uses dns_record_log namespace', async () => {
    const fetchMock = mockFetchOk({ dns_record_logs: [], _meta: { total_count: 0 } });
    vi.stubGlobal('fetch', fetchMock);

    await fetchDnsRecordLogs({ dns_zone: 123, limit: 1 });

    const [url] = lastFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/dns_record_logs');
    expect(u.searchParams.get('dns_record_log[dns_zone]')).toBe('123');
    expect(u.searchParams.get('dns_record_log[limit]')).toBe('1');
  });

  test('fetchDnsServers forwards search and user-zone filters', async () => {
    const fetchMock = mockFetchOk({ dns_servers: [], _meta: { total_count: 0 } });
    vi.stubGlobal('fetch', fetchMock);

    await fetchDnsServers({ q: 'ns1', hidden: false, enable_user_dns_zones: true });

    const [url] = lastFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/dns_servers');
    expect(u.searchParams.get('dns_server[q]')).toBe('ns1');
    expect(u.searchParams.get('dns_server[hidden]')).toBe('false');
    expect(u.searchParams.get('dns_server[enable_user_dns_zones]')).toBe('true');
  });

  test('fetchDnsTsigKeys forwards q, algorithm and user filters', async () => {
    const fetchMock = mockFetchOk({ dns_tsig_keys: [], _meta: { total_count: 0 } });
    vi.stubGlobal('fetch', fetchMock);

    await fetchDnsTsigKeys({ q: 'alice', algorithm: 'hmac-sha512', user: 7 });

    const [url] = lastFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/dns_tsig_keys');
    expect(u.searchParams.get('dns_tsig_key[q]')).toBe('alice');
    expect(u.searchParams.get('dns_tsig_key[algorithm]')).toBe('hmac-sha512');
    expect(u.searchParams.get('dns_tsig_key[user]')).toBe('7');
  });
});
