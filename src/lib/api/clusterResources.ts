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

export interface UserClusterResource {
  id: number;
  environment?: { id: number; label?: string } | null;
  cluster_resource?: ClusterResource | null;
  value?: number;
  used?: number;
  free?: number;
  [k: string]: unknown;
}

export interface DefaultObjectClusterResource {
  id: number;
  class_name?: string;
  value?: number;
  environment?: { id: number; label?: string } | null;
  cluster_resource?: ClusterResource | null;
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

export async function fetchUserClusterResources(userId: number, opts?: {
  limit?: number;
  environmentId?: number;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.environmentId !== undefined) params['environment'] = opts.environmentId;

  const res = await haveApiCall<UserClusterResource[]>({
    method: 'GET',
    path: `/users/${userId}/cluster_resources`,
    namespace: 'cluster_resource',
    params,
    meta: { includes: 'environment,cluster_resource' },
  });

  return { ...res, data: expectArray<UserClusterResource>(res.data, 'users/:id/cluster_resources#index') };
}

export async function fetchDefaultObjectClusterResources(opts?: {
  limit?: number;
  environmentId?: number;
  className?: string;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.environmentId !== undefined) params['environment'] = opts.environmentId;
  if (opts?.className) params['class_name'] = opts.className;

  const res = await haveApiCall<DefaultObjectClusterResource[]>({
    method: 'GET',
    path: '/default_object_cluster_resources',
    namespace: 'default_object_cluster_resource',
    params,
    meta: { includes: 'cluster_resource' },
  });

  return {
    ...res,
    data: expectArray<DefaultObjectClusterResource>(res.data, 'default_object_cluster_resources#index'),
  };
}
