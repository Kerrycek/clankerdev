import { describe, expect, test, vi } from 'vitest';

import {
  assignIpAddressRoute,
  assignIpAddressRouteWithHostAddress,
  fetchIpAddresses,
  freeIpAddressRoute,
  updateIpAddress,
} from './ipAddresses';
import {
  assignHostIpAddress,
  createHostIpAddress,
  deleteHostIpAddress,
  fetchHostIpAddresses,
  fetchIpAddressAssignments,
  fetchNetworkInterfaceMonitor,
  fetchNetworkTrafficUserTop,
  freeHostIpAddress,
  updateHostIpAddress,
} from './networking';

function mockFetchOk(response: any) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response }) });
}

function lastFetchCall() {
  const calls = (globalThis.fetch as LegacyAny).mock.calls;
  return calls[calls.length - 1] as [string, RequestInit?];
}

describe('network address API wrappers', () => {
  test('assignIpAddressRoute posts the legacy route assign payload', async () => {
    globalThis.fetch = mockFetchOk({ ip_address: { id: 42 } }) as LegacyAny;

    await assignIpAddressRoute(42, { network_interface: 501, route_via: 700 });

    const [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/ip_addresses/42/assign');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      ip_address: {
        network_interface: 501,
        route_via: 700,
      },
    });
  });

  test('assignIpAddressRouteWithHostAddress posts the combined route and host action', async () => {
    globalThis.fetch = mockFetchOk({ ip_address: { id: 42 } }) as LegacyAny;

    await assignIpAddressRouteWithHostAddress(42, { network_interface: 501 });

    const [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/ip_addresses/42/assign_with_host_address');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      ip_address: {
        network_interface: 501,
      },
    });
  });

  test('freeIpAddressRoute posts route free without a namespaced payload', async () => {
    globalThis.fetch = mockFetchOk({ ip_address: { id: 42 } }) as LegacyAny;

    await freeIpAddressRoute(42);

    const [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/ip_addresses/42/free');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{}');
  });

  test('updateIpAddress sends owner changes through the ip_address namespace', async () => {
    globalThis.fetch = mockFetchOk({ ip_address: { id: 42 } }) as LegacyAny;

    await updateIpAddress(42, { user: 7, environment: 2 });

    const [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/ip_addresses/42');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({
      ip_address: {
        user: 7,
        environment: 2,
      },
    });
  });

  test('host IP wrappers cover create, PTR update, assign, free and delete endpoints', async () => {
    globalThis.fetch = mockFetchOk({ host_ip_address: { id: 9 } }) as LegacyAny;

    await createHostIpAddress({ ip_address: 42, addr: '192.0.2.10' });
    let [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/host_ip_addresses');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      host_ip_address: {
        ip_address: 42,
        addr: '192.0.2.10',
      },
    });

    await updateHostIpAddress(9, { reverse_record_value: 'host.example.org.' });
    [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/host_ip_addresses/9');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({
      host_ip_address: {
        reverse_record_value: 'host.example.org.',
      },
    });

    await assignHostIpAddress(9, { network_interface: 501 });
    [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/host_ip_addresses/9/assign');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      host_ip_address: {
        network_interface: 501,
      },
    });

    await freeHostIpAddress(9);
    [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/host_ip_addresses/9/free');
    expect(init?.method).toBe('POST');

    await deleteHostIpAddress(9);
    [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/host_ip_addresses/9');
    expect(init?.method).toBe('DELETE');
  });

  test('IP address list keeps unsupported q local and forwards structured filters only', async () => {
    globalThis.fetch = mockFetchOk({ ip_addresses: [], _meta: { total_count: 0 } }) as LegacyAny;

    await fetchIpAddresses({
      limit: 25,
      fromId: 100,
      q: 'alice 192.0.2',
      addr: '192.0.2.10',
      prefix: 32,
      vps: 7,
      user: 42,
      network: 5,
      networkInterface: 501,
      location: 2,
      version: 4,
      assignedToInterface: true,
      order: 'interface',
    });

    const [url] = lastFetchCall();
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/ip_addresses');
    expect(u.searchParams.has('ip_address[q]')).toBe(false);
    expect(u.searchParams.get('ip_address[addr]')).toBe('192.0.2.10');
    expect(u.searchParams.get('ip_address[prefix]')).toBe('32');
    expect(u.searchParams.get('ip_address[vps]')).toBe('7');
    expect(u.searchParams.get('ip_address[user]')).toBe('42');
    expect(u.searchParams.get('ip_address[network]')).toBe('5');
    expect(u.searchParams.get('ip_address[network_interface]')).toBe('501');
    expect(u.searchParams.get('ip_address[location]')).toBe('2');
    expect(u.searchParams.get('ip_address[version]')).toBe('4');
    expect(u.searchParams.get('ip_address[assigned_to_interface]')).toBe('true');
    expect(u.searchParams.get('ip_address[order]')).toBe('interface');
  });

  test('host IP list keeps unsupported q local and forwards legacy filters only', async () => {
    globalThis.fetch = mockFetchOk({ host_ip_addresses: [], _meta: { total_count: 0 } }) as LegacyAny;

    await fetchHostIpAddresses({
      limit: 50,
      fromId: 90,
      q: 'vps123',
      user: 42,
      vps: 7,
      assigned: false,
      routed: true,
      addr: '198.51.100.10',
      version: 6,
      location: 2,
      network: 5,
      order: 'interface',
    });

    const [url] = lastFetchCall();
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/host_ip_addresses');
    expect(u.searchParams.has('host_ip_address[q]')).toBe(false);
    expect(u.searchParams.get('host_ip_address[user]')).toBe('42');
    expect(u.searchParams.get('host_ip_address[vps]')).toBe('7');
    expect(u.searchParams.get('host_ip_address[assigned]')).toBe('false');
    expect(u.searchParams.get('host_ip_address[routed]')).toBe('true');
    expect(u.searchParams.get('host_ip_address[addr]')).toBe('198.51.100.10');
    expect(u.searchParams.get('host_ip_address[version]')).toBe('6');
    expect(u.searchParams.get('host_ip_address[location]')).toBe('2');
    expect(u.searchParams.get('host_ip_address[network]')).toBe('5');
    expect(u.searchParams.get('host_ip_address[order]')).toBe('interface');
  });

  test('IP assignment list keeps unsupported q/user local and uses legacy ip_version filter', async () => {
    globalThis.fetch = mockFetchOk({ ip_address_assignments: [], _meta: { total_count: 0 } }) as LegacyAny;

    await fetchIpAddressAssignments({
      limit: 50,
      fromId: 88,
      q: 'alice',
      user: 42,
      vps: 7,
      active: true,
      location: 2,
      network: 5,
      ipVersion: 6,
      order: 'oldest',
    });

    const [url] = lastFetchCall();
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/ip_address_assignments');
    expect(u.searchParams.has('ip_address_assignment[q]')).toBe(false);
    expect(u.searchParams.get('ip_address_assignment[user]')).toBeNull();
    expect(u.searchParams.get('ip_address_assignment[vps]')).toBe('7');
    expect(u.searchParams.get('ip_address_assignment[active]')).toBe('true');
    expect(u.searchParams.get('ip_address_assignment[location]')).toBe('2');
    expect(u.searchParams.get('ip_address_assignment[network]')).toBe('5');
    expect(u.searchParams.get('ip_address_assignment[ip_version]')).toBe('6');
    expect(u.searchParams.get('ip_address_assignment[order]')).toBe('oldest');
  });

  test('network traffic lists do not forward unsupported q filters', async () => {
    globalThis.fetch = mockFetchOk({ network_interface_monitors: [], _meta: { total_count: 0 } }) as LegacyAny;

    await fetchNetworkInterfaceMonitor({ q: 'alice', user: 42, vps: 7, node: 3, networkInterface: 501, order: '-bytes', limit: 25 });

    let [url] = lastFetchCall();
    let u = new URL(url);

    expect(u.pathname).toBe('/v7.0/network_interface_monitors');
    expect(u.searchParams.has('network_interface_monitor[q]')).toBe(false);
    expect(u.searchParams.get('network_interface_monitor[user]')).toBeNull();
    expect(u.searchParams.get('network_interface_monitor[vps]')).toBe('7');
    expect(u.searchParams.get('network_interface_monitor[node]')).toBe('3');
    expect(u.searchParams.get('network_interface_monitor[network_interface]')).toBe('501');
    expect(u.searchParams.get('network_interface_monitor[order]')).toBe('-bytes');

    globalThis.fetch = mockFetchOk({ network_interface_accountings: [], _meta: { total_count: 0 } }) as LegacyAny;

    await fetchNetworkTrafficUserTop({ q: 'alice', year: 2026, month: 6, fromBytes: 1000, limit: 25, node: 3 });

    [url] = lastFetchCall();
    u = new URL(url);

    expect(u.pathname).toBe('/v7.0/network_interface_accountings/user_top');
    expect(u.searchParams.has('network_interface_accounting[q]')).toBe(false);
    expect(u.searchParams.get('network_interface_accounting[year]')).toBe('2026');
    expect(u.searchParams.get('network_interface_accounting[month]')).toBe('6');
    expect(u.searchParams.get('network_interface_accounting[from_bytes]')).toBe('1000');
    expect(u.searchParams.get('network_interface_accounting[node]')).toBe('3');
  });

});
