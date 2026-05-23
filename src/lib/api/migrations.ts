import { expectArray, haveApiCall } from './haveapi';
import type { ResourceRef } from './appTypes';
import type { User } from './users';

export interface MigrationPlan {
  id: number;
  state?: string;
  stop_on_error?: boolean;
  send_mail?: boolean;
  concurrency?: number;
  reason?: string;
  user?: User | ResourceRef;
  created_at?: string;
  finished_at?: string;
  [k: string]: unknown;
}

export interface VpsMigration {
  id: number;
  state?: string;
  transaction_chain?: ResourceRef;
  src_node?: ResourceRef;
  vps?: ResourceRef;
  dst_node?: ResourceRef;
  maintenance_window?: boolean;
  cleanup_data?: boolean;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  [k: string]: unknown;
}

// Migration plans (admin)

export async function fetchMigrationPlans(opts?: {
  limit?: number;
  fromId?: number;
  q?: string;
  state?: string;
  userId?: number;
}) {
  const params: Record<string, string | number | boolean> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.q) params['q'] = opts.q;
  if (opts?.state) params['state'] = opts.state;
  if (opts?.userId !== undefined) params['user'] = opts.userId;

  const res = await haveApiCall<MigrationPlan[]>({
    method: 'GET',
    path: '/migration_plans',
    namespace: 'migration_plan',
    params,
  });

  return { ...res, data: expectArray<MigrationPlan>(res.data, 'migration_plans') };
}

export async function fetchMigrationPlan(planId: number) {
  return haveApiCall<MigrationPlan>({
    method: 'GET',
    path: `/migration_plans/${planId}`,
  });
}

export async function createMigrationPlan(opts?: {
  stop_on_error?: boolean;
  send_mail?: boolean;
  concurrency?: number;
  reason?: string;
}) {
  return haveApiCall<MigrationPlan>({
    method: 'POST',
    path: `/migration_plans`,
    namespace: 'migration_plan',
    params: opts,
  });
}

export async function createMigrationPlanVpsMigration(
  planId: number,
  opts: {
    vps: number;
    dst_node: number;
    maintenance_window?: boolean;
    cleanup_data?: boolean;
  }
) {
  return haveApiCall<VpsMigration>({
    method: 'POST',
    path: `/migration_plans/${planId}/vps_migrations`,
    namespace: 'vps_migration',
    params: opts,
  });
}

export async function fetchMigrationPlanVpsMigrations(planId: number, opts?: { limit?: number; fromId?: number }) {
  const params: Record<string, string | number | boolean> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  const res = await haveApiCall<VpsMigration[]>({
    method: 'GET',
    path: `/migration_plans/${planId}/vps_migrations`,
    namespace: 'vps_migration',
    params,
  });

  return { ...res, data: expectArray<VpsMigration>(res.data, 'vps_migrations') };
}

export async function startMigrationPlan(planId: number) {
  return haveApiCall<MigrationPlan>({
    method: 'POST',
    path: `/migration_plans/${planId}/start`,
  });
}

export async function cancelMigrationPlan(planId: number) {
  return haveApiCall<MigrationPlan>({
    method: 'POST',
    path: `/migration_plans/${planId}/cancel`,
  });
}

export async function deleteMigrationPlan(planId: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/migration_plans/${planId}`,
  });
}
