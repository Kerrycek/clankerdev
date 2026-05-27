import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getRuntimeConfig } from '../../app/config';
import { useI18n } from '../../app/i18n';
import { useAppMode } from '../../app/appMode';
import { useToasts } from '../../app/toasts';

import { updateUser, type User } from '../../lib/api/users';
import { createUserSessionToken } from '../../lib/api/userDossier';
import { computeOtherModeUrl } from '../../lib/modeSwitch';
import { clearImpersonationState, isImpersonating, writeImpersonationState } from '../../lib/auth/impersonation';
import { formatErrorMessage } from '../../lib/errors';
import { withRouterBasename } from '../../lib/routerPaths';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SwitchRow } from '../ui/SwitchRow';
import { Textarea } from '../ui/Textarea';

function boolField(user: User | undefined, key: string, fallback: boolean): boolean {
  const v = user ? (user as any)[key] : undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return fallback;
}

function intField(user: User | undefined, key: string, fallback: number): number {
  const v = user ? (user as any)[key] : undefined;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (Number.isFinite(n)) return n;
  return fallback;
}

function secondsToMinutesString(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0';
  return String(Math.round(seconds / 60));
}

function minutesToSeconds(minutesRaw: string): number {
  const n = Number(minutesRaw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 60);
}

function truncateLabel(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

export type UserSecurityVariant = 'profile' | 'admin';

export function UserSecurityPanel(props: {
  userId: number;
  user?: User;
  variant: UserSecurityVariant;
  /** Test id prefix, e.g. "profile.security" or "admin.user.security" */
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();
  const location = useLocation();
  const mode = useAppMode();

  const user = props.user;

  // ----- Password -----------------------------------------------------------

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [logoutSessions, setLogoutSessions] = useState(true);

  const passwordM = useMutation({
    mutationFn: async () => {
      const np = newPassword;
      const np2 = newPassword2;

      if (!np.trim()) throw new Error(t('security.password.validation.new_required'));
      if (np !== np2) throw new Error(t('security.password.validation.mismatch'));

      const payload: Record<string, unknown> = {
        new_password: np,
        logout_sessions: logoutSessions,
      };

      if (props.variant === 'profile') {
        if (!currentPassword.trim()) throw new Error(t('security.password.validation.current_required'));
        payload['password'] = currentPassword;
      }

      await updateUser(props.userId, payload);
    },
    onSuccess: async () => {
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      toasts.pushToast({ variant: 'ok', title: t('security.password.toast.saved.title'), body: t('security.password.toast.saved.body') });
    },
    onError: (e) => {
      toasts.pushToast({ variant: 'danger', title: t('security.password.toast.failed.title'), body: formatErrorMessage(e) });
    },
  });

  // ----- Security settings / auth methods ----------------------------------

  const [enableBasicAuth, setEnableBasicAuth] = useState(false);
  const [enableTokenAuth, setEnableTokenAuth] = useState(true);
  const [enableSingleSignOn, setEnableSingleSignOn] = useState(true);
  const [enableNewLoginNotif, setEnableNewLoginNotif] = useState(true);
  const [preferredSessionMin, setPreferredSessionMin] = useState('20');
  const [preferredLogoutAll, setPreferredLogoutAll] = useState(false);

  const oauth2Enabled = boolField(user, 'enable_oauth2_auth', true);

  const stored = useMemo(() => {
    return {
      basic: boolField(user, 'enable_basic_auth', false),
      token: boolField(user, 'enable_token_auth', true),
      sso: boolField(user, 'enable_single_sign_on', true),
      notif: boolField(user, 'enable_new_login_notification', true),
      sessMin: secondsToMinutesString(intField(user, 'preferred_session_length', 20 * 60)),
      logoutAll: boolField(user, 'preferred_logout_all', false),
      oauth2: oauth2Enabled,
    };
  }, [user, oauth2Enabled]);

  useEffect(() => {
    setEnableBasicAuth(stored.basic);
    setEnableTokenAuth(stored.token);
    setEnableSingleSignOn(stored.sso);
    setEnableNewLoginNotif(stored.notif);
    setPreferredSessionMin(stored.sessMin);
    setPreferredLogoutAll(stored.logoutAll);
  }, [stored.basic, stored.token, stored.sso, stored.notif, stored.sessMin, stored.logoutAll]);

  const settingsDirty =
    enableBasicAuth !== stored.basic ||
    enableTokenAuth !== stored.token ||
    enableSingleSignOn !== stored.sso ||
    enableNewLoginNotif !== stored.notif ||
    preferredSessionMin !== stored.sessMin ||
    preferredLogoutAll !== stored.logoutAll;

  const settingsM = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {};

      if (enableBasicAuth !== stored.basic) payload['enable_basic_auth'] = enableBasicAuth;
      if (enableTokenAuth !== stored.token) payload['enable_token_auth'] = enableTokenAuth;
      if (enableSingleSignOn !== stored.sso) payload['enable_single_sign_on'] = enableSingleSignOn;
      if (enableNewLoginNotif !== stored.notif) payload['enable_new_login_notification'] = enableNewLoginNotif;
      if (preferredLogoutAll !== stored.logoutAll) payload['preferred_logout_all'] = preferredLogoutAll;

      const nextSessionSeconds = minutesToSeconds(preferredSessionMin);
      const storedSessionSeconds = minutesToSeconds(stored.sessMin);
      if (nextSessionSeconds !== storedSessionSeconds) payload['preferred_session_length'] = nextSessionSeconds;

      if (Object.keys(payload).length === 0) return;
      await updateUser(props.userId, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      toasts.pushToast({ variant: 'ok', title: t('security.settings.toast.saved.title'), body: t('security.settings.toast.saved.body') });
    },
    onError: (e) => {
      toasts.pushToast({ variant: 'danger', title: t('security.settings.toast.failed.title'), body: formatErrorMessage(e) });
    },
  });

  const oauth2EnableM = useMutation({
    mutationFn: async () => {
      await updateUser(props.userId, { enable_oauth2_auth: true });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      toasts.pushToast({ variant: 'ok', title: t('security.settings.oauth2.enabled.title'), body: t('security.settings.oauth2.enabled.body') });
    },
    onError: (e) => {
      toasts.pushToast({ variant: 'danger', title: t('security.settings.oauth2.enable_failed.title'), body: formatErrorMessage(e) });
    },
  });

  // ----- Admin flags --------------------------------------------------------

  const [lockout, setLockout] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);

  const storedLockout = boolField(user, 'lockout', false);
  const storedPasswordReset = boolField(user, 'password_reset', false);

  useEffect(() => {
    setLockout(storedLockout);
    setPasswordReset(storedPasswordReset);
  }, [storedLockout, storedPasswordReset]);

  const flagM = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await updateUser(props.userId, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      toasts.pushToast({ variant: 'ok', title: t('security.flags.toast.saved.title'), body: t('security.flags.toast.saved.body') });
    },
    onError: (e) => {
      toasts.pushToast({ variant: 'danger', title: t('security.flags.toast.failed.title'), body: formatErrorMessage(e) });
    },
  });

  const [confirmLockout, setConfirmLockout] = useState(false);

  // ----- Impersonation ------------------------------------------------------

  const [impOpen, setImpOpen] = useState(false);
  const [impReason, setImpReason] = useState('');

  const storage = typeof window !== 'undefined' ? window.sessionStorage : undefined;
  const alreadyImpersonating = isImpersonating(storage);

  const cfg = getRuntimeConfig();
  const canImpersonate = cfg.auth.kind === 'oauth2' && !alreadyImpersonating;

  const impM = useMutation({
    mutationFn: async () => {
      const reason = impReason.trim();
      if (!reason) throw new Error(t('security.impersonation.validation.reason_required'));

      const label = truncateLabel(`Impersonation: ${reason}`, 180);

      const res = await createUserSessionToken({
        userId: props.userId,
        label,
        token_lifetime: 'renewable_auto',
        token_interval: 20 * 60,
        scope: 'all',
      });

      const tokenFull = (res.data as any)?.token_full;
      const sessionId = (res.data as any)?.id;

      if (!tokenFull || !sessionId) {
        throw new Error(t('security.impersonation.validation.bad_token'));
      }

      // Clear any stale switch state first.
      clearImpersonationState(storage);

      writeImpersonationState(
        {
          kind: 'impersonation',
          sessionId: Number(sessionId),
          sessionToken: String(tokenFull),
          targetUserId: props.userId,
          targetLogin: user?.login ? String(user.login) : undefined,
          reason,
          startedAt: Date.now(),
          returnPath: `${location.pathname}${location.search}${location.hash}`,
          returnMode: mode.mode,
        },
        storage
      );

      // Switch to user mode (safe fallback for admin-only pages).
      const next = computeOtherModeUrl({
        mode: 'admin',
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      });

      window.location.assign(withRouterBasename(next, getRuntimeConfig().routerBasename));
    },
    onError: (e) => {
      toasts.pushToast({
        variant: 'danger',
        title: t('security.impersonation.toast.failed.title'),
        body: formatErrorMessage(e),
      });
    },
  });

  const prefix = props.testIdPrefix;

  return (
    <div className="space-y-4" data-testid={`${prefix}.panel`}>
      <Card testId={`${prefix}.password.card`}>
        <CardHeader
          title={t('security.password.title')}
          subtitle={
            props.variant === 'profile'
              ? t('security.password.subtitle_self')
              : t('security.password.subtitle_admin')
          }
        />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {props.variant === 'profile' ? (
              <div className="md:col-span-2">
                <div className="text-xs font-medium text-muted">{t('security.password.current')}</div>
                <div className="mt-1">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    testId={`${prefix}.password.current`}
                  />
                </div>
              </div>
            ) : null}

            <div>
              <div className="text-xs font-medium text-muted">{t('security.password.new')}</div>
              <div className="mt-1">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  testId={`${prefix}.password.new`}
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-muted">{t('security.password.new_repeat')}</div>
              <div className="mt-1">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  testId={`${prefix}.password.new2`}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm" data-testid={`${prefix}.password.logout_sessions`}>
                <Checkbox checked={logoutSessions} onCheckedChange={(v) => setLogoutSessions(Boolean(v))} />
                <span>{t('security.password.logout_sessions')}</span>
              </label>
              <div className="mt-1 text-xs text-faint">{t('security.password.logout_sessions.hint')}</div>
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <Button
                onClick={() => passwordM.mutate()}
                loading={passwordM.isPending}
                disabled={passwordM.isPending}
                testId={`${prefix}.password.save`}
              >
                {t('common.save')}
              </Button>

              <Button
                variant="secondary"
                onClick={() => {
                  setCurrentPassword('');
                  setNewPassword('');
                  setNewPassword2('');
                  setLogoutSessions(true);
                }}
                disabled={passwordM.isPending}
                testId={`${prefix}.password.reset`}
              >
                {t('common.reset')}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card testId={`${prefix}.settings.card`}>
        <CardHeader title={t('security.settings.title')} subtitle={t('security.settings.subtitle')} />
        <CardBody>
          <div className="space-y-2">
            <SwitchRow
              label={t('security.settings.auth.basic.label')}
              description={t('security.settings.auth.basic.desc')}
              checked={enableBasicAuth}
              onChange={setEnableBasicAuth}
              testId={`${prefix}.settings.basic`}
            />

            <SwitchRow
              label={t('security.settings.auth.token.label')}
              description={t('security.settings.auth.token.desc')}
              checked={enableTokenAuth}
              onChange={setEnableTokenAuth}
              testId={`${prefix}.settings.token`}
            />

            <div className="rounded-md border border-border bg-surface-2 px-3 py-2" data-testid={`${prefix}.settings.oauth2`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-fg">{t('security.settings.auth.oauth2.label')}</div>
                  <div className="mt-0.5 text-xs text-muted">{t('security.settings.auth.oauth2.desc')}</div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <Badge variant={oauth2Enabled ? 'ok' : 'warn'}>{oauth2Enabled ? t('common.enabled') : t('common.disabled')}</Badge>
                  {!oauth2Enabled ? (
                    <Button
                      size="sm"
                      variant="warn"
                      onClick={() => oauth2EnableM.mutate()}
                      loading={oauth2EnableM.isPending}
                      disabled={oauth2EnableM.isPending}
                      testId={`${prefix}.settings.oauth2.enable`}
                    >
                      {t('security.settings.auth.oauth2.enable')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <SwitchRow
              label={t('security.settings.sso.label')}
              description={t('security.settings.sso.desc')}
              checked={enableSingleSignOn}
              onChange={setEnableSingleSignOn}
              testId={`${prefix}.settings.sso`}
            />

            <SwitchRow
              label={t('security.settings.new_login.label')}
              description={t('security.settings.new_login.desc')}
              checked={enableNewLoginNotif}
              onChange={setEnableNewLoginNotif}
              testId={`${prefix}.settings.new_login`}
            />

            <div className="rounded-md border border-border bg-surface-2 px-3 py-2" data-testid={`${prefix}.settings.session_length`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-fg">{t('security.settings.session_length.label')}</div>
                  <div className="mt-0.5 text-xs text-muted">{t('security.settings.session_length.desc')}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={preferredSessionMin}
                    onChange={(e) => setPreferredSessionMin(e.target.value)}
                    className="w-24"
                    testId={`${prefix}.settings.session_length.input`}
                  />
                  <span className="text-xs text-faint">{t('security.settings.session_length.unit')}</span>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {[0, 20, 60, 240].map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant="secondary"
                    onClick={() => setPreferredSessionMin(String(m))}
                    testId={`${prefix}.settings.session_length.preset.${m}`}
                  >
                    {m === 0 ? t('security.settings.session_length.preset.never') : t('security.settings.session_length.preset.minutes', { m })}
                  </Button>
                ))}
              </div>
            </div>

            <SwitchRow
              label={t('security.settings.logout_all.label')}
              description={t('security.settings.logout_all.desc')}
              checked={preferredLogoutAll}
              onChange={setPreferredLogoutAll}
              testId={`${prefix}.settings.logout_all`}
            />

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={() => settingsM.mutate()}
                loading={settingsM.isPending}
                disabled={!settingsDirty || settingsM.isPending}
                testId={`${prefix}.settings.save`}
              >
                {t('common.save')}
              </Button>

              <Button
                variant="secondary"
                onClick={() => {
                  setEnableBasicAuth(stored.basic);
                  setEnableTokenAuth(stored.token);
                  setEnableSingleSignOn(stored.sso);
                  setEnableNewLoginNotif(stored.notif);
                  setPreferredSessionMin(stored.sessMin);
                  setPreferredLogoutAll(stored.logoutAll);
                }}
                disabled={!settingsDirty || settingsM.isPending}
                testId={`${prefix}.settings.reset`}
              >
                {t('common.reset')}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {props.variant === 'admin' ? (
        <Card testId={`${prefix}.flags.card`}>
          <CardHeader title={t('security.flags.title')} subtitle={t('security.flags.subtitle')} />
          <CardBody>
            <div className="space-y-2">
              <SwitchRow
                label={t('security.flags.password_reset.label')}
                description={t('security.flags.password_reset.desc')}
                checked={passwordReset}
                onChange={(v) => {
                  setPasswordReset(v);
                  flagM.mutate({ password_reset: v });
                }}
                disabled={flagM.isPending}
                testId={`${prefix}.flags.password_reset`}
              />

              <SwitchRow
                label={t('security.flags.lockout.label')}
                description={t('security.flags.lockout.desc')}
                checked={lockout}
                onChange={(v) => {
                  if (v) {
                    // Require confirmation when locking an account.
                    setConfirmLockout(true);
                  } else {
                    setLockout(false);
                    flagM.mutate({ lockout: false });
                  }
                }}
                disabled={flagM.isPending}
                testId={`${prefix}.flags.lockout`}
              />

              {lockout ? (
                <Alert variant="warn" title={t('security.flags.lockout.active_title')}>
                  {t('security.flags.lockout.active_body')}
                </Alert>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {props.variant === 'admin' ? (
        <Card testId={`${prefix}.impersonation.card`}>
          <CardHeader title={t('security.impersonation.title')} subtitle={t('security.impersonation.subtitle')} />
          <CardBody>
            {alreadyImpersonating ? (
              <Alert variant="warn" title={t('security.impersonation.blocked.title')}>
                {t('security.impersonation.blocked.body')}
              </Alert>
            ) : cfg.auth.kind !== 'oauth2' ? (
              <Alert variant="warn" title={t('security.impersonation.oauth_required.title')}>
                {t('security.impersonation.oauth_required.body')}
              </Alert>
            ) : (
              <>
                <div className="text-sm text-muted">{t('security.impersonation.body')}</div>
                <div className="mt-3">
                  <Button
                    variant="warn"
                    onClick={() => setImpOpen(true)}
                    disabled={!canImpersonate}
                    testId={`${prefix}.impersonation.open`}
                  >
                    {t('security.impersonation.open')}
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmLockout}
        title={t('security.flags.lockout.confirm.title')}
        description={t('security.flags.lockout.confirm.body')}
        confirmLabel={t('security.flags.lockout.confirm.confirm')}
        danger
        confirmLoading={flagM.isPending}
        onCancel={() => {
          setConfirmLockout(false);
          // Keep the old value.
          setLockout(storedLockout);
        }}
        onConfirm={() => {
          setConfirmLockout(false);
          setLockout(true);
          flagM.mutate({ lockout: true });
        }}
        testId={`${prefix}.flags.lockout.confirm`}
      />

      <Modal
        open={impOpen}
        title={t('security.impersonation.modal.title')}
        onClose={() => {
          if (impM.isPending) return;
          setImpOpen(false);
          setImpReason('');
        }}
        testId={`${prefix}.impersonation.modal`}
      >
        <div className="space-y-3">
          <Alert variant="warn" title={t('security.impersonation.modal.warning.title')}>
            {t('security.impersonation.modal.warning.body')}
          </Alert>

          <div>
            <div className="text-xs font-medium text-muted">{t('security.impersonation.modal.reason')}</div>
            <div className="mt-1">
              <Textarea
                value={impReason}
                onChange={(e) => setImpReason(e.target.value)}
                rows={4}
                testId={`${prefix}.impersonation.modal.reason_input`}
              />
            </div>
            <div className="mt-1 text-xs text-faint">{t('security.impersonation.modal.reason_hint')}</div>
          </div>

          {impM.isError ? (
            <Alert variant="danger" title={t('security.impersonation.toast.failed.title')}>
              {formatErrorMessage(impM.error)}
            </Alert>
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              variant="warn"
              onClick={() => impM.mutate()}
              loading={impM.isPending}
              disabled={impM.isPending}
              testId={`${prefix}.impersonation.modal.confirm`}
            >
              {t('security.impersonation.modal.confirm')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (impM.isPending) return;
                setImpOpen(false);
                setImpReason('');
              }}
              disabled={impM.isPending}
              testId={`${prefix}.impersonation.modal.cancel`}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
