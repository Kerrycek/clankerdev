import { expectArray, haveApiCall } from './haveapi';

import type { User } from './app';
import type { Environment } from './infra';
import type { ClusterResource } from './clusterResources';

export interface ClusterResourcePackage {
  id: number;
  label?: string;
  environment?: Environment | null;
  user?: User | null;
  is_personal?: boolean;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export interface ClusterResourcePackageItem {
  id: number;
  cluster_resource?: ClusterResource | null;
  value?: number;
  [k: string]: unknown;
}

export interface UserClusterResourcePackage {
  id: number;
  environment?: Environment | null;
  user?: User | null;
  cluster_resource_package?: ClusterResourcePackage | null;
  label?: string;
  is_personal?: boolean;
  comment?: string;
  added_by?: User | null;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export async function fetchClusterResourcePackages(opts?: {
  limit?: number;
  fromId?: number;
  q?: string;
  isPersonal?: boolean;
  environmentId?: number;
  userId?: number;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  const q = opts?.q ? String(opts.q).trim() : '';
  if (q) params['q'] = q;

  if (opts?.isPersonal !== undefined) params['is_personal'] = opts.isPersonal;
  if (opts?.environmentId !== undefined) params['environment'] = opts.environmentId;
  if (opts?.userId !== undefined) params['user'] = opts.userId;

  const res = await haveApiCall<ClusterResourcePackage[]>({
    method: 'GET',
    path: '/cluster_resource_packages',
    namespace: 'cluster_resource_package',
    params,
    meta: { includes: 'environment,user' },
  });

  return { ...res, data: expectArray<ClusterResourcePackage>(res.data, 'cluster_resource_packages#index') };
}

export async function fetchClusterResourcePackage(id: number) {
  return haveApiCall<ClusterResourcePackage>({
    method: 'GET',
    path: `/cluster_resource_packages/${id}`,
    namespace: 'cluster_resource_package',
    meta: { includes: 'environment,user' },
  });
}

export async function createClusterResourcePackage(payload: { label: string }) {
  return haveApiCall<ClusterResourcePackage>({
    method: 'POST',
    path: '/cluster_resource_packages',
    namespace: 'cluster_resource_package',
    params: {
      label: payload.label,
    },
  });
}

export async function updateClusterResourcePackage(payload: { id: number; label: string }) {
  return haveApiCall<ClusterResourcePackage>({
    method: 'PUT',
    path: `/cluster_resource_packages/${payload.id}`,
    namespace: 'cluster_resource_package',
    params: {
      label: payload.label,
    },
  });
}

export async function deleteClusterResourcePackage(id: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/cluster_resource_packages/${id}`,
    namespace: 'cluster_resource_package',
  });
}

export async function fetchClusterResourcePackageItems(pkgId: number, opts?: { limit?: number; fromId?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  const res = await haveApiCall<ClusterResourcePackageItem[]>({
    method: 'GET',
    path: `/cluster_resource_packages/${pkgId}/items`,
    namespace: 'item',
    params,
    meta: { includes: 'cluster_resource' },
  });

  return { ...res, data: expectArray<ClusterResourcePackageItem>(res.data, `cluster_resource_packages/${pkgId}/items#index`) };
}

export async function createClusterResourcePackageItem(payload: {
  pkgId: number;
  clusterResourceId: number;
  value: number;
}) {
  return haveApiCall<ClusterResourcePackageItem>({
    method: 'POST',
    path: `/cluster_resource_packages/${payload.pkgId}/items`,
    namespace: 'item',
    params: {
      cluster_resource: payload.clusterResourceId,
      value: payload.value,
    },
  });
}

export async function updateClusterResourcePackageItem(payload: { pkgId: number; itemId: number; value: number }) {
  return haveApiCall<ClusterResourcePackageItem>({
    method: 'PUT',
    path: `/cluster_resource_packages/${payload.pkgId}/items/${payload.itemId}`,
    namespace: 'item',
    params: {
      value: payload.value,
    },
  });
}

export async function deleteClusterResourcePackageItem(payload: { pkgId: number; itemId: number }) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/cluster_resource_packages/${payload.pkgId}/items/${payload.itemId}`,
    namespace: 'item',
  });
}

export async function fetchUserClusterResourcePackages(opts?: {
  limit?: number;
  fromId?: number;
  environmentId?: number;
  userId?: number;
  clusterResourcePackageId?: number;
  addedById?: number;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  if (opts?.environmentId !== undefined) params['environment'] = opts.environmentId;
  if (opts?.userId !== undefined) params['user'] = opts.userId;
  if (opts?.clusterResourcePackageId !== undefined) params['cluster_resource_package'] = opts.clusterResourcePackageId;
  if (opts?.addedById !== undefined) params['added_by'] = opts.addedById;

  const res = await haveApiCall<UserClusterResourcePackage[]>({
    method: 'GET',
    path: '/user_cluster_resource_packages',
    namespace: 'user_cluster_resource_package',
    params,
    meta: { includes: 'environment,user,added_by,cluster_resource_package' },
  });

  return {
    ...res,
    data: expectArray<UserClusterResourcePackage>(res.data, 'user_cluster_resource_packages#index'),
  };
}

export async function createUserClusterResourcePackage(payload: {
  environmentId: number;
  userId: number;
  clusterResourcePackageId: number;
  comment?: string;
  fromPersonal?: boolean;
}) {
  return haveApiCall<UserClusterResourcePackage>({
    method: 'POST',
    path: '/user_cluster_resource_packages',
    namespace: 'user_cluster_resource_package',
    params: {
      environment: payload.environmentId,
      user: payload.userId,
      cluster_resource_package: payload.clusterResourcePackageId,
      comment: payload.comment ?? '',
      from_personal: Boolean(payload.fromPersonal),
    },
  });
}

export async function updateUserClusterResourcePackage(payload: { id: number; comment: string }) {
  return haveApiCall<UserClusterResourcePackage>({
    method: 'PUT',
    path: `/user_cluster_resource_packages/${payload.id}`,
    namespace: 'user_cluster_resource_package',
    params: {
      comment: payload.comment,
    },
  });
}

export async function deleteUserClusterResourcePackage(id: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/user_cluster_resource_packages/${id}`,
    namespace: 'user_cluster_resource_package',
  });
}
