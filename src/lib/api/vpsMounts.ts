import { omitHaveApiParams } from './contract';
import { expectArray, haveApiCall } from './haveapi';
import type { ResourceRef } from './appTypes';
import type { User } from './users';

export interface Dataset {
  id: number;
  name?: string;
  user?: User | ResourceRef;
  [k: string]: unknown;
}

export interface VpsMount {
  id: number;
  vps?: ResourceRef;
  dataset?: Dataset | ResourceRef;
  user_namespace_map?: ResourceRef;
  mountpoint?: string;
  mode?: string;
  on_start_fail?: string;
  enabled?: boolean;
  master_enabled?: boolean;
  current_state?: string;
  expiration_date?: string | null;
  [k: string]: unknown;
}

export async function findDatasetByName(name: string) {
  return haveApiCall<Dataset>({
    method: 'GET',
    path: '/datasets/find_by_name',
    namespace: 'dataset',
    params: { name },
  });
}

export async function fetchVpsMounts(vpsId: number) {
  const res = await haveApiCall<VpsMount[]>({
    method: 'GET',
    path: `/vpses/${vpsId}/mounts`,
  });
  return { ...res, data: expectArray<VpsMount>(res.data, `vpses/${vpsId}/mounts`) };
}

export async function createVpsMount(vpsId: number, params: Record<string, unknown>) {
  return haveApiCall<VpsMount>({
    method: 'POST',
    path: `/vpses/${vpsId}/mounts`,
    namespace: 'mount',
    params,
  });
}

export async function updateVpsMount(vpsId: number, mountId: number, params: Record<string, unknown>) {
  return haveApiCall<VpsMount>({
    method: 'PUT',
    path: `/vpses/${vpsId}/mounts/${mountId}`,
    namespace: 'mount',
    // Legacy mount#update rejects master_enabled; the editable fields stay mutable.
    params: omitHaveApiParams(params, ['master_enabled']),
  });
}

export async function deleteVpsMount(vpsId: number, mountId: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/vpses/${vpsId}/mounts/${mountId}`,
  });
}
