import type { TableRowVariant } from '../components/ui/TableRowLink';
import type { RegistrationRequest, UserRequestState } from './api/requests';

export type BadgeVariant = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'black';

export function requestStateLabelKey(state: UserRequestState | undefined | null): string {
  const s = String(state ?? '').trim();
  if (s === 'awaiting') return 'requests.state.awaiting';
  if (s === 'pending_correction') return 'requests.state.pending_correction';
  if (s === 'approved') return 'requests.state.approved';
  if (s === 'denied') return 'requests.state.denied';
  if (s === 'ignored') return 'requests.state.ignored';
  return 'state.unknown';
}

export function requestStateBadgeVariant(state: UserRequestState | undefined | null): BadgeVariant {
  const s = String(state ?? '').trim();
  if (s === 'approved') return 'ok';
  if (s === 'awaiting') return 'warn';
  if (s === 'pending_correction') return 'info';
  if (s === 'denied') return 'danger';
  if (s === 'ignored') return 'neutral';
  return 'neutral';
}

export function requestRowVariant(state: UserRequestState | undefined | null): TableRowVariant | undefined {
  const s = String(state ?? '').trim();
  if (s === 'awaiting') return 'warn';
  if (s === 'pending_correction') return 'info';
  return undefined;
}

export function requestTypeLabelKey(type: 'registration' | 'change'): string {
  return type === 'registration' ? 'requests.type.registration' : 'requests.type.change';
}

export function requestTypeBadgeVariant(_type: 'registration' | 'change'): BadgeVariant {
  return 'neutral';
}

export function fraudRiskBadge(req: RegistrationRequest):
  | { tier: 'high' | 'medium'; variant: BadgeVariant; labelKey: string; score: number }
  | null {
  const ip = typeof req.ip_fraud_score === 'number' ? req.ip_fraud_score : undefined;
  const mail = typeof req.mail_fraud_score === 'number' ? req.mail_fraud_score : undefined;
  const max = Math.max(ip ?? 0, mail ?? 0);

  if (!Number.isFinite(max) || max <= 0) return null;
  if (max >= 80) return { tier: 'high', variant: 'danger', labelKey: 'requests.risk.high', score: max };
  if (max >= 50) return { tier: 'medium', variant: 'warn', labelKey: 'requests.risk.medium', score: max };
  return null;
}
