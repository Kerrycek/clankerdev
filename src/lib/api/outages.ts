import type { ResourceRef, User, Vps } from './app';
import type { ExportItem } from './exports';
import { expectArray, haveApiCall } from './haveapi';
import type { Outage, OutageEntity, OutageHandler, OutageUpdate } from './public';

export type OutageAdminState = 'staged' | 'announced' | 'cancelled' | 'resolved';
export type OutageAdminType = 'outage' | 'maintenance';
export type OutageImpact =
  | 'tbd'
  | 'performance'
  | 'network'
  | 'system_restart'
  | 'system_reset'
  | 'unavailability'
  | 'export';

export interface OutageFilters {
  limit?: number;
  fromId?: number;
  type?: string;
  state?: string;
  impact?: string;
  affected?: boolean;
  user?: number;
  handledBy?: number;
  vps?: number;
  exportId?: number;
  environment?: number;
  location?: number;
  node?: number;
  vpsadmin?: number;
  entityName?: string;
  entityId?: number;
  order?: string;
}

export interface OutagePayload {
  begins_at?: string | null;
  finished_at?: string | null;
  duration?: number | null;
  type?: string;
  impact?: string;
  state?: string;
  auto_resolve?: boolean;
  en_summary?: string;
  en_description?: string;
  cs_summary?: string;
  cs_description?: string;
}

export interface OutageUpdatePayload {
  outage: number;
  send_mail?: boolean;
  begins_at?: string | null;
  finished_at?: string | null;
  duration?: number | null;
  impact?: string;
  state?: string;
  en_summary?: string;
  en_description?: string;
  cs_summary?: string;
  cs_description?: string;
}

export interface OutageAffectedUser {
  id: number;
  user?: User | ResourceRef;
  vps_count?: number;
  export_count?: number;
  [k: string]: unknown;
}

export interface OutageAffectedVps {
  id: number;
  outage?: Outage | ResourceRef;
  vps?: Vps | ResourceRef;
  direct?: boolean;
  user?: User | ResourceRef;
  environment?: ResourceRef;
  location?: ResourceRef;
  node?: ResourceRef;
  [k: string]: unknown;
}

export interface OutageAffectedExport {
  id: number;
  outage?: Outage | ResourceRef;
  export?: ExportItem | ResourceRef;
  user?: User | ResourceRef;
  environment?: ResourceRef;
  location?: ResourceRef;
  node?: ResourceRef;
  [k: string]: unknown;
}

function outageListParams(opts?: OutageFilters): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.type) params['type'] = opts.type;
  if (opts?.state) params['state'] = opts.state;
  if (opts?.impact) params['impact'] = opts.impact;
  if (opts?.affected !== undefined) params['affected'] = opts.affected;
  if (opts?.user !== undefined) params['user'] = opts.user;
  if (opts?.handledBy !== undefined) params['handled_by'] = opts.handledBy;
  if (opts?.vps !== undefined) params['vps'] = opts.vps;
  if (opts?.exportId !== undefined) params['export'] = opts.exportId;
  if (opts?.environment !== undefined) params['environment'] = opts.environment;
  if (opts?.location !== undefined) params['location'] = opts.location;
  if (opts?.node !== undefined) params['node'] = opts.node;
  if (opts?.vpsadmin !== undefined) params['vpsadmin'] = opts.vpsadmin;
  if (opts?.entityName) params['entity_name'] = opts.entityName;
  if (opts?.entityId !== undefined) params['entity_id'] = opts.entityId;
  if (opts?.order) params['order'] = opts.order;
  return params;
}

export async function fetchAdminOutages(opts?: OutageFilters) {
  const res = await haveApiCall<Outage[]>({
    method: 'GET',
    path: '/outages',
    namespace: 'outage',
    params: outageListParams(opts),
  });
  return { ...res, data: expectArray<Outage>(res.data, 'outages#index') };
}

export async function createOutage(params: OutagePayload) {
  return haveApiCall<Outage>({
    method: 'POST',
    path: '/outages',
    namespace: 'outage',
    params: { ...params },
  });
}

export async function updateOutage(outageId: number, params: OutagePayload) {
  return haveApiCall<Outage>({
    method: 'PUT',
    path: `/outages/${outageId}`,
    namespace: 'outage',
    params: { ...params },
  });
}

export async function rebuildOutageAffectedVps(outageId: number) {
  return haveApiCall<Outage>({
    method: 'POST',
    path: `/outages/${outageId}/rebuild_affected_vps`,
  });
}

export async function createOutageUpdate(params: OutageUpdatePayload) {
  return haveApiCall<OutageUpdate>({
    method: 'POST',
    path: '/outage_updates',
    namespace: 'outage_update',
    params: { ...params },
  });
}

export async function createOutageEntity(outageId: number, params: { name: string; entity_id?: number | null }) {
  return haveApiCall<OutageEntity>({
    method: 'POST',
    path: `/outages/${outageId}/entities`,
    namespace: 'entity',
    params,
  });
}

export async function deleteOutageEntity(outageId: number, entityId: number) {
  return haveApiCall<null>({
    method: 'DELETE',
    path: `/outages/${outageId}/entities/${entityId}`,
  });
}

export async function createOutageHandler(outageId: number, params: { user: number }) {
  return haveApiCall<OutageHandler>({
    method: 'POST',
    path: `/outages/${outageId}/handlers`,
    namespace: 'handler',
    params,
  });
}

export async function deleteOutageHandler(outageId: number, handlerId: number) {
  return haveApiCall<null>({
    method: 'DELETE',
    path: `/outages/${outageId}/handlers/${handlerId}`,
  });
}

export async function fetchUserOutages(outageId: number) {
  const res = await haveApiCall<OutageAffectedUser[]>({
    method: 'GET',
    path: '/user_outages',
    namespace: 'user_outage',
    params: { outage: outageId },
    meta: { includes: 'user' },
  });
  return { ...res, data: expectArray<OutageAffectedUser>(res.data, 'user_outages#index') };
}

export async function fetchVpsOutages(outageId: number) {
  const res = await haveApiCall<OutageAffectedVps[]>({
    method: 'GET',
    path: '/vps_outages',
    namespace: 'vps_outage',
    params: { outage: outageId },
    meta: { includes: 'vps,user,environment,location,node' },
  });
  return { ...res, data: expectArray<OutageAffectedVps>(res.data, 'vps_outages#index') };
}

export async function fetchExportOutages(outageId: number) {
  const res = await haveApiCall<OutageAffectedExport[]>({
    method: 'GET',
    path: '/export_outages',
    namespace: 'export_outage',
    params: { outage: outageId },
    meta: { includes: 'export,user,environment,location,node' },
  });
  return { ...res, data: expectArray<OutageAffectedExport>(res.data, 'export_outages#index') };
}
