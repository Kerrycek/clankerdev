import { haveApiCall } from './haveapi';

export interface ClusterShow {
  maintenance_lock: boolean;
  maintenance_lock_reason?: string;
  [k: string]: unknown;
}

export interface ClusterFullStats {
  nodes_online: number;
  node_count: number;

  vps_running: number;
  vps_stopped: number;
  vps_suspended: number;
  vps_deleted: number;
  vps_count: number;

  user_active: number;
  user_suspended: number;
  user_deleted: number;
  user_count: number;

  ipv4_used: number;
  ipv4_count: number;

  [k: string]: unknown;
}

export async function fetchClusterFullStats() {
  return haveApiCall<ClusterFullStats>({
    method: 'GET',
    path: '/cluster/full_stats',
  });
}


export async function fetchCluster() {
  return haveApiCall<ClusterShow>({
    method: 'GET',
    path: '/cluster',
  });
}

export async function setClusterMaintenance(opts: { lock: boolean; reason?: string }) {
  return haveApiCall<void>({
    method: 'POST',
    path: '/cluster/set_maintenance',
    namespace: 'cluster',
    params: { lock: opts.lock, reason: opts.reason },
  });
}
