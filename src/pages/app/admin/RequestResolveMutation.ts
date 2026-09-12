import {
  fetchChangeRequest,
  fetchRegistrationRequest,
  resolveChangeRequest,
  resolveRegistrationRequest,
  type ResolveUserRequestAction,
} from '../../../lib/api/requests';
import { requestMatchesReviewTarget } from './RequestDetailModel';
import { safePositiveInteger } from './RequestReviewModel';
import type { RequestResolveOverrides, RequestReviewType } from './RequestReviewTypes';

export type TouchedRequestOverrides = ReadonlySet<keyof RequestResolveOverrides>;

const NUMERIC_OVERRIDE_KEYS = ['yearOfBirth', 'osTemplate', 'location', 'language'] as const;
export type NumericRequestOverrideKey = typeof NUMERIC_OVERRIDE_KEYS[number];

export class RequestReviewPreconditionError extends Error {
  public readonly reason: 'target_mismatch' | 'state_changed';

  constructor(reason: 'target_mismatch' | 'state_changed') {
    super(reason === 'target_mismatch' ? 'Request target mismatch' : 'Request is no longer awaiting review');
    this.name = 'RequestReviewPreconditionError';
    this.reason = reason;
  }
}

type ResolveOptions = {
  reason: string | undefined;
  overrides: RequestResolveOverrides;
  touchedOverrides: TouchedRequestOverrides;
  approveCreateVps: boolean;
  approveActivate: boolean;
  approveNode: string;
};

export function invalidNumericResolveOverrideKeys(
  action: ResolveUserRequestAction,
  overrides: RequestResolveOverrides,
  touched: TouchedRequestOverrides,
): ReadonlySet<NumericRequestOverrideKey> {
  return new Set(NUMERIC_OVERRIDE_KEYS.filter((key) => {
    if (action !== 'request_correction' && !touched.has(key)) return false;
    return safePositiveInteger(overrides[key]) === undefined;
  }));
}

export function hasInvalidNumericResolveOverride(
  action: ResolveUserRequestAction,
  overrides: RequestResolveOverrides,
  touched: TouchedRequestOverrides,
): boolean {
  return invalidNumericResolveOverrideKeys(action, overrides, touched).size > 0;
}

function includeString(
  action: ResolveUserRequestAction,
  touched: TouchedRequestOverrides,
  key: keyof RequestResolveOverrides,
  value: string,
): string | undefined {
  if (action === 'request_correction' || touched.has(key)) return value.trim();
  return undefined;
}

function includeNumeric(
  action: ResolveUserRequestAction,
  touched: TouchedRequestOverrides,
  key: keyof RequestResolveOverrides,
  value: string,
): number | undefined {
  if (action !== 'request_correction' && !touched.has(key)) return undefined;
  return safePositiveInteger(value);
}

export function registrationResolvePayload(action: ResolveUserRequestAction, options: ResolveOptions) {
  const p: Parameters<typeof resolveRegistrationRequest>[1] = { action, reason: options.reason };
  const strings = [
    ['login', 'login'],
    ['fullName', 'full_name'],
    ['orgName', 'org_name'],
    ['orgId', 'org_id'],
    ['email', 'email'],
    ['address', 'address'],
    ['how', 'how'],
    ['note', 'note'],
    ['currency', 'currency'],
    ['timeZone', 'time_zone'],
  ] as const;
  for (const [overrideKey, payloadKey] of strings) {
    const value = includeString(action, options.touchedOverrides, overrideKey, options.overrides[overrideKey]);
    if (value !== undefined) p[payloadKey] = value;
  }

  const yearOfBirth = includeNumeric(action, options.touchedOverrides, 'yearOfBirth', options.overrides.yearOfBirth);
  const osTemplate = includeNumeric(action, options.touchedOverrides, 'osTemplate', options.overrides.osTemplate);
  const location = includeNumeric(action, options.touchedOverrides, 'location', options.overrides.location);
  const language = includeNumeric(action, options.touchedOverrides, 'language', options.overrides.language);
  if (yearOfBirth) p.year_of_birth = yearOfBirth;
  if (osTemplate) p.os_template = osTemplate;
  if (location) p.location = location;
  if (language) p.language = language;

  if (action === 'approve') {
    p.create_vps = options.approveCreateVps;
    p.activate = options.approveActivate;
    if (options.approveCreateVps) {
      const nodeId = safePositiveInteger(options.approveNode);
      if (nodeId) p.node = nodeId;
    }
  }
  return p;
}

export function changeResolvePayload(action: ResolveUserRequestAction, options: ResolveOptions) {
  const p: Parameters<typeof resolveChangeRequest>[1] = { action, reason: options.reason };
  const strings = [
    ['fullName', 'full_name'],
    ['email', 'email'],
    ['address', 'address'],
    ['changeReason', 'change_reason'],
  ] as const;
  for (const [overrideKey, payloadKey] of strings) {
    const value = includeString(action, options.touchedOverrides, overrideKey, options.overrides[overrideKey]);
    if (value !== undefined) p[payloadKey] = value;
  }
  return p;
}

export async function resolveReviewedRequest(
  reqType: RequestReviewType,
  reqId: number,
  action: ResolveUserRequestAction,
  options: ResolveOptions,
) {
  return reqType === 'registration'
    ? await resolveRegistrationRequest(reqId, registrationResolvePayload(action, options))
    : await resolveChangeRequest(reqId, changeResolvePayload(action, options));
}

/**
 * Narrow the stale-review window immediately before Resolve. This is not an
 * atomic backend precondition, but it prevents a cached detail/list from
 * blindly resolving a request that has already changed state.
 */
export async function fetchAwaitingReviewTarget(reqType: RequestReviewType, reqId: number) {
  const loaded = reqType === 'registration'
    ? (await fetchRegistrationRequest(reqId)).data
    : (await fetchChangeRequest(reqId)).data;

  if (!requestMatchesReviewTarget(loaded, reqType, reqId)) {
    throw new RequestReviewPreconditionError('target_mismatch');
  }
  if (!requestMatchesReviewTarget(loaded, reqType, reqId, 'awaiting')) {
    throw new RequestReviewPreconditionError('state_changed');
  }
  return loaded;
}
