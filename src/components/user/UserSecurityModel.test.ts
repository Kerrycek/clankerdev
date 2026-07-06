import { describe, expect, test } from 'vitest';

import type { UserSession } from '../../lib/api/userDossier';
import type { User } from '../../lib/api/users';

import {
  buildPasswordChangeReview,
  buildPasswordPayload,
  buildSecuritySettingsPayload,
  buildSecuritySettingsReview,
  buildStoredSecuritySettings,
  buildUserSecurityPosture,
  parseCreatedSessionToken,
  parseSessionMinutes,
  truncateLabel,
  userBooleanField,
  userIntegerField,
} from './UserSecurityModel';

describe('UserSecurityModel', () => {
  test('normalizes user boolean and integer fields without casts', () => {
    const user: User = {
      id: 1,
      login: 'alice',
      level: 1,
      enable_basic_auth: 1,
      enable_token_auth: false,
      enable_multi_factor_auth: 1,
      preferred_session_length: '600',
    };

    expect(userBooleanField(user, 'enable_basic_auth', false)).toBe(true);
    expect(userBooleanField(user, 'enable_token_auth', true)).toBe(false);
    expect(userBooleanField(user, 'enable_multi_factor_auth', false)).toBe(true);
    expect(userBooleanField(user, 'enable_oauth2_auth', true)).toBe(true);
    expect(userIntegerField(user, 'preferred_session_length', 1200)).toBe(600);
  });

  test('parses session minutes with validation', () => {
    expect(parseSessionMinutes('20')).toEqual({ valid: true, raw: '20', minutes: 20, seconds: 1200 });
    expect(parseSessionMinutes('2.6')).toEqual({ valid: true, raw: '2.6', minutes: 3, seconds: 180 });
    expect(parseSessionMinutes('0')).toEqual({ valid: true, raw: '0', minutes: 0, seconds: 0 });
    expect(parseSessionMinutes('')).toMatchObject({ valid: false, validationKey: 'security.settings.review.validation.session_length_required' });
    expect(parseSessionMinutes('-1')).toMatchObject({ valid: false, validationKey: 'security.settings.review.validation.session_length_invalid' });
  });

  test('builds password review and payload for profile/admin modes', () => {
    expect(
      buildPasswordChangeReview('profile', {
        currentPassword: '',
        newPassword: 'secret',
        newPassword2: 'secret',
        logoutSessions: true,
      })
    ).toMatchObject({ canSubmit: false, validationKey: 'security.password.validation.current_required' });

    expect(
      buildPasswordChangeReview('admin', {
        currentPassword: '',
        newPassword: 'secret',
        newPassword2: 'different',
        logoutSessions: false,
      })
    ).toMatchObject({ canSubmit: false, validationKey: 'security.password.validation.mismatch' });

    expect(
      buildPasswordPayload('profile', {
        currentPassword: 'old',
        newPassword: 'new',
        newPassword2: 'new',
        logoutSessions: true,
      })
    ).toEqual({ password: 'old', new_password: 'new', logout_sessions: true });
  });

  test('builds settings review and stable changed-field payloads', () => {
    const stored = buildStoredSecuritySettings({
      id: 1,
      login: 'alice',
      level: 1,
      enable_basic_auth: true,
      enable_token_auth: true,
      enable_single_sign_on: true,
      enable_new_login_notification: true,
      preferred_session_length: 1200,
      preferred_logout_all: false,
      enable_oauth2_auth: false,
    });

    const draft = {
      basic: false,
      token: true,
      sso: false,
      notif: false,
      sessMin: '60',
      logoutAll: true,
    };

    expect(buildSecuritySettingsReview(stored, draft)).toMatchObject({
      hasChanges: true,
      canSubmit: true,
      warningKeys: ['security.settings.review.warning.no_interactive_login'],
    });

    expect(buildSecuritySettingsPayload(stored, draft)).toEqual({
      valid: true,
      payload: {
        enable_basic_auth: false,
        enable_single_sign_on: false,
        enable_new_login_notification: false,
        preferred_logout_all: true,
        preferred_session_length: 3600,
      },
    });
  });

  test('blocks invalid settings payloads and warns for never-expiring sessions', () => {
    const stored = buildStoredSecuritySettings({ id: 1, login: 'alice', level: 1, preferred_session_length: 1200 });
    const invalidDraft = { basic: false, token: true, sso: true, notif: true, sessMin: 'bad', logoutAll: false };
    const neverDraft = { ...invalidDraft, sessMin: '0' };

    expect(buildSecuritySettingsPayload(stored, invalidDraft)).toEqual({
      valid: false,
      validationKey: 'security.settings.review.validation.session_length_invalid',
    });
    expect(buildSecuritySettingsReview(stored, neverDraft).warningKeys).toContain('security.settings.review.warning.never_expire');
  });


  test('summarizes healthy profile security posture', () => {
    const posture = buildUserSecurityPosture({
      id: 1,
      login: 'alice',
      level: 1,
      enable_basic_auth: true,
      enable_single_sign_on: false,
      enable_oauth2_auth: true,
      enable_multi_factor_auth: true,
      enable_new_login_notification: true,
      preferred_session_length: 1200,
    }, 'profile');

    expect(posture).toMatchObject({
      status: 'ready',
      badgeTone: 'ok',
      warningCount: 0,
      criticalCount: 0,
    });
    expect(posture.items.map((item) => item.key)).toEqual([
      'interactive_login',
      'mfa',
      'new_login_notification',
      'session_length',
    ]);
  });

  test('flags limited interactive login and never-expiring sessions in posture', () => {
    const posture = buildUserSecurityPosture({
      id: 2,
      login: 'bob',
      level: 1,
      enable_basic_auth: false,
      enable_single_sign_on: false,
      enable_oauth2_auth: false,
      enable_multi_factor_auth: false,
      enable_new_login_notification: false,
      preferred_session_length: 0,
    }, 'profile');

    expect(posture.status).toBe('limited');
    expect(posture.criticalCount).toBe(1);
    expect(posture.warningCount).toBe(3);
    expect(posture.items.find((item) => item.key === 'interactive_login')).toMatchObject({ tone: 'danger' });
    expect(posture.items.find((item) => item.key === 'session_length')).toMatchObject({ tone: 'warn' });
  });

  test('includes admin-only lockout and password reset posture items', () => {
    const posture = buildUserSecurityPosture({
      id: 3,
      login: 'carol',
      level: 3,
      enable_basic_auth: true,
      enable_single_sign_on: true,
      enable_oauth2_auth: true,
      enable_multi_factor_auth: true,
      enable_new_login_notification: true,
      preferred_session_length: 1200,
      lockout: true,
      password_reset: true,
    }, 'admin');

    expect(posture).toMatchObject({
      status: 'locked',
      badgeTone: 'danger',
      criticalCount: 1,
      warningCount: 1,
    });
    expect(posture.items.map((item) => item.key)).toContain('lockout');
    expect(posture.items.map((item) => item.key)).toContain('password_reset');
  });

  test('parses impersonation session token response and truncates labels', () => {
    const session: UserSession = { id: 42, token_full: 'TOKEN' };
    expect(parseCreatedSessionToken(session)).toEqual({ sessionId: 42, tokenFull: 'TOKEN' });
    expect(parseCreatedSessionToken({ id: 42 })).toBeNull();
    expect(truncateLabel('abcdef', 4)).toBe('abc…');
  });
});
