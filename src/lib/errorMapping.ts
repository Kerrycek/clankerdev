import { HaveApiError, type HaveApiRequestInfo } from './api/haveapi';
import { stringifyUnknown } from './errors';
import { staticT } from './staticI18n';

export type ErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'locked'
  | 'server'
  | 'unexpected';

export function classifyError(err: unknown): {
  kind: ErrorKind;
  httpStatus?: number;
  message: string;
  haveApiMessage?: string;
  haveApiErrors?: unknown;
  request?: HaveApiRequestInfo;
} {
  if (err instanceof HaveApiError) {
    const httpStatus = err.httpStatus;
    const kind: ErrorKind =
      httpStatus === 401
        ? 'unauthorized'
        : httpStatus === 403
          ? 'forbidden'
          : httpStatus === 404
            ? 'not_found'
            : httpStatus === 423
              ? 'locked'
              : typeof httpStatus === 'number' && httpStatus >= 500
                ? 'server'
                : 'unexpected';

    return {
      kind,
      httpStatus,
      message: err.message || staticT('common.unknown_error'),
      haveApiMessage: err.envelope?.message,
      haveApiErrors: err.envelope?.errors,
      request: err.request,
    };
  }

  // Fetch/network errors often surface as TypeError("Failed to fetch") in browsers.
  if (err instanceof Error) {
    const msg = err.message || staticT('common.unknown_error');
    const lower = msg.toLowerCase();
    const isAbort = err.name === 'AbortError';

    const looksNetwork =
      !isAbort &&
      (lower.includes('failed to fetch') ||
        lower.includes('networkerror') ||
        lower.includes('load failed') ||
        lower.includes('network request failed') ||
        lower.includes('connection') ||
        lower.includes('offline'));

    return {
      kind: looksNetwork ? 'network' : 'unexpected',
      message: msg,
    };
  }

  return {
    kind: 'unexpected',
    message: stringifyUnknown(err),
  };
}

export function errorI18nKeys(kind: ErrorKind): { titleKey: string; bodyKey: string } {
  switch (kind) {
    case 'network':
      return { titleKey: 'error.network.title', bodyKey: 'error.network.body' };
    case 'unauthorized':
      return { titleKey: 'error.unauthorized.title', bodyKey: 'error.unauthorized.body' };
    case 'forbidden':
      return { titleKey: 'error.forbidden.title', bodyKey: 'error.forbidden.body' };
    case 'not_found':
      return { titleKey: 'error.not_found.title', bodyKey: 'error.not_found.body' };
    case 'locked':
      return { titleKey: 'error.locked.title', bodyKey: 'error.locked.body' };
    case 'server':
      return { titleKey: 'error.server.title', bodyKey: 'error.server.body' };
    default:
      return { titleKey: 'error.unexpected.title', bodyKey: 'error.unexpected.body' };
  }
}

export function buildErrorDetails(opts: {
  error: unknown;
  route?: string;
  extra?: Record<string, unknown>;
}): { payload: Record<string, unknown>; text: string } {
  const info = classifyError(opts.error);

  const route =
    opts.route ??
    (typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : undefined);

  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    route,
    kind: info.kind,
  };

  if (info.request) payload['request'] = info.request;
  if (info.httpStatus !== undefined) payload['http_status'] = info.httpStatus;

  payload['message'] = info.message;

  if (info.haveApiMessage) payload['haveapi_message'] = info.haveApiMessage;
  if (info.haveApiErrors !== undefined) payload['haveapi_errors'] = info.haveApiErrors;

  if (opts.extra && Object.keys(opts.extra).length > 0) {
    payload['extra'] = opts.extra;
  }

  let text = '';
  try {
    text = JSON.stringify(payload, null, 2);
  } catch {
    text = String(payload);
  }

  return { payload, text };
}
