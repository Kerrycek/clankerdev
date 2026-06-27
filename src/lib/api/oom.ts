import { expectArray, haveApiCall } from './haveapi';
import type { Vps } from './app';

// Re-export shared infra types/helpers to avoid duplication.
export { fetchEnvironments, fetchLocations, type Environment, type Location } from './infra';

// NOTE: Environment/Location live in ./infra.

export interface OomReportRule {
  id: number;
  vps?: Vps;
  action?: 'notify' | 'ignore' | string;
  cgroup_pattern?: string;
  hit_count?: number;
  label?: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export interface OomReport {
  id: number;
  vps?: Vps;
  cgroup?: string;
  oom_report_rule?: OomReportRule;

  invoked_by_pid?: number;
  invoked_by_name?: string;

  killed_pid?: number;
  killed_name?: string;

  count?: number;
  created_at?: string;
  reported_at?: string;
  [k: string]: unknown;
}

export interface OomReportUsage {
  id: number;
  memtype?: string;
  usage?: number;
  limit?: number;
  failcnt?: number;
  [k: string]: unknown;
}

export interface OomReportStat {
  id: number;
  parameter?: string;
  value?: number;
  [k: string]: unknown;
}

export interface OomReportTask {
  id: number;
  name?: string;
  host_pid?: number;
  vps_pid?: number;
  vps_uid?: number;
  tgid?: number;
  total_vm?: number;
  rss?: number;
  rss_anon?: number;
  rss_file?: number;
  rss_shmem?: number;
  pgtables_bytes?: number;
  swapents?: number;
  oom_score_adj?: number;
  [k: string]: unknown;
}

// fetchEnvironments/fetchLocations re-exported from ./infra.

export async function fetchOomReports(opts?: {
  limit?: number;
  fromId?: number;
  q?: string;
  vpsId?: number;
  userId?: number;
  nodeId?: number;
  locationId?: number;
  environmentId?: number;
  ruleId?: number;
  cgroup?: string;
  sinceIso?: string;
  untilIso?: string;
  includes?: string;
}) {
  const params: Record<string, unknown> = {};

  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  const q = opts?.q ? String(opts.q).trim() : '';
  if (q) params['q'] = q;

  if (opts?.vpsId !== undefined) params['vps'] = opts.vpsId;
  // Legacy oom_report#index rejects user; list pages keep owner filtering current-page only.
  void opts?.userId;
  if (opts?.nodeId !== undefined) params['node'] = opts.nodeId;
  if (opts?.locationId !== undefined) params['location'] = opts.locationId;
  if (opts?.environmentId !== undefined) params['environment'] = opts.environmentId;
  if (opts?.ruleId !== undefined) params['oom_report_rule'] = opts.ruleId;

  const cg = opts?.cgroup ? String(opts.cgroup).trim() : '';
  if (cg) params['cgroup'] = cg;

  if (opts?.sinceIso) params['since'] = opts.sinceIso;
  if (opts?.untilIso) params['until'] = opts.untilIso;

  const res = await haveApiCall<OomReport[]>({
    method: 'GET',
    path: '/oom_reports',
    namespace: 'oom_report',
    params,
    meta: opts?.includes ? { includes: opts.includes } : undefined,
  });

  return { ...res, data: expectArray<OomReport>(res.data, 'oom_reports#index') };
}

export async function fetchOomReport(oomReportId: number, opts?: { includes?: string; signal?: AbortSignal }) {
  return haveApiCall<OomReport>({
    method: 'GET',
    path: `/oom_reports/${oomReportId}`,
    meta: opts?.includes ? { includes: opts.includes } : undefined,
    signal: opts?.signal,
  });
}

export async function fetchOomReportUsages(oomReportId: number, opts?: { limit?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;

  const res = await haveApiCall<OomReportUsage[]>({
    method: 'GET',
    path: `/oom_reports/${oomReportId}/usages`,
    namespace: 'usage',
    params,
  });

  return { ...res, data: expectArray<OomReportUsage>(res.data, `oom_reports/${oomReportId}/usages#index`) };
}

export async function fetchOomReportStats(oomReportId: number, opts?: { limit?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;

  const res = await haveApiCall<OomReportStat[]>({
    method: 'GET',
    path: `/oom_reports/${oomReportId}/stats`,
    namespace: 'stat',
    params,
  });

  return { ...res, data: expectArray<OomReportStat>(res.data, `oom_reports/${oomReportId}/stats#index`) };
}

export async function fetchOomReportTasks(oomReportId: number, opts?: { limit?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;

  const res = await haveApiCall<OomReportTask[]>({
    method: 'GET',
    path: `/oom_reports/${oomReportId}/tasks`,
    namespace: 'task',
    params,
  });

  return { ...res, data: expectArray<OomReportTask>(res.data, `oom_reports/${oomReportId}/tasks#index`) };
}

export async function fetchOomReportRules(opts: { vpsId: number; limit?: number }) {
  const params: Record<string, unknown> = { vps: opts.vpsId };
  if (opts.limit !== undefined) params['limit'] = opts.limit;

  const res = await haveApiCall<OomReportRule[]>({
    method: 'GET',
    path: '/oom_report_rules',
    namespace: 'oom_report_rule',
    params,
  });

  return { ...res, data: expectArray<OomReportRule>(res.data, 'oom_report_rules#index') };
}

export async function createOomReportRule(payload: {
  vpsId: number;
  action: 'notify' | 'ignore' | string;
  cgroupPattern: string;
}) {
  return haveApiCall<OomReportRule>({
    method: 'POST',
    path: '/oom_report_rules',
    namespace: 'oom_report_rule',
    params: {
      vps: payload.vpsId,
      action: payload.action,
      cgroup_pattern: payload.cgroupPattern,
    },
  });
}

export async function updateOomReportRule(ruleId: number, payload: { action: 'notify' | 'ignore' | string; cgroupPattern: string }) {
  return haveApiCall<OomReportRule>({
    method: 'PUT',
    path: `/oom_report_rules/${ruleId}`,
    namespace: 'oom_report_rule',
    params: {
      action: payload.action,
      cgroup_pattern: payload.cgroupPattern,
    },
  });
}

export async function deleteOomReportRule(ruleId: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/oom_report_rules/${ruleId}`,
    namespace: 'oom_report_rule',
  });
}
