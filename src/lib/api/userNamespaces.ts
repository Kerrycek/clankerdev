import { expectArray, haveApiCall } from './haveapi';
import type { UserRole } from '../roles';
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

/** Administrators bypass the backend owner restriction and need exact scope. */
export function explicitUserNamespaceOwnerId(input: {
  viewerRole: UserRole;
  fixedOwnerId?: number;
  requestedOwnerId?: number;
  allowRequestedOwner?: boolean;
}): number | undefined {
  if (input.viewerRole !== 'admin') return undefined;
  if (validResourceId(input.fixedOwnerId)) return input.fixedOwnerId;
  if (input.allowRequestedOwner && validResourceId(input.requestedOwnerId)) return input.requestedOwnerId;
  return undefined;
}

function validResourceId(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

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
  size?: number;
  userId?: number;
  blockCount?: number;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

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
  userId?: number;
  userNamespaceId?: number;
  includeUserNamespace?: boolean;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  if (opts?.userId !== undefined) params['user'] = opts.userId;
  if (opts?.userNamespaceId !== undefined) params['user_namespace'] = opts.userNamespaceId;

  const res = await haveApiCall<UserNamespaceMap[]>({
    method: 'GET',
    path: '/user_namespace_maps',
    namespace: 'user_namespace_map',
    params,
    meta: opts?.includeUserNamespace ? { includes: 'user_namespace' } : undefined,
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
