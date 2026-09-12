export type FraudCheckStatus = 'pending' | 'failed' | 'success';
export type InferredRequestType = 'registration' | 'change';

const RESOLVED_REQUEST_STATES = new Set(['approved', 'denied', 'ignored', 'pending_correction']);

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
