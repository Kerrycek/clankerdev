import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';

import { fetchUser, updateUser, type User } from '../../lib/api/users';
import { fetchUserTotpDevices, fetchUserWebauthnCredentials } from '../../lib/api/userDossier';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { SwitchRow } from '../ui/SwitchRow';

function boolField(user: User | undefined, key: string, fallback: boolean): boolean {
  const v = user ? (user as any)[key] : undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return fallback;
}

export function UserMfaMasterPanel(props: {
  userId: number;
  /** Optional user from a parent query/context. */
  user?: User;
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();

  const userQ = useQuery({
    queryKey: ['users', props.userId],
    queryFn: async () => (await fetchUser(props.userId)).data,
    enabled: !props.user,
    staleTime: 30_000,
  });

  const user = props.user ?? userQ.data;

  const totpQ = useQuery({
    queryKey: ['users', props.userId, 'totp_devices'],
    queryFn: async () => (await fetchUserTotpDevices(props.userId)).data,
    staleTime: 30_000,
  });

  const webauthnQ = useQuery({
    queryKey: ['users', props.userId, 'webauthn_credentials'],
    queryFn: async () => (await fetchUserWebauthnCredentials(props.userId)).data,
    staleTime: 30_000,
  });

  const masterEnabled = boolField(user, 'enable_multi_factor_auth', false);

  const enabledDeviceCount = useMemo(() => {
    const totp = Array.isArray(totpQ.data) ? totpQ.data : [];
    const creds = Array.isArray(webauthnQ.data) ? webauthnQ.data : [];

    const enabledTotp = totp.filter((d: any) => d && d.confirmed && d.enabled).length;
    const enabledCreds = creds.filter((c: any) => c && c.enabled).length;

    return {
      enabledTotp,
      enabledCreds,
      enabledTotal: enabledTotp + enabledCreds,
      total: totp.length + creds.length,
    };
  }, [totpQ.data, webauthnQ.data]);

  const status = !masterEnabled
    ? { variant: 'neutral' as const, label: t('security.mfa_master.status.disabled') }
    : enabledDeviceCount.enabledTotal > 0
      ? { variant: 'ok' as const, label: t('security.mfa_master.status.active') }
      : { variant: 'warn' as const, label: t('security.mfa_master.status.inactive') };

  const toggleM = useMutation({
    mutationFn: async (next: boolean) => {
      await updateUser(props.userId, { enable_multi_factor_auth: next });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      toasts.pushToast({ variant: 'ok', title: t('security.mfa_master.toast.saved.title'), body: t('security.mfa_master.toast.saved.body') });
    },
    onError: (e) => {
      toasts.pushToast({ variant: 'danger', title: t('security.mfa_master.toast.failed.title'), body: formatErrorMessage(e) });
    },
  });

  const prefix = props.testIdPrefix;

  return (
    <Card testId={`${prefix}.mfa_master.card`}>
      <CardHeader title={t('security.mfa_master.title')} subtitle={t('security.mfa_master.subtitle')} />
      <CardBody>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2" data-testid={`${prefix}.mfa_master.status`}>
            <Badge variant={status.variant}>{status.label}</Badge>
            <div className="text-xs text-muted">
              {t('security.mfa_master.devices', {
                enabled: enabledDeviceCount.enabledTotal,
                total: enabledDeviceCount.total,
              })}
            </div>
          </div>

          <SwitchRow
            label={t('security.mfa_master.switch.label')}
            description={t('security.mfa_master.switch.desc')}
            checked={masterEnabled}
            onChange={(v) => toggleM.mutate(v)}
            disabled={toggleM.isPending}
            testId={`${prefix}.mfa_master.switch`}
          />

          {masterEnabled && enabledDeviceCount.enabledTotal === 0 ? (
            <Alert variant="warn" title={t('security.mfa_master.inactive.title')}>
              {t('security.mfa_master.inactive.body')}
            </Alert>
          ) : null}

          {!masterEnabled && enabledDeviceCount.enabledTotal > 0 ? (
            <Alert variant="info" title={t('security.mfa_master.devices_present.title')}>
              {t('security.mfa_master.devices_present.body')}
            </Alert>
          ) : null}

          {toggleM.isError ? (
            <div className="text-xs text-muted">
              {t('security.mfa_master.last_error')}: {formatErrorMessage(toggleM.error)}
            </div>
          ) : null}

          <div className="text-xs text-faint">
            {t('security.mfa_master.note')}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                // Refetch everything related to the MFA status.
                void qc.invalidateQueries({ queryKey: ['users', props.userId] });
                void qc.invalidateQueries({ queryKey: ['users', props.userId, 'totp_devices'] });
                void qc.invalidateQueries({ queryKey: ['users', props.userId, 'webauthn_credentials'] });
              }}
              testId={`${prefix}.mfa_master.refresh`}
            >
              {t('common.refresh')}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
