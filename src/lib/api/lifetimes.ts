import { expectArray, haveApiCall } from './haveapi';
import type { ResourceRef } from './app';

export interface StateLog {
  id: number;
  state?: string;
  expiration_date?: string | null;
  remind_after_date?: string | null;
  /** API label: "Changed at" (created_at timestamp of the log entry). */
  created_at?: string;
  user?: ResourceRef;
  reason?: string;
  [k: string]: unknown;
}

export async function fetchVpsStateLogs(vpsId: number, opts?: { limit?: number; offset?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.offset !== undefined) params['offset'] = opts.offset;

  const res = await haveApiCall<StateLog[]>({
    method: 'GET',
    path: `/vpses/${vpsId}/state_logs`,
    namespace: 'state_log',
    params,
    meta: { includes: 'user' },
  });

  return { ...res, data: expectArray<StateLog>(res.data, `vpses/${vpsId}/state_logs#index`) };
}

export async function fetchUserStateLogs(userId: number, opts?: { limit?: number; offset?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.offset !== undefined) params['offset'] = opts.offset;

  const res = await haveApiCall<StateLog[]>({
    method: 'GET',
    path: `/users/${userId}/state_logs`,
    namespace: 'state_log',
    params,
    meta: { includes: 'user' },
  });

  return { ...res, data: expectArray<StateLog>(res.data, `users/${userId}/state_logs#index`) };
}
