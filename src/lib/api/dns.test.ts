import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  createDnsRecord,
  createDnsTsigKey,
  fetchDnsRecordLogs,
  fetchDnsRecords,
  fetchDnsServers,
  fetchDnsTsigKeys,
  fetchDnsZones,
  updateDnsRecord,
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

  test('fetchDnsZones uses legacy index whitelist and omits client-only filters', async () => {
    const fetchMock = mockFetchOk({ dns_zones: [], _meta: { total_count: 0 } });
    vi.stubGlobal('fetch', fetchMock);

    await fetchDnsZones({
      q: 'example',
      user: 42,
      dnssec_enabled: true,
      role: 'forward_role',
      source: 'internal_source',
      enabled: false,
      limit: 5,
    });

    const [url] = lastFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.searchParams.get('dns_zone[q]')).toBeNull();
    expect(u.searchParams.get('dns_zone[user]')).toBeNull();
    expect(u.searchParams.get('dns_zone[dnssec_enabled]')).toBeNull();
    expect(u.searchParams.get('dns_zone[role]')).toBe('forward_role');
    expect(u.searchParams.get('dns_zone[source]')).toBe('internal_source');
    expect(u.searchParams.get('dns_zone[enabled]')).toBe('false');
    expect(u.searchParams.get('dns_zone[limit]')).toBe('5');
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

  test('createDnsRecord sends namespaced payload without unsupported user', async () => {
    const fetchMock = mockFetchOk({ dns_record: { id: 1 } });
    vi.stubGlobal('fetch', fetchMock);

    await createDnsRecord({ user: 7, dns_zone: 123, name: 'www', type: 'A', content: '203.0.113.10' });

    const [url, init] = lastFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.pathname).toBe('/v7.0/dns_records');
    expect(init?.method).toBe('POST');

    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ dns_record: { dns_zone: 123, name: 'www', type: 'A', content: '203.0.113.10' } });
  });

  test('updateDnsRecord strips unsupported user', async () => {
    const fetchMock = mockFetchOk({ dns_record: { id: 1 } });
    vi.stubGlobal('fetch', fetchMock);

    await updateDnsRecord(1, { user: 7, content: '203.0.113.11', enabled: false });

    const [url, init] = lastFetchCall(fetchMock);
    const body = JSON.parse(String(init?.body));

    expect(new URL(String(url)).pathname).toBe('/v7.0/dns_records/1');
    expect(init?.method).toBe('PUT');
    expect(body).toEqual({ dns_record: { content: '203.0.113.11', enabled: false } });
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


  test('fetchDnsRecordLogs uses legacy whitelist and omits client-only filters', async () => {
    const fetchMock = mockFetchOk({ dns_record_logs: [], _meta: { total_count: 0 } });
    vi.stubGlobal('fetch', fetchMock);

    await fetchDnsRecordLogs({
      dns_zone: 123,
      dns_zone_name: 'example.com',
      user: 42,
      q: 'mail',
      change_type: 'update',
      name: 'www',
      type: 'A',
    });

    const [url] = lastFetchCall(fetchMock);
    const u = new URL(String(url));

    expect(u.searchParams.get('dns_record_log[dns_zone]')).toBe('123');
    expect(u.searchParams.get('dns_record_log[dns_zone_name]')).toBeNull();
    expect(u.searchParams.get('dns_record_log[user]')).toBeNull();
    expect(u.searchParams.get('dns_record_log[q]')).toBeNull();
    expect(u.searchParams.get('dns_record_log[change_type]')).toBe('update');
    expect(u.searchParams.get('dns_record_log[name]')).toBe('www');
    expect(u.searchParams.get('dns_record_log[type]')).toBe('A');
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

  test('createDnsTsigKey strips unsupported user', async () => {
    const fetchMock = mockFetchOk({ dns_tsig_key: { id: 1 } });
    vi.stubGlobal('fetch', fetchMock);

    await createDnsTsigKey({ user: 7, name: 'k1', algorithm: 'hmac-sha512' });

    const [, init] = lastFetchCall(fetchMock);
    const body = JSON.parse(String(init?.body));

    expect(init?.method).toBe('POST');
    expect(body).toEqual({ dns_tsig_key: { name: 'k1', algorithm: 'hmac-sha512' } });
  });
});
