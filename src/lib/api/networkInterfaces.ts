import { expectArray, haveApiCall } from './haveapi';
import type { ResourceRef } from './appTypes';

export interface NetworkInterface {
  id: number;
  vps?: ResourceRef;
  name: string;
  type?: string;
  mac?: string;
  max_tx?: number;
  max_rx?: number;
  enable?: boolean;
  [k: string]: unknown;
}

export interface NetworkInterfaceAccounting {
  id: number;
  network_interface?: NetworkInterface | ResourceRef;
  bytes?: number;
  bytes_in?: number;
  bytes_out?: number;
  packets?: number;
  packets_in?: number;
  packets_out?: number;
  year?: number;
  month?: number;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export async function fetchNetworkInterfaces(vpsId: number, opts?: { limit?: number }) {
  const res = await haveApiCall<NetworkInterface[]>({
    method: 'GET',
    path: '/network_interfaces',
    namespace: 'network_interface',
    params: {
      vps: vpsId,
      limit: opts?.limit ?? 100,
    },
  });
  return { ...res, data: expectArray<NetworkInterface>(res.data, 'network_interfaces') };
}

export async function updateNetworkInterface(netifId: number, params: Record<string, unknown>) {
  return haveApiCall<NetworkInterface>({
    method: 'PUT',
    path: `/network_interfaces/${netifId}`,
    namespace: 'network_interface',
    params,
  });
}

export async function fetchNetworkInterfaceAccountingForVps(vpsId: number, year: number, month: number) {
  const res = await haveApiCall<NetworkInterfaceAccounting[]>({
    method: 'GET',
    path: '/network_interface_accountings',
    namespace: 'network_interface_accounting',
    params: {
      vps: vpsId,
      year,
      month,
      limit: 250,
    },
  });
  return {
    ...res,
    data: expectArray<NetworkInterfaceAccounting>(res.data, 'network_interface_accountings'),
  };
}
