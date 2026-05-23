import { expectArray, haveApiCall } from './haveapi';

export interface ActionState {
  id: number;
  label?: string;
  finished?: boolean;
  status?: boolean; // true = proceeding, false = failing
  current?: number;
  total?: number;
  unit?: string;
  can_cancel?: boolean;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export async function fetchActionStates(opts?: { limit?: number; fromId?: number; order?: 'newest' | 'oldest' }) {
  const params: Record<string, string | number | boolean> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.order) params['order'] = opts.order;

  const res = await haveApiCall<ActionState[]>({
    method: 'GET',
    path: '/action_states',
    namespace: 'action_state',
    params,
  });

  return { ...res, data: expectArray<ActionState>(res.data, 'action_states') };
}

export async function fetchActionState(actionStateId: number) {
  return haveApiCall<ActionState>({
    method: 'GET',
    path: `/action_states/${actionStateId}`,
  });
}

export async function pollActionState(
  actionStateId: number,
  opts?: { timeout?: number; updateIn?: number; status?: boolean; current?: number; total?: number }
) {
  const params: Record<string, string | number | boolean> = {};
  if (opts?.timeout !== undefined) params['timeout'] = opts.timeout;
  if (opts?.updateIn !== undefined) params['update_in'] = opts.updateIn;
  if (opts?.status !== undefined) params['status'] = opts.status;
  if (opts?.current !== undefined) params['current'] = opts.current;
  if (opts?.total !== undefined) params['total'] = opts.total;

  return haveApiCall<ActionState>({
    method: 'GET',
    path: `/action_states/${actionStateId}/poll`,
    namespace: 'action_state',
    params,
  });
}

export async function cancelActionState(actionStateId: number) {
  return haveApiCall<void>({
    method: 'POST',
    path: `/action_states/${actionStateId}/cancel`,
  });
}
