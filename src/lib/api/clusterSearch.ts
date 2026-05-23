import { expectArray, haveApiCall } from './haveapi';

/**
 * Result row returned by `Cluster.Search`.
 *
 * The exact payload varies slightly across deployments. We keep the type
 * tolerant and rely on runtime guards in the UI.
 */
export interface ClusterSearchHit {
  resource?: string;
  id?: number;
  value?: string;
  attribute?: string;
  label?: string;
  [k: string]: unknown;
}

export async function clusterSearch(opts: { query: string; signal?: AbortSignal }) {
  const q = String(opts.query ?? '').trim();
  if (!q) {
    return {
      data: [] as ClusterSearchHit[],
      envelope: { status: true, response: null },
    };
  }

  const res = await haveApiCall<ClusterSearchHit[]>({
    // Legacy WebUI uses POST with payload {cluster:{value}}.
    // Keep the SPA aligned with the canonical HaveAPI contract.
    method: 'POST',
    path: '/cluster/search',
    namespace: 'cluster',
    params: { value: q },
    signal: opts.signal,
  });

  return { ...res, data: expectArray<ClusterSearchHit>(res.data, 'cluster.search') };
}
