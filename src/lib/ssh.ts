import type { UserPublicKey } from './api/userDossier';

function normalizeFingerprint(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Best-effort SSH public-key fingerprint formatter.
 *
 * The API already exposes `fingerprint`, so we prefer that canonical value.
 * We deliberately avoid re-implementing OpenSSH fingerprint calculation in the browser
 * here because the backend is the source of truth and may change presentation later.
 */
export function keyFingerprint(key: Pick<UserPublicKey, 'fingerprint' | 'comment'> | null | undefined): string | undefined {
  const fingerprint = normalizeFingerprint(key?.fingerprint);
  if (fingerprint) return fingerprint;

  const comment = normalizeFingerprint(key?.comment);
  return comment;
}
