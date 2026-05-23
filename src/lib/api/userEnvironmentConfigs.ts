import { expectArray, haveApiCall } from './haveapi';

/**
 * User environment configs (env_cfg*)
 *
 * Backend resource:
 * - User::EnvironmentConfig (route: /users/:id/environment_configs)
 */

export interface UserEnvironmentConfigEnvironmentRef {
  id: number;
  label?: string;
  [k: string]: unknown;
}

export interface UserEnvironmentConfig {
  id: number;
  environment?: UserEnvironmentConfigEnvironmentRef;

  can_create_vps?: boolean;
  can_destroy_vps?: boolean;
  /** Seconds; 0 means unlimited */
  vps_lifetime?: number;
  /** 0 means unlimited */
  max_vps_count?: number;

  /** Admin-only: whether the config is inherited from the environment */
  default?: boolean;

  [k: string]: unknown;
}

export async function fetchUserEnvironmentConfigs(
  userId: number,
  opts?: {
    environmentId?: number;
    fromId?: number;
    limit?: number;
  }
) {
  const params: Record<string, unknown> = {};
  if (opts?.environmentId !== undefined) params['environment'] = opts.environmentId;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.limit !== undefined) params['limit'] = opts.limit;

  const res = await haveApiCall<UserEnvironmentConfig[]>({
    method: 'GET',
    path: `/users/${userId}/environment_configs`,
    namespace: Object.keys(params).length > 0 ? 'environment_config' : undefined,
    params: Object.keys(params).length > 0 ? params : undefined,
  });

  return {
    ...res,
    data: expectArray<UserEnvironmentConfig>(res.data, 'users/environment_configs#index'),
  };
}

export async function updateUserEnvironmentConfig(
  userId: number,
  configId: number,
  payload: Partial<Pick<UserEnvironmentConfig, 'can_create_vps' | 'can_destroy_vps' | 'vps_lifetime' | 'max_vps_count' | 'default'>>
) {
  return haveApiCall<UserEnvironmentConfig>({
    method: 'PUT',
    path: `/users/${userId}/environment_configs/${configId}`,
    namespace: 'environment_config',
    params: payload,
  });
}
