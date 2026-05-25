import { expectArray, haveApiCall } from './haveapi';
import { fetchUserPublicKeys, type UserPublicKey } from './userDossier';
import { fetchCurrentUser, type User } from './users';

export type VpsPasswordType = 'secure' | 'simple';

export type VpsPasswordOptions = {
  type?: VpsPasswordType;
};

export type VpsGeneratedPassword = {
  password: string;
};

export type UserIdentity = User;

export type VpsPublicKey = UserPublicKey;

export type ApiResult<T> = {
  data: T;
  meta?: Record<string, unknown>;
  status?: boolean;
  message?: string;
  raw?: unknown;
};

function withRaw<T>(res: { data: T; meta?: Record<string, unknown>; envelope?: unknown }): ApiResult<T> {
  return { data: res.data, meta: res.meta, raw: res.envelope };
}

function passwordPayload(options?: VpsPasswordOptions): Record<string, unknown> {
  return { type: options?.type ?? 'secure' };
}

export async function resetVpsRootPassword(vpsId: number, options?: VpsPasswordOptions): Promise<ApiResult<VpsGeneratedPassword>> {
  const res = await haveApiCall<VpsGeneratedPassword>({
    method: 'POST',
    path: `/vpses/${vpsId}/passwd`,
    namespace: 'vps',
    params: passwordPayload(options),
  });

  return withRaw(res);
}

export async function getCurrentUser(): Promise<ApiResult<UserIdentity>> {
  return withRaw(await fetchCurrentUser());
}

export async function listUserPublicKeys(userId: number): Promise<ApiResult<VpsPublicKey[]>> {
  const res = await fetchUserPublicKeys(userId, { limit: 100 });
  return { ...withRaw(res), data: expectArray<VpsPublicKey>(res.data, `users/${userId}/public_keys`) };
}

export async function deployVpsPublicKey(vpsId: number, publicKeyId: number): Promise<ApiResult<Record<string, never>>> {
  const res = await haveApiCall<Record<string, never>>({
    method: 'POST',
    path: `/vpses/${vpsId}/deploy_public_key`,
    namespace: 'vps',
    params: { public_key: publicKeyId },
  });

  return withRaw(res);
}
