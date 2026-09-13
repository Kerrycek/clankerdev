import type { ResolveUserRequestAction } from '../../../lib/api/requests';

import type {
  RequestResolveOverrides,
  RequestReviewType,
  ReviewableRequest,
} from './RequestReviewTypes';

export function safePositiveInteger(value: string | undefined): number | undefined {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return undefined;
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number <= 0) return undefined;
  return number;
}

export function resourceId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return resourceId(record['id'] ?? record['value']);
  }
  return null;
}

function cgroupVersion(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === '1' || normalized === 'v1') return 'cgroup_v1';
  if (normalized === '2' || normalized === 'v2') return 'cgroup_v2';
  if (normalized === 'any') return 'cgroup_any';
  if (normalized === 'cgroup_v1' || normalized === 'cgroup_v2' || normalized === 'cgroup_any') return normalized;
  return null;
}

/** Explicit placement is offered only when client-visible metadata proves compatibility. */
export function requestNodeSupportsTemplate(node: unknown, template: unknown): boolean {
  if (!node || typeof node !== 'object' || !template || typeof template !== 'object') return false;
  const templateRecord = template as Record<string, unknown>;
  if (templateRecord['enabled'] === false || templateRecord['supported'] === false) return false;
  const nodeVersion = cgroupVersion((node as Record<string, unknown>)['cgroup_version']);
  const templateVersion = cgroupVersion(templateRecord['cgroup_version']);
  if (!templateVersion) return false;
  if (templateVersion === 'cgroup_any') return nodeVersion === 'cgroup_v1' || nodeVersion === 'cgroup_v2';
  return nodeVersion === templateVersion;
}

export function firstResourceId(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): number | null {
  if (!source) return null;
  for (const key of keys) {
    const id = resourceId(source[key]);
    if (id) return id;
  }
  return null;
}

export function requestOperationalLinks(request: ReviewableRequest | undefined) {
  return {
    actionStateId: firstResourceId(request, [
      'action_state',
      'action_state_id',
      'resolve_action_state',
      'resolve_action_state_id',
    ]),
    transactionChainId: firstResourceId(request, [
      'transaction_chain',
      'transaction_chain_id',
      'resolve_transaction_chain',
      'resolve_transaction_chain_id',
    ]),
    transactionId: firstResourceId(request, [
      'transaction',
      'transaction_id',
      'resolve_transaction',
      'resolve_transaction_id',
    ]),
  };
}

export function requestReviewActions(
  reqType: RequestReviewType,
  request: ReviewableRequest | undefined,
  isAdmin: boolean,
): ResolveUserRequestAction[] {
  if (!isAdmin || !request) return [];
  const state = String(request.state ?? '').trim();
  if (state !== 'awaiting') return [];

  const actions: ResolveUserRequestAction[] = ['approve', 'deny', 'ignore'];
  if (reqType === 'registration') {
    actions.push('request_correction');
  }
  return actions;
}

export function requestActionVariant(
  action: ResolveUserRequestAction,
): 'primary' | 'secondary' | 'danger' {
  if (action === 'approve') return 'primary';
  if (action === 'deny' || action === 'ignore') return 'danger';
  return 'secondary';
}

export function requestActionNeedsReason(action: ResolveUserRequestAction): boolean {
  return action === 'deny' || action === 'request_correction';
}

function stringField(request: ReviewableRequest, key: string): string {
  const value = request[key];
  return typeof value === 'string' ? value : '';
}

export function emptyRequestOverrides(): RequestResolveOverrides {
  return {
    login: '',
    fullName: '',
    orgName: '',
    orgId: '',
    email: '',
    address: '',
    yearOfBirth: '',
    how: '',
    note: '',
    osTemplate: '',
    location: '',
    currency: '',
    language: '',
    timeZone: '',
    changeReason: '',
  };
}

export function requestOverrides(
  reqType: RequestReviewType,
  request: ReviewableRequest,
): RequestResolveOverrides {
  if (reqType === 'registration') {
    return {
      login: stringField(request, 'login'),
      fullName: stringField(request, 'full_name'),
      orgName: stringField(request, 'org_name'),
      orgId: stringField(request, 'org_id'),
      email: stringField(request, 'email'),
      address: stringField(request, 'address'),
      yearOfBirth: request.year_of_birth != null ? String(request.year_of_birth) : '',
      how: stringField(request, 'how'),
      note: stringField(request, 'note'),
      osTemplate: resourceId(request.os_template) != null ? String(resourceId(request.os_template)) : '',
      location: resourceId(request.location) != null ? String(resourceId(request.location)) : '',
      currency: stringField(request, 'currency'),
      language: resourceId(request.language) != null ? String(resourceId(request.language)) : '',
      timeZone: stringField(request, 'time_zone'),
      changeReason: '',
    };
  }

  return {
    login: '',
    fullName: stringField(request, 'full_name'),
    orgName: '',
    orgId: '',
    email: stringField(request, 'email'),
    address: stringField(request, 'address'),
    yearOfBirth: '',
    how: '',
    note: '',
    osTemplate: '',
    location: '',
    currency: '',
    language: '',
    timeZone: '',
    changeReason: stringField(request, 'change_reason'),
  };
}
