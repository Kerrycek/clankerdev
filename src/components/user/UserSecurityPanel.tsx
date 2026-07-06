import React, { useEffect, useState } from 'react';
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
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Modal } from '../ui/Modal';
import { SwitchRow } from '../ui/SwitchRow';
import { Textarea } from '../ui/Textarea';

import {
  parseCreatedSessionToken,
  truncateLabel,
  userBooleanField,
  type UserSecurityVariant,
} from './UserSecurityModel';
import { UserSecurityPasswordCard } from './UserSecurityPasswordCard';
import { UserSecurityPostureCard } from './UserSecurityPostureCard';
import { UserSecuritySettingsCard } from './UserSecuritySettingsCard';

export type { UserSecurityVariant } from './UserSecurityModel';

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

  const [lockout, setLockout] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);

  const storedLockout = userBooleanField(user, 'lockout', false);
  const storedPasswordReset = userBooleanField(user, 'password_reset', false);

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

      const parsedSession = parseCreatedSessionToken(res.data);
      if (!parsedSession) {
        throw new Error(t('security.impersonation.validation.bad_token'));
      }

      clearImpersonationState(storage);

      writeImpersonationState(
        {
          kind: 'impersonation',
          sessionId: parsedSession.sessionId,
          sessionToken: parsedSession.tokenFull,
          targetUserId: props.userId,
          targetLogin: user?.login ? String(user.login) : undefined,
          reason,
          startedAt: Date.now(),
          returnPath: `${location.pathname}${location.search}${location.hash}`,
          returnMode: mode.mode,
        },
        storage
      );

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
      <UserSecurityPostureCard user={user} variant={props.variant} testIdPrefix={prefix} />

      <UserSecurityPasswordCard userId={props.userId} variant={props.variant} testIdPrefix={prefix} />

      <UserSecuritySettingsCard userId={props.userId} user={user} testIdPrefix={prefix} />

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
