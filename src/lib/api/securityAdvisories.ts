import type { ResourceRef } from './appTypes';
import { expectArray, haveApiCall } from './haveapi';

export type SecurityAdvisoryState = 'draft' | 'published' | 'retracted' | string;

export interface SecurityAdvisoryCve {
  id: number;
  security_advisory?: ResourceRef | number;
  security_advisory_id?: number;
  cve_id?: string;
  url?: string;
  [k: string]: unknown;
}

export interface SecurityAdvisory {
  id: number;
  state?: SecurityAdvisoryState;
  name?: string | null;
  published_at?: string | null;
  retracted_at?: string | null;
  created_at?: string;
  updated_at?: string;
  affected?: boolean;
  affected_node_count?: number;
  affected_user_count?: number;
  affected_vps_count?: number;
  created_by?: ResourceRef | null;
  published_by?: ResourceRef | null;
  /** Populated by fetchSecurityAdvisoriesWithCves(). */
  cves?: Array<SecurityAdvisoryCve | string>;
  /** Tolerated shape in case a deployment includes CVEs inline. */
  security_advisory_cves?: Array<SecurityAdvisoryCve | string>;
  // translation fields: e.g. en_summary, cs_description, en_response, ...
  [k: string]: unknown;
}

export interface SecurityAdvisoryFilters {
  limit?: number;
  fromId?: number;
  state?: string;
  affected?: boolean;
  cve?: string;
  recentSince?: string;
  userId?: number;
  vpsId?: number;
  nodeId?: number;
  since?: string;
  order?: 'newest' | 'oldest';
  includes?: string;
}

function securityAdvisoryParams(opts?: SecurityAdvisoryFilters): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.state) params['state'] = opts.state;
  if (opts?.affected !== undefined) params['affected'] = opts.affected;
  if (opts?.cve) params['cve'] = opts.cve;
  if (opts?.recentSince) params['recent_since'] = opts.recentSince;
  if (opts?.userId !== undefined) params['user'] = opts.userId;
  if (opts?.vpsId !== undefined) params['vps'] = opts.vpsId;
  if (opts?.nodeId !== undefined) params['node'] = opts.nodeId;
  if (opts?.since) params['since'] = opts.since;
  if (opts?.order) params['order'] = opts.order;
  return params;
}

export async function fetchSecurityAdvisories(opts?: SecurityAdvisoryFilters) {
  const res = await haveApiCall<SecurityAdvisory[]>({
    method: 'GET',
    path: '/security_advisories',
    namespace: 'security_advisory',
    params: securityAdvisoryParams(opts),
    meta: opts?.includes ? { includes: opts.includes } : undefined,
  });

  return { ...res, data: expectArray<SecurityAdvisory>(res.data, 'security_advisories#index') };
}

export async function fetchSecurityAdvisoryCves(opts?: { securityAdvisoryId?: number; cve?: string }) {
  const params: Record<string, unknown> = {};
  if (opts?.securityAdvisoryId !== undefined) params['security_advisory'] = opts.securityAdvisoryId;
  if (opts?.cve) params['cve'] = opts.cve;

  const res = await haveApiCall<SecurityAdvisoryCve[]>({
    method: 'GET',
    path: '/security_advisory_cves',
    namespace: 'security_advisory_cve',
    params,
  });

  return { ...res, data: expectArray<SecurityAdvisoryCve>(res.data, 'security_advisory_cves#index') };
}

export async function fetchSecurityAdvisoriesWithCves(opts?: SecurityAdvisoryFilters) {
  const advisories = await fetchSecurityAdvisories(opts);

  const cveLists = await Promise.all(
    advisories.data.map(async (advisory) => {
      if (advisory.security_advisory_cves || advisory.cves) {
        return advisoryCveObjects(advisory);
      }

      try {
        const cves = await fetchSecurityAdvisoryCves({ securityAdvisoryId: advisory.id });
        return cves.data;
      } catch {
        // Keep the dashboard useful even if the older API does not expose CVE joins
        // to the current session; the advisory itself is still important signal.
        return [];
      }
    })
  );

  return {
    ...advisories,
    data: advisories.data.map((advisory, idx) => ({
      ...advisory,
      cves: cveLists[idx] ?? [],
    })),
  };
}

function cveLabel(item: unknown): string | null {
  if (typeof item === 'string') {
    const s = item.trim().toUpperCase();
    return s || null;
  }

  if (!item || typeof item !== 'object') return null;
  const obj = item as Record<string, unknown>;
  const nested = obj['cve'];
  if (nested && typeof nested === 'object') {
    const nestedLabel = cveLabel(nested);
    if (nestedLabel) return nestedLabel;
  }

  const raw = obj['cve_id'] ?? obj['cveId'] ?? obj['name'] ?? obj['label'];
  if (typeof raw === 'string') {
    const s = raw.trim().toUpperCase();
    return s || null;
  }

  return null;
}

function advisoryCveObjects(advisory: SecurityAdvisory): SecurityAdvisoryCve[] {
  const raw = advisory.security_advisory_cves ?? advisory.cves ?? [];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (typeof item === 'string') {
        return { id: 0, cve_id: item.trim().toUpperCase() } satisfies SecurityAdvisoryCve;
      }
      return item && typeof item === 'object' ? (item as SecurityAdvisoryCve) : null;
    })
    .filter((item): item is SecurityAdvisoryCve => item !== null);
}

export function advisoryCveLabels(advisory: SecurityAdvisory): string[] {
  const labels = advisoryCveObjects(advisory).map(cveLabel).filter((v): v is string => Boolean(v));
  return [...new Set(labels)].sort((a, b) => a.localeCompare(b));
}
