import { expectArray, haveApiCall } from './haveapi';

export interface Language {
  id: number;
  code?: string;
  label?: string;
  [k: string]: unknown;
}

export async function fetchLanguages(opts?: { limit?: number; fromId?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  const res = await haveApiCall<Language[]>({
    method: 'GET',
    path: '/languages',
    namespace: 'language',
    params,
  });

  return { ...res, data: expectArray<Language>(res.data, 'languages#index') };
}
