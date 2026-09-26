import { getRuntimeConfig } from '../../app/config';

import { HaveApiError, haveApiCall } from './haveapi';

export interface WebuiUserSetting {
  id?: number;
  namespace?: string;
  key?: string;
  value?: unknown;
  [k: string]: unknown;
}

const RESOURCE_NAMESPACE = 'webui_user_setting';
const DEFAULT_PATH = '/webui_user_settings';

function resourcePath(): string {
  const cfg = getRuntimeConfig();
  const configured = cfg.uiSettings.server.path;
  return configured.includes('webui_user_settings') ? configured : DEFAULT_PATH;
}

function parseStoredValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function pickSetting(data: unknown, namespace: string, key: string): WebuiUserSetting | undefined {
  if (Array.isArray(data)) {
    return data.find((row) => {
      if (!row || typeof row !== 'object') return false;
      const rec = row as WebuiUserSetting;
      return rec.namespace === namespace && rec.key === key;
    }) as WebuiUserSetting | undefined;
  }

  if (data && typeof data === 'object') {
    return data as WebuiUserSetting;
  }

  return undefined;
}

export async function fetchWebuiUserSetting(namespace: string, key: string): Promise<unknown | undefined> {
  const path = resourcePath();

  try {
    const res = await haveApiCall<unknown>({
      method: 'GET',
      path,
      namespace: RESOURCE_NAMESPACE,
      params: { namespace, key },
    });

    const setting = pickSetting(res.data, namespace, key);
    return setting && 'value' in setting ? parseStoredValue(setting.value) : undefined;
  } catch (error) {
    if (error instanceof HaveApiError && error.httpStatus === 404) return undefined;
    throw error;
  }
}

export async function saveWebuiUserSetting(namespace: string, key: string, value: unknown): Promise<void> {
  // Upstream Set is an upsert at /{namespace}/{key}; collection PUT/POST
  // are not routes and cannot persist preferences across sessions.
  await haveApiCall<unknown>({
    method: 'PUT',
    path: `${resourcePath().replace(/\/$/, '')}/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
    namespace: RESOURCE_NAMESPACE,
    params: { value: JSON.stringify(value) },
  });
}
