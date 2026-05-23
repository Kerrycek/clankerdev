import { expectArray, haveApiCall } from './haveapi';

export interface PublicClusterStats {
  user_count: number;
  vps_count: number;
  ipv4_left: number;
}

export interface LocationRef {
  id?: number;
  label?: string;
}

export interface PublicNodeStatus {
  status: boolean;
  name: string;
  fqdn?: string;
  location?: LocationRef;
  last_report?: string;
  vps_count?: number;
  vps_free?: number;
  kernel?: string;
  type?: string;
  hypervisor_type?: string;
  cpu_idle?: number;
  maintenance_lock?: string;
  maintenance_lock_reason?: string;
  // Additional fields may appear depending on node role / exports.
  [k: string]: unknown;
}

export type OutageState = string;
export interface Outage {
  id: number;
  begins_at?: string;
  finished_at?: string | null;
  duration?: number | null;
  type?: string;
  state?: OutageState;
  impact?: string;
  auto_resolve?: boolean;
  affected?: boolean;
  affected_user_count?: number;
  affected_direct_vps_count?: number;
  affected_indirect_vps_count?: number;
  affected_export_count?: number;
  // translation fields: e.g. en_summary, cs_description, ...
  [k: string]: unknown;
}

export interface OutageEntity {
  id: number;
  name: string;
  entity_id?: number | null;
  label?: string;
}

export interface OutageHandler {
  id: number;
  full_name?: string;
  note?: string;
  reporter_name?: string;
  [k: string]: unknown;
}

export interface OutageUpdate {
  id: number;
  outage?: { id: number; begins_at?: string };
  type?: string;
  begins_at?: string;
  finished_at?: string | null;
  duration?: number | null;
  state?: string;
  impact?: string;
  created_at?: string;
  reporter_name?: string;
  [k: string]: unknown;
}

export interface NewsLog {
  id: number;
  message: string;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
}

export async function fetchPublicStats() {
  return haveApiCall<PublicClusterStats>({
    method: 'GET',
    path: '/cluster/public_stats',
  });
}

export async function fetchPublicNodeStatus() {
  const res = await haveApiCall<PublicNodeStatus[]>({
    method: 'GET',
    path: '/nodes/public_status',
  });
  return { ...res, data: expectArray<PublicNodeStatus>(res.data, 'nodes/public_status') };
}

export async function fetchOutages() {
  const res = await haveApiCall<Outage[]>({
    method: 'GET',
    path: '/outages',
  });
  return { ...res, data: expectArray<Outage>(res.data, 'outages') };
}

export async function fetchOutage(outageId: number) {
  return haveApiCall<Outage>({
    method: 'GET',
    path: `/outages/${outageId}`,
  });
}

export async function fetchOutageEntities(outageId: number) {
  const res = await haveApiCall<OutageEntity[]>({
    method: 'GET',
    path: `/outages/${outageId}/entities`,
  });
  return { ...res, data: expectArray<OutageEntity>(res.data, `outages/${outageId}/entities`) };
}

export async function fetchOutageHandlers(outageId: number) {
  const res = await haveApiCall<OutageHandler[]>({
    method: 'GET',
    path: `/outages/${outageId}/handlers`,
  });
  return { ...res, data: expectArray<OutageHandler>(res.data, `outages/${outageId}/handlers`) };
}

export async function fetchOutageUpdates(outageId: number) {
  // Index input is namespaced under outage_update[...] in the query string.
  const res = await haveApiCall<OutageUpdate[]>({
    method: 'GET',
    path: '/outage_updates',
    namespace: 'outage_update',
    params: { outage: outageId },
  });
  return { ...res, data: expectArray<OutageUpdate>(res.data, 'outage_updates') };
}

export async function fetchNews() {
  const res = await haveApiCall<NewsLog[]>({
    method: 'GET',
    path: '/news_logs',
  });
  return { ...res, data: expectArray<NewsLog>(res.data, 'news_logs') };
}

