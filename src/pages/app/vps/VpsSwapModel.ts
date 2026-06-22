import type { Vps, VpsSwapWithPayload } from '../../../lib/api/vps';
import { datasetLabel, nodeLabel, ownerLabel, resourceId, resourceSummary, stateLabel, vpsLabel, vpsLocationId, vpsLocationLabel } from './VpsLifecycleModel';

export type SwapForm = {
  targetVps: number | null;
  hostname: boolean;
  resources: boolean;
  expirations: boolean;
  confirm: boolean;
};

export type SwapAfterPreview = {
  sourceHostnameAfter: string;
  targetHostnameAfter: string;
  sourceResourcesAfter: string;
  targetResourcesAfter: string;
  sourceDatasetAfter: string;
  targetDatasetAfter: string;
  sourceExpirationAfter: string;
  targetExpirationAfter: string;
};

export function defaultSwapForm(): SwapForm {
  return {
    targetVps: null,
    hostname: true,
    resources: true,
    expirations: true,
    confirm: false,
  };
}

export function looksLikeSwapCandidate(vps: Vps): boolean {
  const text = `${String(vps.hostname ?? '')} ${String(vps['label'] ?? '')} ${vpsLocationLabel(vps)} ${nodeLabel(vps)}`.toLowerCase();
  return /\b(playground|pgnd|staging|stage|test|testing|dev)\b/.test(text);
}

export function swapCandidateReasonKeys(candidate: Vps, source: Vps, sourceNodeId: number | null, sourceLocationId: number | null): string[] {
  const reasons: string[] = [];
  if (looksLikeSwapCandidate(candidate)) reasons.push('vps.lifecycle.swap.candidate.reason.environment');
  if (resourceId(candidate.user) === resourceId(source.user)) reasons.push('vps.lifecycle.swap.candidate.reason.owner');
  if (resourceId(candidate.node) === sourceNodeId) reasons.push('vps.lifecycle.swap.candidate.reason.node');
  if (vpsLocationId(candidate) === sourceLocationId) reasons.push('vps.lifecycle.swap.candidate.reason.location');
  if (String(candidate.object_state ?? 'active') === 'active') reasons.push('vps.lifecycle.swap.candidate.reason.active');
  return reasons;
}

export function rankSwapCandidate(candidate: Vps, source: Vps, sourceNodeId: number | null, sourceLocationId: number | null): number {
  let score = 0;
  if (looksLikeSwapCandidate(candidate)) score += 50;
  if (resourceId(candidate.node) === sourceNodeId) score += 20;
  if (vpsLocationId(candidate) === sourceLocationId) score += 16;
  if (resourceId(candidate.user) === resourceId(source.user)) score += 10;
  if (String(candidate.object_state ?? 'active') === 'active') score += 4;
  return score;
}

export function buildVpsSwapPayload(form: SwapForm, isAdminMode: boolean): VpsSwapWithPayload {
  if (!form.targetVps) throw new Error('required-id');

  const payload: VpsSwapWithPayload = { vps: form.targetVps };
  if (isAdminMode) {
    payload.hostname = form.hostname;
    payload.resources = form.resources;
    payload.expirations = form.expirations;
  }
  return payload;
}

export function isSameSwapTarget(sourceVpsId: number, targetVpsId: number | null): boolean {
  return targetVpsId !== null && targetVpsId === sourceVpsId;
}

export function buildSwapAfterPreview(props: {
  source: Vps;
  target: Vps | undefined;
  form: SwapForm;
  sourceId: number;
  isAdminMode: boolean;
  targetLabel: string;
  formatDateTime: (value: string | undefined | null) => string;
}): SwapAfterPreview {
  const { source, target, form, isAdminMode, sourceId, targetLabel, formatDateTime } = props;
  return {
    sourceHostnameAfter: isAdminMode && !form.hostname ? vpsLabel(source, sourceId) : targetLabel,
    targetHostnameAfter: isAdminMode && !form.hostname ? targetLabel : vpsLabel(source, sourceId),
    sourceResourcesAfter: isAdminMode && !form.resources ? resourceSummary(source) : resourceSummary(target),
    targetResourcesAfter: isAdminMode && !form.resources ? resourceSummary(target) : resourceSummary(source),
    sourceDatasetAfter: target ? datasetLabel(target) : '—',
    targetDatasetAfter: datasetLabel(source),
    sourceExpirationAfter: isAdminMode && !form.expirations ? formatDateTime(source.expiration_date) : formatDateTime(target?.expiration_date),
    targetExpirationAfter: isAdminMode && !form.expirations ? formatDateTime(target?.expiration_date) : formatDateTime(source.expiration_date),
  };
}

export function swapTargetFit(props: {
  source: Vps;
  target: Vps | undefined;
  ownerId: number | null;
  locationId: number | null;
}): { likely: boolean; sameOwner: boolean; sameLocation: boolean; ownerLabel: string; targetLabel: string; stateLabel: string } {
  const { source, target, ownerId, locationId } = props;
  const targetOwnerId = target ? resourceId(target.user) : null;
  const targetLocationId = target ? vpsLocationId(target) : null;
  return {
    likely: Boolean(target && looksLikeSwapCandidate(target)),
    sameOwner: targetOwnerId !== null && ownerId !== null && targetOwnerId === ownerId,
    sameLocation: targetLocationId !== null && locationId !== null && targetLocationId === locationId,
    ownerLabel: target ? ownerLabel(target) : ownerLabel(source),
    targetLabel: target ? vpsLabel(target, target.id) : '—',
    stateLabel: stateLabel(target),
  };
}
