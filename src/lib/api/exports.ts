import { expectArray, haveApiCall } from './haveapi';

export interface ResourceRef {
  id: number;
  [k: string]: unknown;
}

export interface HostIpAddress {
  id: number;
  ip_address?: ResourceRef;
  addr?: string;
  assigned?: boolean;
  user_created?: boolean;
  reverse_record_value?: string | null;
  [k: string]: unknown;
}

export interface ExportItem {
  id: number;
  dataset?: ResourceRef;
  snapshot?: ResourceRef | null;
  user?: ResourceRef;
  ip_address?: ResourceRef;
  host_ip_address?: ResourceRef;
  path?: string;
  all_vps?: boolean;
  rw?: boolean;
  sync?: boolean;
  subtree_check?: boolean;
  root_squash?: boolean;
  threads?: number;
  enabled?: boolean;
  expiration_date?: string | null;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export interface ExportHost {
  id: number;
  ip_address?: ResourceRef;
  rw?: boolean;
  sync?: boolean;
  subtree_check?: boolean;
  root_squash?: boolean;
  [k: string]: unknown;
}

export async function fetchExports(opts?: {
  fromId?: number;
  limit?: number;
  q?: string;
  user?: number;
  dataset?: number;
  snapshot?: number;
  hostIpAddress?: number;
  enabled?: boolean;
  includes?: string;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  // Legacy Export::Index only accepts limit/from_id.
  // Next UI keeps q/user/dataset/snapshot/host/enabled as current-page filters.

  const res = await haveApiCall<ExportItem[]>({
    method: 'GET',
    path: '/exports',
    namespace: 'export',
    params,
    meta: opts?.includes ? { includes: opts.includes } : undefined,
  });

  return { ...res, data: expectArray<ExportItem>(res.data, 'exports#index') };
}

export async function fetchExport(exportId: number, opts?: { includes?: string }) {
  return haveApiCall<ExportItem>({
    method: 'GET',
    path: `/exports/${exportId}`,
    meta: opts?.includes ? { includes: opts.includes } : undefined,
  });
}

type ExportCreatePayload = {
  dataset?: number;
  snapshot?: number;
  host_ip_address: number;
  all_vps?: boolean;
  rw?: boolean;
  sync?: boolean;
  subtree_check?: boolean;
  root_squash?: boolean;
  threads?: number;
  enabled?: boolean;
};

type ExportUpdatePayload = {
  all_vps?: boolean;
  rw?: boolean;
  sync?: boolean;
  subtree_check?: boolean;
  root_squash?: boolean;
  threads?: number;
  enabled?: boolean;
};

function sanitizeExportPayload<T extends ExportCreatePayload | ExportUpdatePayload>(payload: T): Omit<T, 'threads'> {
  const { threads: _threads, ...safe } = payload;
  return safe;
}

export async function createExport(payload: ExportCreatePayload) {
  return haveApiCall<ExportItem>({
    method: 'POST',
    path: '/exports',
    namespace: 'export',
    params: sanitizeExportPayload(payload),
  });
}

export async function updateExport(exportId: number, payload: ExportUpdatePayload) {
  return haveApiCall<ExportItem>({
    method: 'PUT',
    path: `/exports/${exportId}`,
    namespace: 'export',
    params: sanitizeExportPayload(payload),
  });
}

export async function deleteExport(exportId: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/exports/${exportId}`,
  });
}

export async function fetchExportHosts(exportId: number, opts?: { fromId?: number; limit?: number; includes?: string }) {
  const params: Record<string, unknown> = {};
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  const res = await haveApiCall<ExportHost[]>({
    method: 'GET',
    path: `/exports/${exportId}/hosts`,
    namespace: 'host',
    params,
    meta: opts?.includes ? { includes: opts.includes } : undefined,
  });
  return { ...res, data: expectArray<ExportHost>(res.data, `exports/${exportId}/hosts#index`) };
}

export async function createExportHost(exportId: number, payload: {
  ip_address: number;
  rw?: boolean;
  sync?: boolean;
  subtree_check?: boolean;
  root_squash?: boolean;
}) {
  return haveApiCall<ExportHost>({
    method: 'POST',
    path: `/exports/${exportId}/hosts`,
    namespace: 'host',
    params: payload,
  });
}

export async function updateExportHost(exportId: number, hostId: number, payload: {
  rw?: boolean;
  sync?: boolean;
  subtree_check?: boolean;
  root_squash?: boolean;
}) {
  return haveApiCall<ExportHost>({
    method: 'PUT',
    path: `/exports/${exportId}/hosts/${hostId}`,
    namespace: 'host',
    params: payload,
  });
}

export async function deleteExportHost(exportId: number, hostId: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/exports/${exportId}/hosts/${hostId}`,
  });
}

export async function fetchHostIpAddresses(opts?: {
  fromId?: number;
  limit?: number;
  q?: string;
  user?: number;
  vps?: number;
  assigned?: boolean;
  order?: string;
  includes?: string;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.q !== undefined) params['q'] = opts.q;
  if (opts?.user !== undefined) params['user'] = opts.user;
  if (opts?.vps !== undefined) params['vps'] = opts.vps;
  if (opts?.assigned !== undefined) params['assigned'] = opts.assigned;
  if (opts?.order !== undefined) params['order'] = opts.order;

  const res = await haveApiCall<HostIpAddress[]>({
    method: 'GET',
    path: '/host_ip_addresses',
    namespace: 'host_ip_address',
    params,
    meta: opts?.includes ? { includes: opts.includes } : undefined,
  });

  return { ...res, data: expectArray<HostIpAddress>(res.data, 'host_ip_addresses#index') };
}
