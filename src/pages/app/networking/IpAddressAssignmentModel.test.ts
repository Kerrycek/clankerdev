import { describe, expect, test } from 'vitest';

import type { IpAddress } from '../../../lib/api/ipAddresses';
import {
  assignableIpKind,
  assignableIpKindQuery,
  isVisibleUserIp,
  matchesAssignableIpKind,
  uniqueIpAddresses,
  vpsLocationId,
} from './IpAddressAssignmentModel';

const publicIpv4: IpAddress = {
  id: 1,
  addr: '198.51.100.10',
  prefix: 32,
  network: { id: 11, ip_version: 4, role: 'public_access' },
};

const privateIpv4: IpAddress = {
  id: 2,
  addr: '10.0.0.10',
  prefix: 32,
  network: { id: 12, ip_version: 4, role: 'private_access' },
};

const ipv6: IpAddress = {
  id: 3,
  addr: '2001:db8::10',
  prefix: 128,
  network: { id: 13, ip_version: 6, role: 'public_access' },
};

describe('IP address assignment model', () => {
  test('maps the three user-facing address types to API filters', () => {
    expect(assignableIpKindQuery('ipv4_public')).toEqual({ version: 4, role: 'public_access' });
    expect(assignableIpKindQuery('ipv4_private')).toEqual({ version: 4, role: 'private_access' });
    expect(assignableIpKindQuery('ipv6')).toEqual({ version: 6 });
  });

  test('classifies and filters public IPv4, private IPv4 and IPv6', () => {
    expect(assignableIpKind(publicIpv4)).toBe('ipv4_public');
    expect(assignableIpKind(privateIpv4)).toBe('ipv4_private');
    expect(assignableIpKind(ipv6)).toBe('ipv6');
    expect(matchesAssignableIpKind(privateIpv4, 'ipv4_private')).toBe(true);
    expect(matchesAssignableIpKind(privateIpv4, 'ipv4_public')).toBe(false);
  });

  test('keeps only owned detached addresses or addresses assigned to the user VPS scope', () => {
    expect(isVisibleUserIp({ ...publicIpv4, user: { id: 7 } }, 7)).toBe(true);
    expect(isVisibleUserIp({ ...publicIpv4, user: null as never }, 7)).toBe(false);
    expect(isVisibleUserIp({ ...publicIpv4, network_interface: { id: 5 } }, 7)).toBe(true);
  });

  test('reads the VPS location and removes duplicate addresses', () => {
    expect(vpsLocationId({ id: 9, hostname: 'test', node: { id: 2, location: { id: 4 } } })).toBe(4);
    expect(uniqueIpAddresses([publicIpv4, privateIpv4, publicIpv4]).map((ip) => ip.id)).toEqual([1, 2]);
  });
});
