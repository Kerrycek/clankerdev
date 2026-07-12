import { expectArray, haveApiCall } from './haveapi';

export interface NewsLog {
  id: number;
  message?: string;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export async function fetchNewsLogs(opts?: { since?: string }) {
  const params: Record<string, unknown> = {};
  if (opts?.since) params['since'] = opts.since;

  const res = await haveApiCall<NewsLog[]>({
    method: 'GET',
    path: '/news_logs',
    params,
  });

  return { ...res, data: expectArray<NewsLog>(res.data, 'news_logs#index') };
}

export async function createNewsLog(payload: { message: string; published_at?: string | null }) {
  const params: Record<string, unknown> = {
    message: payload.message,
  };

  if (payload.published_at) params['published_at'] = payload.published_at;

  return haveApiCall<NewsLog>({
    method: 'POST',
    path: '/news_logs',
    namespace: 'news_log',
    params,
  });
}

export async function updateNewsLog(id: number, payload: { message: string; published_at?: string | null }) {
  const params: Record<string, unknown> = {
    message: payload.message,
  };

  // Explicitly allow clearing published_at.
  if (payload.published_at !== undefined) params['published_at'] = payload.published_at;

  return haveApiCall<NewsLog>({
    method: 'PUT',
    path: `/news_logs/${id}`,
    namespace: 'news_log',
    params,
  });
}

export async function deleteNewsLog(id: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/news_logs/${id}`,
  });
}
