import { HaveApiError } from '../../../lib/api/haveapi';

export type FraudCheckStatus = 'pending' | 'failed' | 'success';
export type InferredRequestType = 'registration' | 'change';
export type RequestReviewQueueTarget = { type: InferredRequestType; id: number };

const RESOLVED_REQUEST_STATES = new Set(['approved', 'denied', 'ignored', 'pending_correction']);

export function parseRequestReviewQueue(value: unknown): RequestReviewQueueTarget[] {
  if (!Array.isArray(value)) return [];
  const targets: RequestReviewQueueTarget[] = [];
  const seen = new Set<string>();

  for (const candidate of value.slice(0, 200)) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    const type = record['type'];
    const rawId = record['id'];
    if (type !== 'registration' && type !== 'change') continue;
    if (typeof rawId !== 'number' && !(typeof rawId === 'string' && /^\d+$/.test(rawId.trim()))) continue;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    const key = `${type}-${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ type, id });
  }

  return targets;
}

export function requestReviewQueueAfter(
  queue: RequestReviewQueueTarget[],
  selected: RequestReviewQueueTarget,
): RequestReviewQueueTarget[] | null {
  const selectedIndex = queue.findIndex((target) => (
    target.type === selected.type && target.id === selected.id
  ));
  if (selectedIndex < 0) return null;
  return [...queue.slice(selectedIndex + 1), ...queue.slice(0, selectedIndex)];
}

export function inferRequestReviewType(value: unknown): InferredRequestType | null {
  if (!value || typeof value !== 'object') return null;
  const request = value as Record<string, unknown>;
  if (request['type'] === 'registration' || request['_type'] === 'registration') return 'registration';
  if (request['type'] === 'change' || request['_type'] === 'change') return 'change';

  const hasValue = (candidate: unknown) => {
    if (typeof candidate === 'string') return Boolean(candidate.trim());
    if (typeof candidate === 'number') return Number.isFinite(candidate);
    return Boolean(candidate && typeof candidate === 'object');
  };
  const hasChangeShape = hasValue(request['change_reason']);
  const hasRegistrationShape = [
    'login',
    'year_of_birth',
    'os_template',
    'location',
    'ip_fraud_score',
    'mail_fraud_score',
  ].some((key) => hasValue(request[key]));

  if (hasChangeShape === hasRegistrationShape) return null;
  return hasChangeShape ? 'change' : 'registration';
}

function requestTargetId(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as Record<string, unknown>)['id'];
  if (typeof raw !== 'number' && !(typeof raw === 'string' && /^\d+$/.test(raw.trim()))) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Typed Show endpoints share one STI base model and cannot be trusted to prove
 * either the target id or subtype. Keep every review surface fail-closed.
 */
export function requestMatchesReviewTarget(
  value: unknown,
  expectedType: InferredRequestType,
  expectedId: number,
  expectedState?: string,
): boolean {
  if (!Number.isSafeInteger(expectedId) || expectedId <= 0) return false;
  if (requestTargetId(value) !== expectedId || inferRequestReviewType(value) !== expectedType) return false;
  if (expectedState === undefined) return true;
  return String((value as Record<string, unknown>)['state'] ?? '').trim() === expectedState;
}

export function isResolvedRequestReviewState(value: unknown): boolean {
  return RESOLVED_REQUEST_STATES.has(String(value ?? '').trim());
}

/**
 * HaveAPI installations do not always preserve a 404 transport status and can
 * return `status: false` in an HTTP 200 envelope instead. Treat only an exact
 * HTTP 404, or the legacy not-found message when no HTTP status exists, as a
 * definitive missing request. Other failures must stay retryable.
 */
export function isDefinitiveRequestNotFound(error: unknown): boolean {
  if (!(error instanceof HaveApiError)) return false;
  if (error.httpStatus === 404) return true;
  if (error.httpStatus !== undefined) return false;
  const message = error.message.trim();
  return message.toLowerCase() === 'not found'
    || /\b(?:object|request|registration|change)\b[^\n]*\bnot found\b/i.test(message)
    || /(?:objekt|žádost|registrace|změna)[^\n]*(?:nenalezen|nebyl[ao]?\s+nalezen)/i.test(message);
}

export function fraudCheckStatus(checked: unknown, success: unknown): FraudCheckStatus {
  if (checked !== true) return 'pending';
  return success === true ? 'success' : 'failed';
}

export function requestResourceLabel(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['label', 'name', 'code', 'login']) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
    const id = record['id'];
    if (typeof id === 'string' || typeof id === 'number') return `#${id}`;
  }
  return '—';
}

/**
 * Accept only the admin requests overview (with optional filters/hash). This
 * prevents a forged returnTo from navigating outside the review queue or back
 * into another detail page after a successful decision.
 */
export function safeRequestsReturnTo(value: unknown, basePath: string): string {
  const overviewPath = `${basePath.replace(/\/+$/, '')}/requests`;
  if (typeof value !== 'string' || !value || value.length > 2_048) return overviewPath;

  try {
    const origin = 'https://vpsadmin.invalid';
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin) return overviewPath;
    if (parsed.pathname !== overviewPath && parsed.pathname !== `${overviewPath}/`) return overviewPath;
    return `${overviewPath}${parsed.search}${parsed.hash}`;
  } catch {
    return overviewPath;
  }
}
