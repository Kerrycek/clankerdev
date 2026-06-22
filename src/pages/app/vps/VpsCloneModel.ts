import type { Location } from '../../../lib/api/infra';
import type { Vps, VpsClonePayload } from '../../../lib/api/vps';
import { locationEnvironmentId, locationLabel, parseRequiredId, vpsHostname } from './VpsLifecycleModel';

export type CloneForm = {
  user: string;
  node: string;
  location: string;
  hostname: string;
  subdatasets: boolean;
  datasetPlans: boolean;
  resources: boolean;
  features: boolean;
  stop: boolean;
  confirm: boolean;
};

export type ClonePayloadContext = {
  isAdminMode: boolean;
  location?: Location;
};

export function defaultCloneForm(vps: Pick<Vps, 'id' | 'hostname'>, opts: { ownerId: number | null; nodeId: number | null; locationId: number | null }): CloneForm {
  return {
    user: opts.ownerId ? String(opts.ownerId) : '',
    node: opts.nodeId ? String(opts.nodeId) : '',
    location: opts.locationId ? String(opts.locationId) : '',
    hostname: `${vpsHostname(vps)}-${vps.id}-clone`,
    subdatasets: true,
    datasetPlans: true,
    resources: true,
    features: true,
    stop: true,
    confirm: false,
  };
}

export function isCloneTargetReady(form: Pick<CloneForm, 'user' | 'node' | 'location'>, isAdminMode: boolean): boolean {
  return isAdminMode ? Boolean(form.user.trim() && form.node.trim()) : Boolean(form.location.trim());
}

export function buildVpsClonePayload(form: CloneForm, context: ClonePayloadContext): VpsClonePayload {
  const payload: VpsClonePayload = {
    hostname: form.hostname.trim() || undefined,
    subdatasets: form.subdatasets,
    dataset_plans: form.datasetPlans,
    resources: form.resources,
    features: form.features,
    stop: form.stop,
  };

  if (context.isAdminMode) {
    payload.user = parseRequiredId(form.user);
    payload.node = parseRequiredId(form.node);
  } else {
    payload.location = parseRequiredId(form.location);
    const environment = locationEnvironmentId(context.location);
    if (environment !== undefined) payload.environment = environment;
  }

  return payload;
}

export function cloneTargetDescription(form: CloneForm, context: ClonePayloadContext): { owner?: string; node?: string; location?: string; environment?: string } {
  if (context.isAdminMode) {
    return {
      owner: form.user.trim() || '—',
      node: form.node.trim() || '—',
    };
  }

  const environment = locationEnvironmentId(context.location);
  return {
    location: context.location ? locationLabel(context.location) : form.location.trim() || '—',
    environment: environment !== undefined ? `#${environment}` : '—',
  };
}

export function cloneCopiedOptionKeys(form: CloneForm): string[] {
  const keys: string[] = [];
  if (form.subdatasets) keys.push('vps.lifecycle.clone.option.subdatasets');
  if (form.datasetPlans) keys.push('vps.lifecycle.clone.option.dataset_plans');
  if (form.resources) keys.push('vps.lifecycle.clone.option.resources');
  if (form.features) keys.push('vps.lifecycle.clone.option.features');
  return keys;
}
