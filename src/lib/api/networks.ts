import { expectArray, haveApiCall } from './haveapi';

import type { Location } from './infra';

export type NetworkRole = 'public_access' | 'private_access';
export type NetworkPurpose = 'any' | 'vps' | 'export';
export type NetworkSplitAccess = 'no_access' | 'user_split' | 'owner_split';

export interface Network {
  id: number;
  label?: string;
  ip_version?: number;
  address?: string;
  prefix?: number;
  role?: NetworkRole | string;
  managed?: boolean;
  split_access?: NetworkSplitAccess | string;
  split_prefix?: number;
  purpose?: NetworkPurpose | string;

  // Admin-only stats
  size?: number;
  used?: number;
  assigned?: number;
  owned?: number;
  taken?: number;
  locations_count?: number;

  primary_location?: Location | null;

  [k: string]: unknown;
}

export async function fetchNetworks(opts?: {
  limit?: number;
  fromId?: number;
  q?: string;
  locationId?: number;
  ipVersion?: 4 | 6;
  role?: NetworkRole;
  managed?: boolean;
  purpose?: NetworkPurpose;
}) {
  const params: Record<string, unknown> = {};

  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  if (opts?.q) params['q'] = opts.q;
  if (opts?.locationId !== undefined) params['location'] = opts.locationId;
  if (opts?.ipVersion !== undefined) params['ip_version'] = opts.ipVersion;
  if (opts?.role) params['role'] = opts.role;
  if (opts?.managed !== undefined) params['managed'] = opts.managed;
  if (opts?.purpose) params['purpose'] = opts.purpose;

  const res = await haveApiCall<Network[]>({
    method: 'GET',
    path: '/networks',
    namespace: 'network',
    params,
  });

  return { ...res, data: expectArray<Network>(res.data, 'networks#index') };
}

export async function fetchNetwork(id: number) {
  return haveApiCall<Network>({
    method: 'GET',
    path: `/networks/${id}`,
    namespace: 'network',
    meta: { includes: 'primary_location' },
  });
}

export async function createNetwork(opts: {
  label?: string;
  ipVersion: 4 | 6;
  address: string;
  prefix: number;
  role: NetworkRole;
  managed: boolean;
  splitAccess: NetworkSplitAccess;
  splitPrefix: number;
  purpose: NetworkPurpose;
  addIpAddresses?: boolean;
}) {
  const params: Record<string, unknown> = {
    label: opts.label ?? '',
    ip_version: opts.ipVersion,
    address: opts.address,
    prefix: opts.prefix,
    role: opts.role,
    managed: opts.managed,
    split_access: opts.splitAccess,
    split_prefix: opts.splitPrefix,
    purpose: opts.purpose,
    add_ip_addresses: Boolean(opts.addIpAddresses),
  };

  return haveApiCall<Network>({
    method: 'POST',
    path: '/networks',
    namespace: 'network',
    params,
  });
}

export async function updateNetwork(opts: {
  id: number;
  label?: string;
  ipVersion?: 4 | 6;
  address?: string;
  prefix?: number;
  role?: NetworkRole;
  managed?: boolean;
  splitAccess?: NetworkSplitAccess;
  splitPrefix?: number;
  purpose?: NetworkPurpose;
}) {
  const params: Record<string, unknown> = {};

  if (opts.label !== undefined) params['label'] = opts.label;
  if (opts.ipVersion !== undefined) params['ip_version'] = opts.ipVersion;
  if (opts.address !== undefined) params['address'] = opts.address;
  if (opts.prefix !== undefined) params['prefix'] = opts.prefix;
  if (opts.role !== undefined) params['role'] = opts.role;
  if (opts.managed !== undefined) params['managed'] = opts.managed;
  if (opts.splitAccess !== undefined) params['split_access'] = opts.splitAccess;
  if (opts.splitPrefix !== undefined) params['split_prefix'] = opts.splitPrefix;
  if (opts.purpose !== undefined) params['purpose'] = opts.purpose;

  return haveApiCall<Network>({
    method: 'PUT',
    path: `/networks/${opts.id}`,
    namespace: 'network',
    params,
  });
}