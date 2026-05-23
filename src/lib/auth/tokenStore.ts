export type StorageKind = 'session' | 'local';

export interface StoredOAuthToken {
  accessToken: string;
  tokenType?: string;
  scope?: string;
  /** Unix epoch in milliseconds */
  expiresAt?: number;
}

const STORAGE_KEY = 'vpsadmin_ui_next.oauth2';

function getStorage(kind: StorageKind): Storage | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function readStoredOAuthToken(kind: StorageKind): StoredOAuthToken | null {
  const storage = getStorage(kind);
  if (!storage) return null;

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return null;

    const accessToken = parsed['accessToken'];
    if (typeof accessToken !== 'string' || !accessToken.trim()) return null;

    const expiresAtRaw = parsed['expiresAt'];
    const expiresAt = typeof expiresAtRaw === 'number' && Number.isFinite(expiresAtRaw)
      ? expiresAtRaw
      : undefined;

    // Expired token: clear it eagerly.
    if (expiresAt && Date.now() >= expiresAt) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }

    const tokenType = typeof parsed['tokenType'] === 'string' ? parsed['tokenType'] : undefined;
    const scope = typeof parsed['scope'] === 'string' ? parsed['scope'] : undefined;

    return { accessToken, tokenType, scope, expiresAt };
  } catch {
    return null;
  }
}

export function writeStoredOAuthToken(kind: StorageKind, token: StoredOAuthToken): void {
  const storage = getStorage(kind);
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(token));
  } catch {
    // Ignore quota / privacy mode errors.
  }
}

export function clearStoredOAuthToken(kind: StorageKind): void {
  const storage = getStorage(kind);
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
