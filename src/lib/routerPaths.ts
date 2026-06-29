export function normalizeRouterBasename(routerBasename: string | undefined): string {
  const raw = typeof routerBasename === 'string' ? routerBasename.trim() : '';
  if (!raw || raw === '/') return '';

  let normalized = raw;
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/+$/, '');

  return normalized === '/' ? '' : normalized;
}

export function sanitizeLocalPath(path: string | null | undefined, fallback: string): string {
  const candidate = typeof path === 'string' ? path.trim() : '';
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }

  return candidate;
}

export function sanitizePostLoginPath(path: string | null | undefined, fallback = '/app'): string {
  const localPath = sanitizeLocalPath(path, fallback);

  try {
    const u = new URL(localPath, 'http://local.invalid');
    if (u.searchParams.get('session') === 'expired') return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}

export function withRouterBasename(path: string, routerBasename: string | undefined): string {
  const safePath = sanitizeLocalPath(path, '/');
  const base = normalizeRouterBasename(routerBasename);

  if (!base) return safePath;
  if (safePath === base || safePath.startsWith(`${base}/`)) return safePath;
  if (safePath === '/') return `${base}/`;

  return `${base}${safePath}`;
}

export function withSameOriginNextParam(
  url: string,
  nextPath: string,
  currentOrigin: string = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
): string {
  try {
    const resolved = new URL(url, currentOrigin);

    if (resolved.origin === currentOrigin) {
      resolved.searchParams.set('next', nextPath);
    }

    return resolved.toString();
  } catch {
    return url;
  }
}
