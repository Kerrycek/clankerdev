import type { UserTotpDevice } from '../../lib/api/userDossier';

export type TotpDeviceBadge = { label: 'active' | 'unconfirmed' | 'disabled'; variant: 'ok' | 'warn' | 'neutral' };
export type TotpWizardStep = 1 | 2 | 3;
export type TotpConfirmExistingStep = 'code' | 'recovery';

export function sortByIdDesc<T extends { id: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
}

export function badgeForDevice(d: UserTotpDevice): TotpDeviceBadge {
  if (d.confirmed && d.enabled) return { label: 'active', variant: 'ok' };
  if (!d.confirmed) return { label: 'unconfirmed', variant: 'warn' };
  return { label: 'disabled', variant: 'neutral' };
}

export function looksLikeTotpCode(v: string): boolean {
  return /^\d{6}$/.test(v.trim());
}

export function safeTotpProvisioningUri(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'otpauth:' || parsed.hostname.toLowerCase() !== 'totp') return null;
    if (parsed.username || parsed.password || parsed.port || parsed.hash) return null;
    return raw;
  } catch {
    return null;
  }
}

export function deviceLabel(device: Pick<UserTotpDevice, 'id' | 'label'>): string {
  return device.label ? String(device.label) : `#${device.id}`;
}
