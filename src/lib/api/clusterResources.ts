import { expectArray, haveApiCall } from './haveapi';

export interface ClusterResource {
  id: number;
  name?: string;
  label?: string;
  min?: number;
  max?: number;
  stepsize?: number;
  [k: string]: unknown;
}

export async function fetchClusterResources(opts?: { limit?: number; fromId?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  const res = await haveApiCall<ClusterResource[]>({
    method: 'GET',
    path: '/cluster_resources',
    namespace: 'cluster_resource',
    params,
  });

  return { ...res, data: expectArray<ClusterResource>(res.data, 'cluster_resources#index') };
}
