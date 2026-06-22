import { describe, expect, it } from 'vitest';

import type { IpAddress } from '../../../lib/api/ipAddresses';
import type { HostIpAddress } from '../../../lib/api/networking';
import type { NetworkInterface } from '../../../lib/api/networkInterfaces';
import {
  buildNetworkRouteSummary,
  groupIpByInterface,
  hostPtrState,
  ipAddressLabel,
  routeStateForIp,
  validateHostAddressInput,
  validatePtrValue,
} from './VpsNetworkModel';

describe('VpsNetworkModel', () => {
  it('groups routes by interface and summarizes daily network state', () => {
    const netifs: NetworkInterface[] = [
      { id: 10, name: 'eth0', enable: true },
      { id: 11, name: 'eth1', enable: false },
    ];
    const ips: IpAddress[] = [
      { id: 1, addr: '198.51.100.10', network_interface: netifs[0], routed: true },
      { id: 2, addr: '198.51.100.11', network_interface: netifs[1], routed: false },
      { id: 3, addr: '198.51.100.12', routed: false },
    ];
    const hosts: HostIpAddress[] = [
      { id: 50, addr: '198.51.100.10', assigned: true, reverse_record_value: 'vps.example.test.' },
      { id: 51, addr: '198.51.100.11', assigned: false, reverse_record_value: null },
    ];

    const grouped = groupIpByInterface(ips);
    expect(grouped.get(10)?.map((ip) => ip.id)).toEqual([1]);
    expect(grouped.get(11)?.map((ip) => ip.id)).toEqual([2]);
    expect(grouped.get(-1)?.map((ip) => ip.id)).toEqual([3]);

    expect(buildNetworkRouteSummary({ netifs, ips, hostAddresses: hosts })).toMatchObject({
      interfaceCount: 2,
      enabledInterfaceCount: 1,
      disabledInterfaceCount: 1,
      ipCount: 3,
      assignedIpCount: 2,
      unassignedIpCount: 1,
      routedIpCount: 1,
      hostAddressCount: 2,
      assignedHostAddressCount: 1,
      ptrRecordCount: 1,
    });
  });

  it('labels route and PTR states for badges', () => {
    const iface: NetworkInterface = { id: 1, name: 'eth0' };
    const routed: IpAddress = { id: 1, addr: '2001:db8::10', network_interface: iface, routed: true };
    const active: IpAddress = { id: 2, addr: '198.51.100.10', network_interface: iface, routed: false };
    const detached: IpAddress = { id: 3, addr: '198.51.100.11', routed: false };

    expect(ipAddressLabel(routed)).toBe('2001:db8::10');
    expect(routeStateForIp(routed, false)).toBe('routed');
    expect(routeStateForIp(active, false)).toBe('active');
    expect(routeStateForIp(detached, false)).toBe('detached');
    expect(routeStateForIp(active, true)).toBe('busy');
    expect(hostPtrState({ id: 50, addr: '198.51.100.10', reverse_record_value: 'vps.example.test.' })).toBe('set');
    expect(hostPtrState({ id: 51, addr: '198.51.100.11', reverse_record_value: '' })).toBe('missing');
  });

  it('validates host address input before creating host addresses', () => {
    expect(validateHostAddressInput('198.51.100.10\n2001:db8::10')).toEqual({ ok: true });
    expect(validateHostAddressInput('198.51.100.999')).toEqual({ ok: false, invalidValue: '198.51.100.999' });
    expect(validateHostAddressInput('198.51.100.10/32')).toEqual({ ok: false, invalidValue: '198.51.100.10/32' });
    expect(validateHostAddressInput('host.example.test')).toEqual({ ok: false, invalidValue: 'host.example.test' });
  });

  it('validates PTR values while allowing an empty clear', () => {
    expect(validatePtrValue('')).toEqual({ ok: true });
    expect(validatePtrValue('vps.example.test.')).toEqual({ ok: true });
    expect(validatePtrValue('-bad.example.test.')).toEqual({ ok: false, invalidValue: '-bad.example.test.' });
    expect(validatePtrValue('bad value.example.test.')).toEqual({ ok: false, invalidValue: 'bad value.example.test.' });
  });
});
