import { expectArray, haveApiCall } from './haveapi';

export interface SystemConfigItem {
  category: string;
  name: string;
  type?: string;
  value?: unknown;
  label?: string;
  description?: string;
  min_user_level?: number;
  [k: string]: unknown;
}

export async function fetchSystemConfigs() {
  const res = await haveApiCall<SystemConfigItem[]>({
    method: 'GET',
    path: '/system_configs',
    namespace: 'system_config',
    params: {},
  });

  return { ...res, data: expectArray<SystemConfigItem>(res.data, 'system_configs#index') };
}

export async function updateSystemConfig(opts: { category: string; name: string; value: unknown }) {
  const category = String(opts.category).trim();
  const name = String(opts.name).trim();

  const res = await haveApiCall<SystemConfigItem>({
    method: 'PUT',
    path: `/system_configs/${encodeURIComponent(category)}/${encodeURIComponent(name)}`,
    namespace: 'system_config',
    params: { value: opts.value },
  });

  return res;
}
