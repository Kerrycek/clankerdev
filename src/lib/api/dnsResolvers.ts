import { expectArray, haveApiCall } from './haveapi';
import type { Location } from './infra';

export interface DnsResolver {
  id: number;
  ip_addr?: string;
  label?: string;
  is_universal?: boolean;
  location?: Location | null;
  [k: string]: unknown;
}

export async function fetchDnsResolvers(opts?: {
  limit?: number;
  fromId?: number;
  q?: string;
  isUniversal?: boolean;
  locationId?: number;
}) {
  const params: Record<string, unknown> = {};

  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  if (opts?.q) params['q'] = opts.q;
  if (opts?.isUniversal !== undefined) params['is_universal'] = opts.isUniversal;
  if (opts?.locationId !== undefined) params['location'] = opts.locationId;

  const res = await haveApiCall<DnsResolver[]>({
    method: 'GET',
    path: '/dns_resolvers',
    namespace: 'dns_resolver',
    params,
    meta: { includes: 'location' },
  });

  return { ...res, data: expectArray<DnsResolver>(res.data, 'dns_resolvers#index') };
}

export async function createDnsResolver(opts: {
  ipAddr: string;
  label: string;
  isUniversal: boolean;
  locationId?: number | null;
}) {
  const params: Record<string, unknown> = {
    ip_addr: opts.ipAddr,
    label: opts.label,
    is_universal: opts.isUniversal,
  };

  if (!opts.isUniversal) {
    params['location'] = opts.locationId ?? null;
  }

  return haveApiCall<DnsResolver>({
    method: 'POST',
    path: '/dns_resolvers',
    namespace: 'dns_resolver',
    params,
  });
}

export async function updateDnsResolver(opts: {
  id: number;
  ipAddr: string;
  label: string;
  isUniversal: boolean;
  locationId?: number | null;
}) {
  const params: Record<string, unknown> = {
    ip_addr: opts.ipAddr,
    label: opts.label,
    is_universal: opts.isUniversal,
  };

  if (!opts.isUniversal) {
    params['location'] = opts.locationId ?? null;
  }

  return haveApiCall<DnsResolver>({
    method: 'PUT',
    path: `/dns_resolvers/${opts.id}`,
    namespace: 'dns_resolver',
    params,
  });
}

export async function deleteDnsResolver(opts: { id: number; force?: boolean }) {
  const params: Record<string, unknown> = {};
  if (opts.force !== undefined) params['force'] = opts.force;

  return haveApiCall<unknown>({
    method: 'DELETE',
    path: `/dns_resolvers/${opts.id}`,
    namespace: 'dns_resolver',
    params,
  });
}
