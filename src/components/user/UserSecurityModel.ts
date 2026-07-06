import type { UserSession } from '../../lib/api/userDossier';
import type { User } from '../../lib/api/users';

export type UserSecurityVariant = 'profile' | 'admin';

export type SecurityUserBooleanKey =
  | 'enable_basic_auth'
  | 'enable_token_auth'
  | 'enable_oauth2_auth'
  | 'enable_single_sign_on'
  | 'enable_new_login_notification'
  | 'enable_multi_factor_auth'
  | 'preferred_logout_all'
  | 'lockout'
  | 'password_reset';

export type SecurityUserIntegerKey = 'preferred_session_length';

export function userBooleanField(user: User | undefined, key: SecurityUserBooleanKey, fallback: boolean): boolean {
  const value = user?.[key];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

export function userIntegerField(user: User | undefined, key: SecurityUserIntegerKey, fallback: number): number {
  const value = user?.[key];
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (Number.isFinite(parsed)) return parsed;
  return fallback;
}

export function secondsToMinutesString(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0';
  return String(Math.round(seconds / 60));
}

export type SessionMinutesParse =
  | { valid: true; raw: string; minutes: number; seconds: number }
  | { valid: false; raw: string; validationKey: string };

export function parseSessionMinutes(rawValue: string): SessionMinutesParse {
  const raw = String(rawValue ?? '').trim();
  if (!raw) {
    return { valid: false, raw, validationKey: 'security.settings.review.validation.session_length_required' };
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { valid: false, raw, validationKey: 'security.settings.review.validation.session_length_invalid' };
  }

  const minutes = Math.round(parsed);
  return { valid: true, raw, minutes, seconds: minutes * 60 };
}

export function truncateLabel(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1)).trim()}…`;
}

export interface PasswordDraft {
  currentPassword: string;
  newPassword: string;
  newPassword2: string;
  logoutSessions: boolean;
}

export interface PasswordChangeReview {
  canSubmit: boolean;
  hasNewPassword: boolean;
  currentPasswordProvided: boolean;
  passwordsMatch: boolean;
  logoutSessions: boolean;
  validationKey?: string;
}

export function buildPasswordChangeReview(variant: UserSecurityVariant, draft: PasswordDraft): PasswordChangeReview {
  const hasNewPassword = draft.newPassword.trim().length > 0;
  const currentPasswordProvided = draft.currentPassword.trim().length > 0;
  const passwordsMatch = draft.newPassword === draft.newPassword2;

  let validationKey: string | undefined;
  if (!hasNewPassword) {
    validationKey = 'security.password.validation.new_required';
  } else if (variant === 'profile' && !currentPasswordProvided) {
    validationKey = 'security.password.validation.current_required';
  } else if (!passwordsMatch) {
    validationKey = 'security.password.validation.mismatch';
  }

  return {
    canSubmit: validationKey === undefined,
    hasNewPassword,
    currentPasswordProvided,
    passwordsMatch,
    logoutSessions: draft.logoutSessions,
    validationKey,
  };
}

export function buildPasswordPayload(variant: UserSecurityVariant, draft: PasswordDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    new_password: draft.newPassword,
    logout_sessions: draft.logoutSessions,
  };

  if (variant === 'profile') {
    payload['password'] = draft.currentPassword;
  }

  return payload;
}

export interface SecuritySettingsSnapshot {
  basic: boolean;
  token: boolean;
  sso: boolean;
  notif: boolean;
  sessMin: string;
  logoutAll: boolean;
  oauth2: boolean;
}

export interface SecuritySettingsDraft {
  basic: boolean;
  token: boolean;
  sso: boolean;
  notif: boolean;
  sessMin: string;
  logoutAll: boolean;
}

export type SecuritySettingsChangeKey = 'basic' | 'token' | 'sso' | 'notif' | 'sessMin' | 'logoutAll';

export type SecuritySettingValue =
  | { kind: 'boolean'; enabled: boolean }
  | { kind: 'sessionMinutes'; minutes: number | null };

export interface SecuritySettingsChange {
  key: SecuritySettingsChangeKey;
  labelKey: string;
  current: SecuritySettingValue;
  next: SecuritySettingValue;
  impactKey: string;
  tone: 'neutral' | 'warn' | 'danger';
}

export interface SecuritySettingsReview {
  hasChanges: boolean;
  canSubmit: boolean;
  changes: SecuritySettingsChange[];
  warningKeys: string[];
  sessionParse: SessionMinutesParse;
}

const securitySettingsMeta: Record<
  SecuritySettingsChangeKey,
  { labelKey: string; payloadKey: string; impactKey: string; warningWhenDisabled?: boolean }
> = {
  basic: {
    labelKey: 'security.settings.auth.basic.label',
    payloadKey: 'enable_basic_auth',
    impactKey: 'security.settings.review.impact.basic',
    warningWhenDisabled: true,
  },
  token: {
    labelKey: 'security.settings.auth.token.label',
    payloadKey: 'enable_token_auth',
    impactKey: 'security.settings.review.impact.token',
    warningWhenDisabled: true,
  },
  sso: {
    labelKey: 'security.settings.sso.label',
    payloadKey: 'enable_single_sign_on',
    impactKey: 'security.settings.review.impact.sso',
    warningWhenDisabled: true,
  },
  notif: {
    labelKey: 'security.settings.new_login.label',
    payloadKey: 'enable_new_login_notification',
    impactKey: 'security.settings.review.impact.new_login',
  },
  sessMin: {
    labelKey: 'security.settings.session_length.label',
    payloadKey: 'preferred_session_length',
    impactKey: 'security.settings.review.impact.session_length',
  },
  logoutAll: {
    labelKey: 'security.settings.logout_all.label',
    payloadKey: 'preferred_logout_all',
    impactKey: 'security.settings.review.impact.logout_all',
  },
};

export function buildStoredSecuritySettings(user: User | undefined): SecuritySettingsSnapshot {
  const oauth2 = userBooleanField(user, 'enable_oauth2_auth', true);

  return {
    basic: userBooleanField(user, 'enable_basic_auth', false),
    token: userBooleanField(user, 'enable_token_auth', true),
    sso: userBooleanField(user, 'enable_single_sign_on', true),
    notif: userBooleanField(user, 'enable_new_login_notification', true),
    sessMin: secondsToMinutesString(userIntegerField(user, 'preferred_session_length', 20 * 60)),
    logoutAll: userBooleanField(user, 'preferred_logout_all', false),
    oauth2,
  };
}


export type SecurityPostureTone = 'ok' | 'warn' | 'danger' | 'neutral';
export type SecurityPostureStatus = 'ready' | 'needs_attention' | 'limited' | 'locked';
export type SecurityPostureItemKey =
  | 'interactive_login'
  | 'mfa'
  | 'new_login_notification'
  | 'session_length'
  | 'lockout'
  | 'password_reset';

export interface SecurityPostureItem {
  key: SecurityPostureItemKey;
  labelKey: string;
  valueKey: string;
  valueVars?: Record<string, string | number>;
  descriptionKey: string;
  tone: SecurityPostureTone;
}

export interface UserSecurityPosture {
  status: SecurityPostureStatus;
  badgeKey: string;
  badgeTone: SecurityPostureTone;
  summaryKey: string;
  summaryVars: Record<string, string | number>;
  warningCount: number;
  criticalCount: number;
  items: SecurityPostureItem[];
}

function makePostureItem(input: SecurityPostureItem): SecurityPostureItem {
  return input;
}

export function buildUserSecurityPosture(user: User | undefined, variant: UserSecurityVariant): UserSecurityPosture {
  const stored = buildStoredSecuritySettings(user);
  const interactiveLoginEnabled = stored.basic || stored.sso || stored.oauth2;
  const mfaEnabled = userBooleanField(user, 'enable_multi_factor_auth', false);
  const newLoginNotificationEnabled = stored.notif;
  const sessionParse = parseSessionMinutes(stored.sessMin);
  const lockoutActive = userBooleanField(user, 'lockout', false);
  const passwordResetRequired = userBooleanField(user, 'password_reset', false);

  const items: SecurityPostureItem[] = [
    makePostureItem({
      key: 'interactive_login',
      labelKey: 'security.posture.item.interactive_login.label',
      valueKey: interactiveLoginEnabled ? 'security.posture.value.available' : 'security.posture.value.unavailable',
      descriptionKey: interactiveLoginEnabled
        ? 'security.posture.item.interactive_login.ready'
        : 'security.posture.item.interactive_login.blocked',
      tone: interactiveLoginEnabled ? 'ok' : 'danger',
    }),
    makePostureItem({
      key: 'mfa',
      labelKey: 'security.posture.item.mfa.label',
      valueKey: mfaEnabled ? 'common.enabled' : 'common.disabled',
      descriptionKey: mfaEnabled ? 'security.posture.item.mfa.ready' : 'security.posture.item.mfa.warning',
      tone: mfaEnabled ? 'ok' : 'warn',
    }),
    makePostureItem({
      key: 'new_login_notification',
      labelKey: 'security.posture.item.new_login_notification.label',
      valueKey: newLoginNotificationEnabled ? 'common.enabled' : 'common.disabled',
      descriptionKey: newLoginNotificationEnabled
        ? 'security.posture.item.new_login_notification.ready'
        : 'security.posture.item.new_login_notification.warning',
      tone: newLoginNotificationEnabled ? 'ok' : 'warn',
    }),
    makePostureItem({
      key: 'session_length',
      labelKey: 'security.posture.item.session_length.label',
      valueKey: sessionParse.valid && sessionParse.minutes === 0
        ? 'security.settings.session_length.preset.never'
        : 'security.settings.session_length.value.minutes',
      valueVars: sessionParse.valid ? { m: sessionParse.minutes } : undefined,
      descriptionKey: sessionParse.valid && sessionParse.minutes === 0
        ? 'security.posture.item.session_length.warning'
        : 'security.posture.item.session_length.ready',
      tone: sessionParse.valid && sessionParse.minutes === 0 ? 'warn' : 'ok',
    }),
  ];

  if (variant === 'admin') {
    items.push(
      makePostureItem({
        key: 'lockout',
        labelKey: 'security.posture.item.lockout.label',
        valueKey: lockoutActive ? 'security.posture.value.locked' : 'security.posture.value.unlocked',
        descriptionKey: lockoutActive ? 'security.posture.item.lockout.warning' : 'security.posture.item.lockout.ready',
        tone: lockoutActive ? 'danger' : 'ok',
      }),
      makePostureItem({
        key: 'password_reset',
        labelKey: 'security.posture.item.password_reset.label',
        valueKey: passwordResetRequired ? 'security.posture.value.required' : 'security.posture.value.not_required',
        descriptionKey: passwordResetRequired
          ? 'security.posture.item.password_reset.warning'
          : 'security.posture.item.password_reset.ready',
        tone: passwordResetRequired ? 'warn' : 'ok',
      })
    );
  }

  const warningCount = items.filter((item) => item.tone === 'warn').length;
  const criticalCount = items.filter((item) => item.tone === 'danger').length;

  const status: SecurityPostureStatus = lockoutActive && variant === 'admin'
    ? 'locked'
    : criticalCount > 0
      ? 'limited'
      : warningCount > 0
        ? 'needs_attention'
        : 'ready';

  const badgeTone: SecurityPostureTone = status === 'ready'
    ? 'ok'
    : status === 'needs_attention'
      ? 'warn'
      : 'danger';

  const badgeKey = `security.posture.badge.${status}`;
  const summaryKey = `security.posture.summary.${status}`;

  return {
    status,
    badgeKey,
    badgeTone,
    summaryKey,
    summaryVars: { warningCount, criticalCount },
    warningCount,
    criticalCount,
    items,
  };
}

export function draftFromStoredSecuritySettings(stored: SecuritySettingsSnapshot): SecuritySettingsDraft {
  return {
    basic: stored.basic,
    token: stored.token,
    sso: stored.sso,
    notif: stored.notif,
    sessMin: stored.sessMin,
    logoutAll: stored.logoutAll,
  };
}

function booleanChange(
  key: Exclude<SecuritySettingsChangeKey, 'sessMin'>,
  current: boolean,
  next: boolean
): SecuritySettingsChange | null {
  if (current === next) return null;
  const meta = securitySettingsMeta[key];

  return {
    key,
    labelKey: meta.labelKey,
    current: { kind: 'boolean', enabled: current },
    next: { kind: 'boolean', enabled: next },
    impactKey: meta.impactKey,
    tone: meta.warningWhenDisabled && !next ? 'warn' : 'neutral',
  };
}

export function buildSecuritySettingsPayload(
  stored: SecuritySettingsSnapshot,
  draft: SecuritySettingsDraft
): { valid: true; payload: Record<string, unknown> } | { valid: false; validationKey: string } {
  const sessionParse = parseSessionMinutes(draft.sessMin);
  if (!sessionParse.valid) {
    return { valid: false, validationKey: sessionParse.validationKey };
  }

  const storedSessionParse = parseSessionMinutes(stored.sessMin);
  const payload: Record<string, unknown> = {};

  for (const key of ['basic', 'token', 'sso', 'notif', 'logoutAll'] as const) {
    if (draft[key] !== stored[key]) {
      payload[securitySettingsMeta[key].payloadKey] = draft[key];
    }
  }

  const storedSeconds = storedSessionParse.valid ? storedSessionParse.seconds : 0;
  if (sessionParse.seconds !== storedSeconds) {
    payload[securitySettingsMeta.sessMin.payloadKey] = sessionParse.seconds;
  }

  return { valid: true, payload };
}

export function buildSecuritySettingsReview(
  stored: SecuritySettingsSnapshot,
  draft: SecuritySettingsDraft
): SecuritySettingsReview {
  const sessionParse = parseSessionMinutes(draft.sessMin);
  const storedSessionParse = parseSessionMinutes(stored.sessMin);
  const changes: SecuritySettingsChange[] = [];

  for (const key of ['basic', 'token', 'sso', 'notif', 'logoutAll'] as const) {
    const change = booleanChange(key, stored[key], draft[key]);
    if (change) changes.push(change);
  }

  if (sessionParse.valid) {
    const storedMinutes = storedSessionParse.valid ? storedSessionParse.minutes : null;
    if (sessionParse.minutes !== storedMinutes) {
      changes.push({
        key: 'sessMin',
        labelKey: securitySettingsMeta.sessMin.labelKey,
        current: { kind: 'sessionMinutes', minutes: storedMinutes },
        next: { kind: 'sessionMinutes', minutes: sessionParse.minutes },
        impactKey: securitySettingsMeta.sessMin.impactKey,
        tone: sessionParse.minutes === 0 ? 'warn' : 'neutral',
      });
    }
  }

  const warningKeys: string[] = [];
  if (!sessionParse.valid) {
    warningKeys.push(sessionParse.validationKey);
  }

  if (!draft.basic && !draft.sso && !stored.oauth2) {
    warningKeys.push('security.settings.review.warning.no_interactive_login');
  }

  if (sessionParse.valid && sessionParse.minutes === 0 && stored.sessMin !== '0') {
    warningKeys.push('security.settings.review.warning.never_expire');
  }

  const hasChanges = changes.length > 0;

  return {
    hasChanges,
    canSubmit: hasChanges && sessionParse.valid,
    changes,
    warningKeys,
    sessionParse,
  };
}

export function parseCreatedSessionToken(session: UserSession | undefined): { tokenFull: string; sessionId: number } | null {
  const tokenFull = typeof session?.token_full === 'string' ? session.token_full : '';
  const sessionId = session?.id;

  if (!tokenFull || typeof sessionId !== 'number' || !Number.isFinite(sessionId)) return null;

  return { tokenFull, sessionId };
}
