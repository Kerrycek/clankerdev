import { expectArray, haveApiCall } from './haveapi';
import type { ResourceRef } from './appTypes';
import type { Node } from './nodes';
import type { User } from './users';

export interface Vps {
  id: number;
  hostname: string;
  object_state?: string;
  expiration_date?: string | null;
  remind_after_date?: string | null;
  is_running?: boolean;
  uptime?: number;
  node?: Node;
  user?: User;
  os_template?: ResourceRef;
  dns_resolver?: ResourceRef;
  user_namespace_map?: ResourceRef;
  dataset?: ResourceRef;
  pool?: ResourceRef;
  manage_hostname?: boolean;
  cgroup_version?: number;
  allow_admin_modifications?: boolean;
  enable_network?: boolean;

  cpu?: number;
  memory?: number;
  swap?: number;
  diskspace?: number;

  used_memory?: number;
  used_swap?: number;
  used_diskspace?: number;

  loadavg1?: number;
  loadavg5?: number;
  loadavg15?: number;

  created_at?: string;

  [k: string]: unknown;
}

export interface VpsStatus {
  id: number;
  is_running?: boolean;
  uptime?: number;
  loadavg1?: number;
  loadavg5?: number;
  loadavg15?: number;
  total_memory?: number;
  used_memory?: number;
  total_swap?: number;
  used_swap?: number;
  total_diskspace?: number;
  used_diskspace?: number;
  created_at?: string;
  [k: string]: unknown;
}

export interface ConsoleToken {
  token: string;
  expiration: string;
  [k: string]: unknown;
}

export interface VpsPasswdReply {
  password: string;
}

interface CreateVpsCommonPayload {
  environment?: number;
  location?: number;
  hostname: string;
  os_template?: number;
  start?: boolean;
  cpu?: number;
  memory?: number;
  diskspace?: number;
  swap?: number;
  ipv4?: number;
  ipv6?: number;
  ipv4_private?: number;
}

export interface CreateVpsAdminPayload extends CreateVpsCommonPayload {
  mode: 'admin';
  node: number;
  user?: number;
  onstartall?: boolean;
}

export interface CreateVpsUserPayload extends CreateVpsCommonPayload {
  mode: 'user';
}

export type CreateVpsPayload = CreateVpsAdminPayload | CreateVpsUserPayload;

export function buildCreateVpsParams(payload: CreateVpsPayload): Record<string, unknown> {
  const common = {
    environment: payload.environment,
    location: payload.location,
    hostname: payload.hostname,
    os_template: payload.os_template,
    start: payload.start,
    cpu: payload.cpu,
    memory: payload.memory,
    diskspace: payload.diskspace,
    swap: payload.swap,
    ipv4: payload.ipv4,
    ipv6: payload.ipv6,
    ipv4_private: payload.ipv4_private,
  };

  if (payload.mode === 'admin') {
    return {
      ...common,
      user: payload.user,
      node: payload.node,
      onstartall: payload.onstartall,
    };
  }

  return common;
}

export async function fetchVpsList(opts?: {
  limit?: number;
  fromId?: number;
  hostnameAny?: string;
  hostnameExact?: string;
  user?: number;
  userNamespaceMap?: number;
  node?: number;
  location?: number;
  environment?: number;
  /** Optional abort signal (used by command palette for rapid typing). */
  signal?: AbortSignal;
}) {
  const params: Record<string, string | number | boolean> = {};

  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.hostnameAny) params['hostname_any'] = opts.hostnameAny;
  if (opts?.hostnameExact) params['hostname_exact'] = opts.hostnameExact;
  if (opts?.user !== undefined) params['user'] = opts.user;
  if (opts?.userNamespaceMap !== undefined) params['user_namespace_map'] = opts.userNamespaceMap;
  if (opts?.node !== undefined) params['node'] = opts.node;
  if (opts?.location !== undefined) params['location'] = opts.location;
  if (opts?.environment !== undefined) params['environment'] = opts.environment;

  const res = await haveApiCall<Vps[]>({
    method: 'GET',
    path: '/vpses',
    namespace: 'vps',
    params,
    signal: opts?.signal,
  });
  return { ...res, data: expectArray<Vps>(res.data, 'vpses') };
}

export async function fetchVps(vpsId: number, opts?: { includes?: string; signal?: AbortSignal }) {
  return haveApiCall<Vps>({
    method: 'GET',
    path: `/vpses/${vpsId}`,
    meta: opts?.includes ? { includes: opts.includes } : undefined,
    signal: opts?.signal,
  });
}

export async function updateVps(vpsId: number, params: Record<string, unknown>) {
  return haveApiCall<Vps>({
    method: 'PUT',
    path: `/vpses/${vpsId}`,
    namespace: 'vps',
    params,
  });
}

export async function createVps(payload: CreateVpsPayload) {
  return haveApiCall<Vps>({
    method: 'POST',
    path: '/vpses',
    namespace: 'vps',
    params: buildCreateVpsParams(payload),
  });
}

export async function vpsStart(vpsId: number) {
  return haveApiCall<null>({
    method: 'POST',
    path: `/vpses/${vpsId}/start`,
  });
}

export async function vpsStop(vpsId: number, opts?: { force?: boolean }) {
  return haveApiCall<null>({
    method: 'POST',
    path: `/vpses/${vpsId}/stop`,
    namespace: 'vps',
    params: opts?.force ? { force: true } : undefined,
  });
}

export async function vpsRestart(vpsId: number, opts?: { force?: boolean }) {
  return haveApiCall<null>({
    method: 'POST',
    path: `/vpses/${vpsId}/restart`,
    namespace: 'vps',
    params: opts?.force ? { force: true } : undefined,
  });
}

export async function vpsPasswd(vpsId: number, type: 'simple' | 'secure' = 'secure') {
  return haveApiCall<VpsPasswdReply>({
    method: 'POST',
    path: `/vpses/${vpsId}/passwd`,
    namespace: 'vps',
    params: { type },
  });
}

export async function createConsoleToken(vpsId: number) {
  return haveApiCall<ConsoleToken>({
    method: 'POST',
    path: `/vpses/${vpsId}/console_token`,
  });
}

export async function deleteConsoleToken(vpsId: number) {
  return haveApiCall<null>({
    method: 'DELETE',
    path: `/vpses/${vpsId}/console_token`,
  });
}

export async function fetchVpsStatuses(
  vpsId: number,
  opts?: { limit?: number; fromId?: number; from?: string; to?: string }
) {
  const params: Record<string, string | number> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.from) params['from'] = opts.from;
  if (opts?.to) params['to'] = opts.to;

  const res = await haveApiCall<VpsStatus[]>({
    method: 'GET',
    path: `/vpses/${vpsId}/statuses`,
    namespace: 'status',
    params,
  });
  return { ...res, data: expectArray<VpsStatus>(res.data, `vpses/${vpsId}/statuses`) };
}
