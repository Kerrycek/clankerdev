import { dateToAdminDateTimeInput, isoToAdminDateTimeInput } from '../../../../lib/datetimeLocal';

export interface EditUserDraft {
  fullName: string;
  email: string;
  address: string;
  level: string;
  info: string;
  mailerEnabled: boolean;
}

export interface StateDraft {
  objectState: string;
  expirationDate: string;
  remindAfterDate: string;
  reason: string;
}

export type EditUserPayload = Record<string, unknown> & {
  full_name: string;
  email: string;
  address: string;
  level: number;
  info: string;
  mailer_enabled: boolean;
};

export function buildEditUserPayload(draft: EditUserDraft): EditUserPayload | null {
  const level = Number(draft.level);
  if (!Number.isFinite(level) || level < 0) return null;

  return {
    full_name: draft.fullName.trim(),
    email: draft.email.trim(),
    address: draft.address.trim(),
    level,
    info: draft.info.trim(),
    mailer_enabled: draft.mailerEnabled,
  };
}

export function optionalStringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? value : undefined;
}

export function makeEditDraft(user: Record<string, unknown>): EditUserDraft {
  return {
    fullName: typeof user['full_name'] === 'string' ? user['full_name'] : '',
    email: typeof user['email'] === 'string' ? user['email'] : '',
    address: typeof user['address'] === 'string' ? user['address'] : '',
    level: typeof user['level'] === 'number' && Number.isFinite(user['level']) ? String(user['level']) : '',
    info: typeof user['info'] === 'string' ? user['info'] : '',
    mailerEnabled: user['mailer_enabled'] !== false,
  };
}

export function softDeleteExpirationInput(): string {
  const expiration = new Date();
  expiration.setMonth(expiration.getMonth() + 1);
  expiration.setSeconds(0, 0);
  return dateToAdminDateTimeInput(expiration);
}

export function makeStateDraft(user: Record<string, unknown>): StateDraft {
  return {
    objectState: typeof user['object_state'] === 'string' && user['object_state'].trim()
      ? user['object_state']
      : 'active',
    expirationDate: isoToAdminDateTimeInput(user['expiration_date']),
    remindAfterDate: isoToAdminDateTimeInput(user['remind_after_date']),
    reason: '',
  };
}
