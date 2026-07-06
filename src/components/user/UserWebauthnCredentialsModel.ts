import type { UserWebauthnCredential, WebauthnRegistrationBeginResponse } from '../../lib/api/userDossier';

export type WebauthnCredentialBadge = {
  variant: 'ok' | 'neutral';
  label: 'enabled' | 'disabled';
};

export type WebauthnLabelValidation =
  | { valid: true; label: string }
  | { valid: false };

export function sortWebauthnCredentialsByIdDesc<T extends { id: number }>(rows: readonly T[] | undefined): T[] {
  return [...(rows ?? [])].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
}

export function webauthnCredentialBadge(credential: Pick<UserWebauthnCredential, 'enabled'>): WebauthnCredentialBadge {
  return credential.enabled ? { variant: 'ok', label: 'enabled' } : { variant: 'neutral', label: 'disabled' };
}

export function webauthnCredentialLabel(credential: Pick<UserWebauthnCredential, 'id' | 'label'>): string {
  const label = String(credential.label ?? '').trim();
  return label || `#${credential.id}`;
}

export function validateWebauthnLabel(raw: string): WebauthnLabelValidation {
  const label = raw.trim();
  return label ? { valid: true, label } : { valid: false };
}

export function buildWebauthnUpdatePayload(rawLabel: string, enabled: boolean): WebauthnLabelValidation & {
  payload?: { label: string; enabled: boolean };
} {
  const parsed = validateWebauthnLabel(rawLabel);
  if (!parsed.valid) return parsed;
  return { ...parsed, payload: { label: parsed.label, enabled } };
}

export function isSecureWebauthnContext(
  win: Pick<Window, 'isSecureContext'> | undefined = typeof window === 'undefined' ? undefined : window,
): boolean {
  return Boolean(win?.isSecureContext);
}

export function canStartWebauthnRegistration(input: {
  allowRegistration: boolean;
  supported: boolean;
  secureContext: boolean;
}): boolean {
  return input.allowRegistration && input.supported && input.secureContext;
}

export function isNamedDomError(error: unknown, name: string): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === name);
}

export function parseWebauthnRegistrationBegin(
  data: WebauthnRegistrationBeginResponse | null | undefined,
): { challengeToken: string; optionsJson: unknown } | null {
  const challengeToken = typeof data?.challenge_token === 'string' ? data.challenge_token.trim() : '';
  if (!challengeToken || data?.options == null) return null;
  return { challengeToken, optionsJson: data.options };
}
