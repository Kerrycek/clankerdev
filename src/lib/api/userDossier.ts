import type { WebauthnPublicKeyCredentialJson } from '../webauthn';

import { expectArray, haveApiCall } from './haveapi';

/**
 * User dossier API wrappers
 *
 * Shared primitives used by:
 * - /profile/* (current user)
 * - /admin/users/:id/* (admin user dossier)
 */

// ---- SSH public keys -------------------------------------------------------

export interface UserPublicKey {
  id: number;
  label?: string;
  key?: string;
  auto_add?: boolean;
  fingerprint?: string;
  comment?: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export async function fetchUserPublicKeys(userId: number, opts?: { fromId?: number; limit?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.limit !== undefined) params['limit'] = opts.limit;

  const res = await haveApiCall<UserPublicKey[]>({
    method: 'GET',
    path: `/users/${userId}/public_keys`,
    namespace: Object.keys(params).length > 0 ? 'public_key' : undefined,
    params: Object.keys(params).length > 0 ? params : undefined,
  });

  return { ...res, data: expectArray<UserPublicKey>(res.data, 'users/public_keys#index') };
}

export async function createUserPublicKey(
  userId: number,
  payload: { label: string; key: string; auto_add?: boolean }
) {
  return haveApiCall<UserPublicKey>({
    method: 'POST',
    path: `/users/${userId}/public_keys`,
    namespace: 'public_key',
    params: payload,
  });
}

export async function updateUserPublicKey(
  userId: number,
  keyId: number,
  payload: { label?: string; key?: string; auto_add?: boolean }
) {
  return haveApiCall<UserPublicKey>({
    method: 'PUT',
    path: `/users/${userId}/public_keys/${keyId}`,
    namespace: 'public_key',
    params: payload,
  });
}

export async function deleteUserPublicKey(userId: number, keyId: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/users/${userId}/public_keys/${keyId}`,
  });
}

// ---- Sessions (API tokens) -------------------------------------------------

export interface UserSessionUserRef {
  id: number;
  login?: string;
  [k: string]: unknown;
}

export interface UserSession {
  id: number;
  current?: boolean;
  user?: UserSessionUserRef;
  label?: string;
  auth_type?: string;

  // IPs
  api_ip_addr?: string;
  api_ip_ptr?: string;
  client_ip_addr?: string;
  client_ip_ptr?: string;

  user_agent?: string;
  client_version?: string;

  scope?: string;
  token_fragment?: string;
  token_lifetime?: string;
  token_interval?: number;

  // Only returned by UserSession.Create
  token_full?: string;

  created_at?: string;
  last_request_at?: string;
  request_count?: number;
  closed_at?: string | null;

  admin?: UserSessionUserRef;

  [k: string]: unknown;
}

export async function fetchUserSessions(opts?: {
  /** Admin-only: list sessions for specific user. */
  userId?: number;
  fromId?: number;
  limit?: number;
  state?: 'all' | 'open' | 'closed';
  ip_addr?: string;
  api_ip_addr?: string;
  client_ip_addr?: string;
  user_agent?: string;
  client_version?: string;
  token_fragment?: string;
  auth_type?: 'basic' | 'token' | 'oauth2';
  adminId?: number;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.userId !== undefined) params['user'] = opts.userId;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.state !== undefined) params['state'] = opts.state;
  if (opts?.ip_addr) params['ip_addr'] = opts.ip_addr;
  if (opts?.api_ip_addr) params['api_ip_addr'] = opts.api_ip_addr;
  if (opts?.client_ip_addr) params['client_ip_addr'] = opts.client_ip_addr;
  if (opts?.user_agent) params['user_agent'] = opts.user_agent;
  if (opts?.client_version) params['client_version'] = opts.client_version;
  if (opts?.token_fragment) params['token_fragment'] = opts.token_fragment;
  if (opts?.auth_type) params['auth_type'] = opts.auth_type;
  if (opts?.adminId !== undefined) params['admin'] = opts.adminId;

  const res = await haveApiCall<UserSession[]>({
    method: 'GET',
    path: '/user_sessions',
    namespace: 'user_session',
    params,
  });

  return { ...res, data: expectArray<UserSession>(res.data, 'user_sessions#index') };
}

export async function fetchUserSession(sessionId: number) {
  return haveApiCall<UserSession>({
    method: 'GET',
    path: `/user_sessions/${sessionId}`,
  });
}

export async function updateUserSessionLabel(sessionId: number, label: string) {
  return haveApiCall<UserSession>({
    method: 'PUT',
    path: `/user_sessions/${sessionId}`,
    namespace: 'user_session',
    params: { label },
  });
}

export async function closeUserSession(sessionId: number) {
  // In HaveAPI, the "close" action is POST /user_sessions/:id
  return haveApiCall<void>({
    method: 'POST',
    path: `/user_sessions/${sessionId}`,
  });
}

export async function createUserSessionToken(payload: {
  /** Admin-only: user to create token for */
  userId: number;
  label: string;
  token_lifetime: 'fixed' | 'renewable_manual' | 'renewable_auto' | 'permanent';
  /** Seconds; required when token_lifetime is fixed/renewable_* */
  token_interval?: number;
  scope?: string;
}) {
  return haveApiCall<UserSession>({
    method: 'POST',
    path: '/user_sessions',
    namespace: 'user_session',
    params: {
      user: payload.userId,
      label: payload.label,
      token_lifetime: payload.token_lifetime,
      token_interval: payload.token_interval,
      scope: payload.scope ?? 'all',
    },
  });
}

// ---- Metrics access tokens -------------------------------------------------

export interface MetricsAccessToken {
  id: number;
  user?: UserSessionUserRef;
  metric_prefix?: string;
  access_token?: string;
  use_count?: number;
  last_use?: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export async function fetchMetricsAccessTokens(opts?: { userId?: number; fromId?: number; limit?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.userId !== undefined) params['user'] = opts.userId;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.limit !== undefined) params['limit'] = opts.limit;

  const res = await haveApiCall<MetricsAccessToken[]>({
    method: 'GET',
    path: '/metrics_access_tokens',
    namespace: Object.keys(params).length > 0 ? 'metrics_access_token' : undefined,
    params: Object.keys(params).length > 0 ? params : undefined,
  });

  return {
    ...res,
    data: expectArray<MetricsAccessToken>(res.data, 'metrics_access_tokens#index'),
  };
}

export async function createMetricsAccessToken(payload: {
  userId?: number;
  metric_prefix: string;
}) {
  const params: Record<string, unknown> = { metric_prefix: payload.metric_prefix };
  if (payload.userId !== undefined) params['user'] = payload.userId;

  return haveApiCall<MetricsAccessToken>({
    method: 'POST',
    path: '/metrics_access_tokens',
    namespace: 'metrics_access_token',
    params,
  });
}

export async function deleteMetricsAccessToken(tokenId: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/metrics_access_tokens/${tokenId}`,
  });
}

// ---- Known devices ---------------------------------------------------------

export interface UserKnownDevice {
  id: number;
  api_ip_addr?: string;
  api_ip_ptr?: string;
  client_ip_addr?: string;
  client_ip_ptr?: string;
  user_agent?: string;
  skip_multi_factor_auth_until?: string | null;
  last_seen_at?: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export async function fetchUserKnownDevices(userId: number, opts?: { fromId?: number; limit?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.limit !== undefined) params['limit'] = opts.limit;

  const res = await haveApiCall<UserKnownDevice[]>({
    method: 'GET',
    path: `/users/${userId}/known_devices`,
    namespace: Object.keys(params).length > 0 ? 'known_device' : undefined,
    params: Object.keys(params).length > 0 ? params : undefined,
  });

  return {
    ...res,
    data: expectArray<UserKnownDevice>(res.data, `users/${userId}/known_devices#index`),
  };
}

export async function deleteUserKnownDevice(userId: number, deviceId: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/users/${userId}/known_devices/${deviceId}`,
  });
}

// ---- TOTP devices ----------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}


export interface UserTotpDevice {
  id: number;
  label?: string;
  confirmed?: boolean;
  enabled?: boolean;
  last_use_at?: string;
  use_count?: number;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export interface UserTotpDeviceCreateResponse extends UserTotpDevice {
  secret: string;
  provisioning_uri: string;
}

export async function fetchUserTotpDevices(
  userId: number,
  opts?: { fromId?: number; limit?: number; confirmed?: boolean; enabled?: boolean }
) {
  const params: Record<string, unknown> = {};
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.confirmed !== undefined) params['confirmed'] = opts.confirmed;
  if (opts?.enabled !== undefined) params['enabled'] = opts.enabled;

  const res = await haveApiCall<UserTotpDevice[]>({
    method: 'GET',
    path: `/users/${userId}/totp_devices`,
    namespace: Object.keys(params).length > 0 ? 'totp_device' : undefined,
    params: Object.keys(params).length > 0 ? params : undefined,
  });

  return {
    ...res,
    data: expectArray<UserTotpDevice>(res.data, `users/${userId}/totp_devices#index`),
  };
}

export async function createUserTotpDevice(userId: number, payload: { label: string }) {
  const res = await haveApiCall<unknown>({
    method: 'POST',
    path: `/users/${userId}/totp_devices`,
    namespace: 'totp_device',
    params: payload,
  });

  const data = res.data;
  if (!isRecord(data)) {
    throw new Error(`users/${userId}/totp_devices#create: expected object, got ${typeof data}`);
  }
  if (typeof data['secret'] !== 'string' || typeof data['provisioning_uri'] !== 'string') {
    throw new Error(`users/${userId}/totp_devices#create: missing secret/provisioning_uri`);
  }

  return { ...res, data: data as UserTotpDeviceCreateResponse };
}

export async function confirmUserTotpDevice(userId: number, deviceId: number, payload: { code: string }) {
  const res = await haveApiCall<unknown>({
    method: 'POST',
    path: `/users/${userId}/totp_devices/${deviceId}/confirm`,
    namespace: 'totp_device',
    params: payload,
  });

  const data = res.data;

  // HaveAPI responses differ across versions:
  // - either `{ recovery_code: "..." }`
  // - or directly `"..."` when the top-level key is `recovery_code`
  const recovery =
    typeof data === 'string'
      ? data
      : isRecord(data) && typeof data['recovery_code'] === 'string'
        ? data['recovery_code']
        : null;

  if (!recovery) {
    throw new Error(`users/${userId}/totp_devices/${deviceId}/confirm: expected recovery_code`);
  }

  return { ...res, data: recovery };
}

export async function updateUserTotpDevice(
  userId: number,
  deviceId: number,
  payload: { label?: string; enabled?: boolean }
) {
  return haveApiCall<UserTotpDevice>({
    method: 'PUT',
    path: `/users/${userId}/totp_devices/${deviceId}`,
    namespace: 'totp_device',
    params: payload,
  });
}

export async function deleteUserTotpDevice(userId: number, deviceId: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/users/${userId}/totp_devices/${deviceId}`,
  });
}

// ---- WebAuthn credentials --------------------------------------------------

export interface UserWebauthnCredential {
  id: number;
  label?: string;
  enabled?: boolean;
  use_count?: number;
  last_use_at?: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export async function fetchUserWebauthnCredentials(
  userId: number,
  opts?: { fromId?: number; limit?: number; enabled?: boolean }
) {
  const params: Record<string, unknown> = {};
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.enabled !== undefined) params['enabled'] = opts.enabled;

  const res = await haveApiCall<UserWebauthnCredential[]>({
    method: 'GET',
    path: `/users/${userId}/webauthn_credentials`,
    namespace: Object.keys(params).length > 0 ? 'webauthn_credential' : undefined,
    params: Object.keys(params).length > 0 ? params : undefined,
  });

  return {
    ...res,
    data: expectArray<UserWebauthnCredential>(res.data, `users/${userId}/webauthn_credentials#index`),
  };
}

export async function updateUserWebauthnCredential(
  userId: number,
  credId: number,
  payload: { label?: string; enabled?: boolean }
) {
  return haveApiCall<UserWebauthnCredential>({
    method: 'PUT',
    path: `/users/${userId}/webauthn_credentials/${credId}`,
    namespace: 'webauthn_credential',
    params: payload,
  });
}

export async function deleteUserWebauthnCredential(userId: number, credId: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/users/${userId}/webauthn_credentials/${credId}`,
  });
}

// ---- WebAuthn registration (current user) ---------------------------------

export interface WebauthnRegistrationBeginResponse {
  challenge_token: string;
  options: unknown;
}

export async function beginWebauthnRegistration() {
  return haveApiCall<WebauthnRegistrationBeginResponse>({
    method: 'POST',
    path: '/webauthn/registration/begin',
  });
}

export async function finishWebauthnRegistration(payload: {
  challenge_token: string;
  label: string;
  public_key_credential: WebauthnPublicKeyCredentialJson;
}) {
  return haveApiCall<void>({
    method: 'POST',
    path: '/webauthn/registration/finish',
    namespace: 'registration',
    params: payload,
  });
}
