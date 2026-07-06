import type { CreateUserPayload } from '../../../../lib/api/users';

export type RoleFilter = '' | 'user' | 'support' | 'admin';

export interface CreateUserDraft {
  login: string;
  password: string;
  password2: string;
  fullName: string;
  email: string;
  address: string;
  level: string;
  info: string;
  monthlyPayment: string;
  mailerEnabled: boolean;
}

export const initialCreateUserDraft: CreateUserDraft = {
  login: '',
  password: '',
  password2: '',
  fullName: '',
  email: '',
  address: '',
  level: '2',
  info: '',
  monthlyPayment: '300',
  mailerEnabled: true,
};

export type UserSmartKey = 'id' | 'q' | 'role' | 'level' | 'mailer' | 'lockout' | 'password_reset' | 'mfa';

export type CreateUserPayloadReview =
  | { ok: true; payload: CreateUserPayload }
  | { ok: false; errorKey: string };

export function normalizeRole(raw: string | null | undefined): RoleFilter {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'admin') return 'admin';
  if (v === 'support') return 'support';
  if (v === 'user') return 'user';
  return '';
}

export function parseBoolToken(value: string): boolean | null | undefined {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return undefined;

  if (v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 'on' || v === 'enabled') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'n' || v === 'off' || v === 'disabled') return false;

  if (v === 'any' || v === '*' || v === 'all') return undefined;
  return null;
}

export function canonicalUserSmartKey(raw: string): UserSmartKey | null {
  const k = String(raw ?? '').trim().toLowerCase();
  if (!k) return null;

  if (k === 'id' || k === '#') return 'id';
  if (k === 'q' || k === 'search' || k === 's' || k === 'text' || k === 'query') return 'q';

  if (k === 'role' || k === 'r') return 'role';
  if (k === 'level' || k === 'lvl') return 'level';

  if (k === 'mailer' || k === 'mail' || k === 'mailer_enabled') return 'mailer';
  if (k === 'lockout' || k === 'locked') return 'lockout';
  if (k === 'password_reset' || k === 'pwd_reset' || k === 'reset') return 'password_reset';
  if (k === 'mfa' || k === '2fa') return 'mfa';

  if (k === 'admin') return 'role';

  return null;
}

export function resolveRoleValue(raw: string): RoleFilter | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'all' || v === 'any' || v === '*') return '';
  if (v === 'admin' || v === 'admins') return 'admin';
  if (v === 'support' || v === 'supp') return 'support';
  if (v === 'user' || v === 'users') return 'user';

  const known: RoleFilter[] = ['admin', 'support', 'user'];
  const pref = known.filter((x) => x.startsWith(v));
  if (pref.length === 1) return pref[0] ?? null;
  return null;
}

export function buildCreateUserPayload(draft: CreateUserDraft): CreateUserPayloadReview {
  const login = draft.login.trim();
  const password = draft.password;
  const password2 = draft.password2;
  const level = Number(draft.level);
  const monthly = draft.monthlyPayment.trim() ? Number(draft.monthlyPayment) : undefined;

  if (!login) {
    return { ok: false, errorKey: 'admin.users.create.validation.login' };
  }

  if (!password) {
    return { ok: false, errorKey: 'admin.users.create.validation.password' };
  }

  if (password !== password2) {
    return { ok: false, errorKey: 'admin.users.create.validation.password_match' };
  }

  if (!Number.isFinite(level) || level < 0) {
    return { ok: false, errorKey: 'admin.users.create.validation.level' };
  }

  if (monthly !== undefined && (!Number.isFinite(monthly) || monthly < 0)) {
    return { ok: false, errorKey: 'admin.users.create.validation.monthly_payment' };
  }

  return {
    ok: true,
    payload: {
      login,
      password,
      full_name: draft.fullName.trim() || undefined,
      email: draft.email.trim() || undefined,
      address: draft.address.trim() || undefined,
      level,
      info: draft.info.trim() || undefined,
      monthly_payment: monthly,
      mailer_enabled: draft.mailerEnabled,
    },
  };
}
