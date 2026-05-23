import { expectArray, haveApiCall } from './haveapi';
import type { User, Vps } from './app';
import type { Mailbox } from './mailer';

export interface IpAddressAssignment {
  id: number;
  ip_addr?: string;
  ip_prefix?: number;
  user?: User;
  vps?: Vps;
  from_date?: string;
  to_date?: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export interface IncidentReport {
  id: number;

  user?: User;
  vps?: Vps;
  ip_address_assignment?: IpAddressAssignment;
  filed_by?: User;
  mailbox?: Mailbox;

  subject?: string;
  text?: string;
  codename?: string;
  cpu_limit?: number;
  vps_action?: string;

  raw_user_id?: number;
  raw_vps_id?: number;

  detected_at?: string;
  created_at?: string;
  reported_at?: string;

  [k: string]: unknown;
}

export async function fetchIncidentReports(opts?: {
  limit?: number;
  fromId?: number;
  q?: string;
  userId?: number;
  vpsId?: number;
  ipAddressAssignmentId?: number;
  ipAddr?: string;
  mailboxId?: number;
  filedById?: number;
  codename?: string;
  includes?: string;
}) {
  const params: Record<string, unknown> = {};

  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;

  const q = opts?.q ? String(opts.q).trim() : '';
  if (q) params['q'] = q;

  if (opts?.userId !== undefined) params['user'] = opts.userId;
  if (opts?.vpsId !== undefined) params['vps'] = opts.vpsId;
  if (opts?.ipAddressAssignmentId !== undefined) params['ip_address_assignment'] = opts.ipAddressAssignmentId;

  const ip = opts?.ipAddr ? String(opts.ipAddr).trim() : '';
  if (ip) params['ip_addr'] = ip;

  if (opts?.mailboxId !== undefined) params['mailbox'] = opts.mailboxId;

  if (opts?.filedById !== undefined) params['filed_by'] = opts.filedById;

  const code = opts?.codename ? String(opts.codename).trim() : '';
  if (code) params['codename'] = code;

  const res = await haveApiCall<IncidentReport[]>({
    method: 'GET',
    path: '/incident_reports',
    namespace: 'incident_report',
    params,
    meta: opts?.includes ? { includes: opts.includes } : undefined,
  });

  return { ...res, data: expectArray<IncidentReport>(res.data, 'incident_reports#index') };
}

export async function fetchIncidentReport(incidentReportId: number, opts?: { includes?: string; signal?: AbortSignal }) {
  return haveApiCall<IncidentReport>({
    method: 'GET',
    path: `/incident_reports/${incidentReportId}`,
    meta: opts?.includes ? { includes: opts.includes } : undefined,
    signal: opts?.signal,
  });
}

export async function createIncidentReport(payload: {
  vpsId: number;
  subject: string;
  text: string;
  codename?: string;
  detectedAtIso?: string;
  ipAddressAssignmentId?: number;
  cpuLimit?: number;
  vpsAction?: string;
}) {
  const params: Record<string, unknown> = {
    vps: payload.vpsId,
    subject: payload.subject,
    text: payload.text,
  };

  if (payload.codename !== undefined) params['codename'] = payload.codename;
  if (payload.detectedAtIso !== undefined) params['detected_at'] = payload.detectedAtIso;
  if (payload.ipAddressAssignmentId !== undefined) params['ip_address_assignment'] = payload.ipAddressAssignmentId;
  if (payload.cpuLimit !== undefined) params['cpu_limit'] = payload.cpuLimit;
  if (payload.vpsAction !== undefined) params['vps_action'] = payload.vpsAction;

  return haveApiCall<IncidentReport>({
    method: 'POST',
    path: '/incident_reports',
    namespace: 'incident_report',
    params,
  });
}

export async function fetchIpAddressAssignments(opts?: {
  limit?: number;
  vpsId?: number;
  active?: boolean;
  includes?: string;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.vpsId !== undefined) params['vps'] = opts.vpsId;
  if (opts?.active !== undefined) params['active'] = opts.active;

  const res = await haveApiCall<IpAddressAssignment[]>({
    method: 'GET',
    path: '/ip_address_assignments',
    namespace: 'ip_address_assignment',
    params,
    meta: opts?.includes ? { includes: opts.includes } : undefined,
  });

  return { ...res, data: expectArray<IpAddressAssignment>(res.data, 'ip_address_assignments#index') };
}
