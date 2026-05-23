import { expectArray, haveApiCall } from './haveapi';
import type { ResourceRef } from './appTypes';

export interface VpsFeature {
  id: number;
  vps?: ResourceRef;
  name: string;
  label?: string;
  enabled?: boolean;
  [k: string]: unknown;
}

export async function fetchVpsFeatures(vpsId: number) {
  const res = await haveApiCall<VpsFeature[]>({
    method: 'GET',
    path: `/vpses/${vpsId}/features`,
  });
  return { ...res, data: expectArray<VpsFeature>(res.data, `vpses/${vpsId}/features`) };
}

export async function updateVpsFeature(vpsId: number, featureId: number, enabled: boolean) {
  return haveApiCall<void>({
    method: 'PUT',
    path: `/vpses/${vpsId}/features/${featureId}`,
    namespace: 'feature',
    params: { enabled },
  });
}

export async function updateVpsFeaturesAll(vpsId: number, params: Record<string, boolean>) {
  return haveApiCall<void>({
    method: 'POST',
    path: `/vpses/${vpsId}/features/update_all`,
    namespace: 'feature',
    params,
  });
}
