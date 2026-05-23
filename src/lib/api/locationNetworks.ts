import { expectArray, haveApiCall } from './haveapi';

import type { Location } from './infra';
import type { Network } from './networks';

export interface LocationNetwork {
  id: number;
  location?: Location;
  network?: Network;
  primary?: boolean;
  priority?: number;
  autopick?: boolean;
  userpick?: boolean;
  [k: string]: unknown;
}

export async function fetchLocationNetworks(opts?: { locationId?: number; networkId?: number; limit?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.locationId !== undefined) params['location'] = opts.locationId;
  if (opts?.networkId !== undefined) params['network'] = opts.networkId;

  const res = await haveApiCall<LocationNetwork[]>({
    method: 'GET',
    path: '/location_networks',
    namespace: 'location_network',
    params,
    meta: { includes: 'location,network' },
  });

  return { ...res, data: expectArray<LocationNetwork>(res.data, 'location_networks#index') };
}

export async function createLocationNetwork(opts: {
  locationId: number;
  networkId: number;
  primary: boolean;
  priority: number;
  autopick: boolean;
  userpick: boolean;
}) {
  return haveApiCall<LocationNetwork>({
    method: 'POST',
    path: '/location_networks',
    namespace: 'location_network',
    params: {
      location: opts.locationId,
      network: opts.networkId,
      primary: opts.primary,
      priority: opts.priority,
      autopick: opts.autopick,
      userpick: opts.userpick,
    },
  });
}

export async function updateLocationNetwork(opts: {
  id: number;
  primary?: boolean;
  priority?: number;
  autopick?: boolean;
  userpick?: boolean;
}) {
  const params: Record<string, unknown> = {};

  if (opts.primary !== undefined) params['primary'] = opts.primary;
  if (opts.priority !== undefined) params['priority'] = opts.priority;
  if (opts.autopick !== undefined) params['autopick'] = opts.autopick;
  if (opts.userpick !== undefined) params['userpick'] = opts.userpick;

  return haveApiCall<LocationNetwork>({
    method: 'PUT',
    path: `/location_networks/${opts.id}`,
    namespace: 'location_network',
    params,
  });
}

export async function deleteLocationNetwork(opts: { id: number }) {
  return haveApiCall<unknown>({
    method: 'DELETE',
    path: `/location_networks/${opts.id}`,
    namespace: 'location_network',
  });
}
