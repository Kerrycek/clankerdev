export interface NormalizedConsoleToken {
  token: string;
  expiration?: string | null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeRemoteConsoleServer(value: unknown): string | null {
  const server = nonEmptyString(value);
  if (!server || /[\u0000-\u001f\u007f]/.test(server)) return null;

  if (server.startsWith('//')) return null;

  if (server.startsWith('/')) {
    try {
      const parsed = new URL(server, 'http://localhost');
      const normalizedPath = parsed.pathname.replace(/\/+$/, '');
      return normalizedPath || null;
    } catch {
      return null;
    }
  }

  try {
    const parsed = new URL(server);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;

    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '') || null;
  } catch {
    return null;
  }
}

export function normalizeConsoleToken(value: unknown): NormalizedConsoleToken | null {
  if (!value || typeof value !== 'object') return null;

  const obj = value as Record<string, unknown>;
  const token = nonEmptyString(obj['token']) ?? nonEmptyString(obj['session_token']) ?? nonEmptyString(obj['session']);

  if (!token) return null;

  const expiration = nonEmptyString(obj['expiration']) ?? nonEmptyString(obj['expires_at']) ?? null;
  return { token, expiration };
}

export function buildConsoleUrl(server: string | null | undefined, vpsId: number | string, token: string | null | undefined): string | null {
  const normalizedServer = normalizeRemoteConsoleServer(server);
  const normalizedToken = nonEmptyString(token);
  if (!normalizedServer || !normalizedToken) return null;

  return `${normalizedServer}/console/${encodeURIComponent(String(vpsId))}?session=${encodeURIComponent(normalizedToken)}`;
}

export function millisecondsUntilConsoleTokenExpiry(expiration: string | null | undefined, now = Date.now()): number | null {
  const normalizedExpiration = nonEmptyString(expiration);
  if (!normalizedExpiration) return null;

  const expiresAt = Date.parse(normalizedExpiration);
  if (Number.isNaN(expiresAt)) return null;

  return Math.max(0, expiresAt - now);
}

export function isConsoleTokenExpired(expiration: string | null | undefined, now = Date.now()): boolean {
  const ms = millisecondsUntilConsoleTokenExpiry(expiration, now);
  return ms !== null && ms <= 0;
}
