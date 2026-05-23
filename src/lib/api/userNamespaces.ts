import { expectArray, haveApiCall } from './haveapi';
import type { ResourceRef } from './app';

export interface UserNamespace {
  id: number;
  user?: ResourceRef;
  offset?: number;
  block_count?: number;
  size?: number;
  [k: string]: unknown;
}

export interface UserNamespaceMap {
  id: number;
  user_namespace?: UserNamespace | ResourceRef;
  label?: string;
  [k: string]: unknown;
}

export type UserNamespaceEntryKind = 'uid' | 'gid';

export interface UserNamespaceMapEntry {
  id: number;
  kind?: UserNamespaceEntryKind | string;
  vps_id?: number;
  ns_id?: number;
  count?: number;
  [k: string]: unknown;
}

export async function fetchUserNamespaces(opts?: {
  limit?: number;
  fromId?: number;
  q?: string;
  size?: number;
  userId?: number;
  blockCount?: number;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  const q = opts?.q ? String(opts.q).trim() : '';
  if (q) params['q'] = q;

  if (opts?.size !== undefined) params['size'] = opts.size;
  if (opts?.userId !== undefined) params['user'] = opts.userId;
  if (opts?.blockCount !== undefined) params['block_count'] = opts.blockCount;

  const res = await haveApiCall<UserNamespace[]>({
    method: 'GET',
    path: '/user_namespaces',
    namespace: 'user_namespace',
    params,
  });

  return { ...res, data: expectArray<UserNamespace>(res.data, 'user_namespaces#index') };
}

export async function fetchUserNamespace(id: number) {
  return haveApiCall<UserNamespace>({
    method: 'GET',
    path: `/user_namespaces/${id}`,
  });
}

export async function fetchUserNamespaceMaps(opts?: {
  limit?: number;
  fromId?: number;
  q?: string;
  userId?: number;
  userNamespaceId?: number;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  const q = opts?.q ? String(opts.q).trim() : '';
  if (q) params['q'] = q;

  if (opts?.userId !== undefined) params['user'] = opts.userId;
  if (opts?.userNamespaceId !== undefined) params['user_namespace'] = opts.userNamespaceId;

  const res = await haveApiCall<UserNamespaceMap[]>({
    method: 'GET',
    path: '/user_namespace_maps',
    namespace: 'user_namespace_map',
    params,
  });

  return { ...res, data: expectArray<UserNamespaceMap>(res.data, 'user_namespace_maps#index') };
}

export async function fetchUserNamespaceMap(mapId: number) {
  return haveApiCall<UserNamespaceMap>({
    method: 'GET',
    path: `/user_namespace_maps/${mapId}`,
  });
}

export async function createUserNamespaceMap(payload: { userNamespaceId: number; label: string }) {
  return haveApiCall<UserNamespaceMap>({
    method: 'POST',
    path: '/user_namespace_maps',
    namespace: 'user_namespace_map',
    params: {
      user_namespace: payload.userNamespaceId,
      label: payload.label,
    },
  });
}

export async function updateUserNamespaceMap(mapId: number, payload: { label: string; userNamespaceId: number }) {
  return haveApiCall<UserNamespaceMap>({
    method: 'PUT',
    path: `/user_namespace_maps/${mapId}`,
    namespace: 'user_namespace_map',
    params: {
      // API requires both label and namespace reference (parity with old UI).
      user_namespace: payload.userNamespaceId,
      label: payload.label,
    },
  });
}

export async function deleteUserNamespaceMap(mapId: number) {
  return haveApiCall<null>({
    method: 'DELETE',
    path: `/user_namespace_maps/${mapId}`,
  });
}

export async function fetchUserNamespaceMapEntries(mapId: number, opts?: { limit?: number; fromId?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  const res = await haveApiCall<UserNamespaceMapEntry[]>({
    method: 'GET',
    path: `/user_namespace_maps/${mapId}/entries`,
    namespace: 'entry',
    params,
  });

  return { ...res, data: expectArray<UserNamespaceMapEntry>(res.data, `user_namespace_maps/${mapId}/entries#index`) };
}

export async function createUserNamespaceMapEntry(
  mapId: number,
  payload: { kind: UserNamespaceEntryKind; vps_id: number; ns_id: number; count: number }
) {
  return haveApiCall<UserNamespaceMapEntry>({
    method: 'POST',
    path: `/user_namespace_maps/${mapId}/entries`,
    namespace: 'entry',
    params: payload,
  });
}

export async function updateUserNamespaceMapEntry(
  mapId: number,
  entryId: number,
  payload: { vps_id?: number; ns_id?: number; count?: number }
) {
  return haveApiCall<UserNamespaceMapEntry>({
    method: 'PUT',
    path: `/user_namespace_maps/${mapId}/entries/${entryId}`,
    namespace: 'entry',
    params: payload,
  });
}

export async function deleteUserNamespaceMapEntry(mapId: number, entryId: number) {
  return haveApiCall<null>({
    method: 'DELETE',
    path: `/user_namespace_maps/${mapId}/entries/${entryId}`,
  });
}
