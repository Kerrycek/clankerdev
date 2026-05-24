import type { Page, Route } from '@playwright/test';

export interface HaveApiDescription {
  meta: { namespace: string };
  authentication: { token: { http_header: string } };
}

export function defaultHaveApiDescription(
  metaNamespace: string = '_meta',
  authHeader: string = 'X-HaveAPI-Auth-Token'
): HaveApiDescription {
  return {
    meta: { namespace: metaNamespace },
    authentication: {
      token: { http_header: authHeader },
    },
  };
}

export function jsonFulfill(json: unknown, httpStatus: number = 200) {
  return {
    status: httpStatus,
    contentType: 'application/json',
    body: JSON.stringify(json),
  };
}

export function okEnvelope(response: unknown) {
  return { status: true, response };
}

export function failEnvelope(message: string, errors?: unknown) {
  return { status: false, message, errors, response: null };
}

export function okJson(response: unknown) {
  return jsonFulfill(okEnvelope(response), 200);
}

export interface HaveApiMockUser {
  id: number;
  login: string;
  /**
   * vpsAdmin levels (see src/lib/roles.ts):
   * - >= 1: user
   * - >= 21: support
   * - >= 90: admin
   */
  level: number;
}

export interface HaveApiRequestCtx {
  url: URL;
  method: string;
  pathname: string;
  /**
   * Relative HaveAPI action path under /api/v{version}/...
   * Example: "vpses/123/statuses".
   */
  relPath: string | null;
  searchParams: URLSearchParams;
}

export type HaveApiHandlerResult =
  | undefined
  | unknown
  | { status: boolean; message?: string; errors?: unknown; response?: unknown }
  | { status: number; contentType?: string; headers?: Record<string, string>; body?: string };

export type HaveApiHandler = (ctx: HaveApiRequestCtx) => HaveApiHandlerResult | Promise<HaveApiHandlerResult>;

export interface HaveApiMock {
  addHandler: (key: string, handler: HaveApiHandler) => void;
}

export interface HaveApiMockOptions {
  apiBasePath?: string;
  apiVersion?: string;
  description?: HaveApiDescription;
  user?: HaveApiMockUser;
  handlers?: Record<string, HaveApiHandler>;
  /** Fallback response for unmatched requests (default: {}). */
  fallbackResponse?: unknown;
}

function isFulfillOptions(v: any): v is { status?: number } {
  if (!v || typeof v !== 'object') return false;
  return (
    typeof v.status === 'number' ||
    typeof v.contentType === 'string' ||
    typeof v.body === 'string' ||
    (v.headers && typeof v.headers === 'object')
  );
}

function isEnvelope(v: any): v is { status: boolean } {
  return Boolean(v) && typeof v === 'object' && typeof v.status === 'boolean';
}

function relPathFor(base: string, pathname: string): string | null {
  if (!pathname.startsWith(base)) return null;
  const rest = pathname.slice(base.length);
  const trimmed = rest.startsWith('/') ? rest.slice(1) : rest;
  return trimmed || null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Installs a network interceptor that emulates a minimal subset of HaveAPI.
 *
 * Key goals:
 * - keep tests deterministic
 * - centralize boilerplate (description + users/current + empty chrome panels)
 * - allow per-test handlers for specific endpoints
 */
export async function installHaveApiMock(page: Page, opts?: HaveApiMockOptions) {
  const apiBase = (opts?.apiBasePath ?? '/api').replace(/\/+$/, '');
  const apiVersion = opts?.apiVersion ?? '7.0';
  const versionBase = `${apiBase}/v${apiVersion}`;

  const description = opts?.description ?? defaultHaveApiDescription();
  const user: HaveApiMockUser = opts?.user ?? { id: 1, login: 'e2e', level: 1 };

  const fallback = opts?.fallbackResponse ?? {};

  const builtInHandlers: Record<string, HaveApiHandler> = {
    'GET users/current': () => ({ user }),
    // keep app chrome background panels quiet
    'GET action_states': () => ({ action_states: [] }),
    'GET transaction_chains': () => ({ transaction_chains: [] }),
  };

  const handlers: Record<string, HaveApiHandler> = { ...builtInHandlers, ...(opts?.handlers ?? {}) };

  const mock: HaveApiMock = {
    addHandler: (key: string, handler: HaveApiHandler) => {
      handlers[key] = handler;
    },
  };

  // Match the API base and all nested HaveAPI action paths. A glob like
  // `**/api*` misses `/api/v7.0/...` because `*` does not cross slashes.
  await page.route(new RegExp(`${escapeRegExp(apiBase)}(?:/|$)`), async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();

    const pathname = url.pathname;
    if (pathname !== apiBase && !pathname.startsWith(`${apiBase}/`)) {
      return route.fallback();
    }

    // HaveAPI description fetch (not an action envelope).
    if (
      method === 'GET' &&
      (pathname === apiBase ||
        pathname === `${apiBase}/` ||
        pathname === versionBase ||
        pathname === `${versionBase}/`)
    ) {
      return route.fulfill(jsonFulfill(description, 200));
    }

    const relPath = relPathFor(versionBase, pathname);

    const candidates: string[] = [];
    if (relPath) {
      candidates.push(`${method} ${relPath}`);
      candidates.push(relPath);
    }
    candidates.push(`${method} ${pathname}`);
    candidates.push(pathname);

    const handlerKey = candidates.find((k) => Object.prototype.hasOwnProperty.call(handlers, k));
    const handler = handlerKey ? handlers[handlerKey] : undefined;

    const ctx: HaveApiRequestCtx = {
      url,
      method,
      pathname,
      relPath,
      searchParams: url.searchParams,
    };

    const res = handler ? await handler(ctx) : undefined;

    if (isFulfillOptions(res)) {
      return route.fulfill(res);
    }

    if (isEnvelope(res)) {
      return route.fulfill(jsonFulfill(res, 200));
    }

    if (res !== undefined) {
      return route.fulfill(okJson(res));
    }

    return route.fulfill(okJson(fallback));
  });

  return mock;
}
