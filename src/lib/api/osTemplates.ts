import { expectArray, haveApiCall } from './haveapi';

export interface OsFamily {
  id: number;
  label?: string;
  description?: string;
  [k: string]: unknown;
}

export interface OsTemplate {
  id: number;
  os_family?: OsFamily | { id: number };
  name?: string;
  label?: string;
  info?: string;
  enabled?: boolean;
  supported?: boolean;
  order?: number;

  hypervisor_type?: string;
  cgroup_version?: string;

  manage_hostname?: boolean;
  manage_dns_resolver?: boolean;
  enable_script?: boolean;
  enable_cloud_init?: boolean;

  vendor?: string;
  variant?: string;
  arch?: string;
  distribution?: string;
  version?: string;

  config?: string;

  uses_count?: number;

  [k: string]: unknown;
}

export async function fetchOsFamilies(opts?: { limit?: number }) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;

  const res = await haveApiCall<OsFamily[]>({
    method: 'GET',
    path: '/os_families',
    namespace: 'os_family',
    params,
  });

  return { ...res, data: expectArray<OsFamily>(res.data, 'os_families#index') };
}

export async function fetchOsTemplates(opts?: {
  limit?: number;

  q?: string;
  osFamily?: number;
  enabled?: boolean;
  supported?: boolean;
  hypervisorType?: string;
  cgroupVersion?: string;
  enableScript?: boolean;
  enableCloudInit?: boolean;
}) {
  const params: Record<string, unknown> = {};

  if (opts?.limit !== undefined) params['limit'] = opts.limit;

  if (opts?.q) params['q'] = opts.q;
  if (opts?.osFamily !== undefined) params['os_family'] = opts.osFamily;
  if (opts?.enabled !== undefined) params['enabled'] = opts.enabled;
  if (opts?.supported !== undefined) params['supported'] = opts.supported;
  if (opts?.hypervisorType) params['hypervisor_type'] = opts.hypervisorType;
  if (opts?.cgroupVersion) params['cgroup_version'] = opts.cgroupVersion;
  if (opts?.enableScript !== undefined) params['enable_script'] = opts.enableScript;
  if (opts?.enableCloudInit !== undefined) params['enable_cloud_init'] = opts.enableCloudInit;

  const res = await haveApiCall<OsTemplate[]>({
    method: 'GET',
    path: '/os_templates',
    namespace: 'os_template',
    params,
  });

  return { ...res, data: expectArray<OsTemplate>(res.data, 'os_templates#index') };
}

export async function createOsTemplate(payload: Record<string, unknown>) {
  return haveApiCall<OsTemplate>({
    method: 'POST',
    path: '/os_templates',
    namespace: 'os_template',
    params: payload,
  });
}

export async function updateOsTemplate(osTemplateId: number, payload: Record<string, unknown>) {
  return haveApiCall<OsTemplate>({
    method: 'PUT',
    path: `/os_templates/${osTemplateId}`,
    namespace: 'os_template',
    params: payload,
  });
}

export async function deleteOsTemplate(osTemplateId: number) {
  return haveApiCall<void>({
    method: 'DELETE',
    path: `/os_templates/${osTemplateId}`,
  });
}
