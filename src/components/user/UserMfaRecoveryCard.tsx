import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';

import {
  fetchUserKnownDevices,
  fetchUserTotpDevices,
  fetchUserWebauthnCredentials,
} from '../../lib/api/userDossier';
import type { User } from '../../lib/api/users';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Spinner } from '../ui/Spinner';

import { buildMfaRecoverySummary, type MfaRecoveryTone } from './UserMfaRecoveryModel';

function toneToBadgeVariant(tone: MfaRecoveryTone): 'ok' | 'neutral' | 'info' | 'warn' | 'danger' {
  return tone;
}

export function UserMfaRecoveryCard(props: {
  userId: number;
  user?: User;
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const prefix = props.testIdPrefix;

  const totpQ = useQuery({
    queryKey: ['users', props.userId, 'totp_devices'],
    queryFn: async () => (await fetchUserTotpDevices(props.userId, { limit: 200 })).data,
    staleTime: 30_000,
  });

  const webauthnQ = useQuery({
    queryKey: ['users', props.userId, 'webauthn_credentials'],
    queryFn: async () => (await fetchUserWebauthnCredentials(props.userId, { limit: 200 })).data,
    staleTime: 30_000,
  });

  const knownDevicesQ = useQuery({
    queryKey: ['users', props.userId, 'known_devices', 'recovery'],
    queryFn: async () => (await fetchUserKnownDevices(props.userId, { limit: 100 })).data,
    staleTime: 30_000,
  });

  const summary = useMemo(
    () =>
      buildMfaRecoverySummary({
        user: props.user,
        totpDevices: totpQ.data,
        webauthnCredentials: webauthnQ.data,
        knownDevices: knownDevicesQ.data,
      }),
    [knownDevicesQ.data, props.user, totpQ.data, webauthnQ.data]
  );

  const loading = totpQ.isLoading || webauthnQ.isLoading || knownDevicesQ.isLoading;
  const error = totpQ.error ?? webauthnQ.error ?? knownDevicesQ.error;

  const actions = (
    <div className="flex items-center gap-2">
      <Badge variant={toneToBadgeVariant(summary.statusTone)} testId={`${prefix}.recovery.status`}>
        {t(`profile.mfa.recovery.status.${summary.status}`)}
      </Badge>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          void qc.invalidateQueries({ queryKey: ['users', props.userId, 'totp_devices'] });
          void qc.invalidateQueries({ queryKey: ['users', props.userId, 'webauthn_credentials'] });
          void qc.invalidateQueries({ queryKey: ['users', props.userId, 'known_devices'] });
        }}
        testId={`${prefix}.recovery.refresh`}
      >
        {t('common.refresh')}
      </Button>
    </div>
  );

  if (!loading && !error && summary.status === 'ready') {
    return (
      <div
        className="flex flex-col gap-2 rounded-lg border border-ok/30 bg-ok/10 p-3 sm:flex-row sm:items-center sm:justify-between"
        data-testid={`${prefix}.recovery.ready`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="ok" testId={`${prefix}.recovery.status`}>
              {t('profile.mfa.recovery.status.ready')}
            </Badge>
            <div className="text-sm font-medium text-fg">{t('profile.mfa.recovery.alert.ready.title')}</div>
          </div>
          <div className="mt-1 text-xs text-muted">{t('profile.mfa.recovery.alert.ready.body')}</div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void qc.invalidateQueries({ queryKey: ['users', props.userId, 'totp_devices'] });
            void qc.invalidateQueries({ queryKey: ['users', props.userId, 'webauthn_credentials'] });
            void qc.invalidateQueries({ queryKey: ['users', props.userId, 'known_devices'] });
          }}
          testId={`${prefix}.recovery.refresh`}
        >
          {t('common.refresh')}
        </Button>
      </div>
    );
  }

  return (
    <Card testId={`${prefix}.recovery.card`}>
      <CardHeader
        title={t('profile.mfa.recovery.title')}
        subtitle={t('profile.mfa.recovery.subtitle')}
        actions={actions}
      />
      <CardBody>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : error ? (
          <Alert variant="danger" title={t('profile.mfa.recovery.load_failed')}>
            {formatErrorMessage(error)}
          </Alert>
        ) : (
          <div className="space-y-4">
            <Alert variant={summary.statusTone} title={t(`profile.mfa.recovery.alert.${summary.status}.title`)}>
              {t(`profile.mfa.recovery.alert.${summary.status}.body`)}
            </Alert>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid={`${prefix}.recovery.metrics`}>
              <div className="rounded-md border border-border bg-surface-2 p-3">
                <div className="text-xs text-muted">{t('profile.mfa.recovery.metric.active_factors')}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{summary.counts.activeFactors}</div>
              </div>
              <div className="rounded-md border border-border bg-surface-2 p-3">
                <div className="text-xs text-muted">{t('profile.mfa.recovery.metric.totp')}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{summary.counts.enabledTotp}</div>
              </div>
              <div className="rounded-md border border-border bg-surface-2 p-3">
                <div className="text-xs text-muted">{t('profile.mfa.recovery.metric.passkeys')}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{summary.counts.enabledPasskeys}</div>
              </div>
              <div className="rounded-md border border-border bg-surface-2 p-3">
                <div className="text-xs text-muted">{t('profile.mfa.recovery.metric.trusted_devices')}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{summary.counts.activeTrustedDevices}</div>
              </div>
            </div>

            <div className="space-y-2" data-testid={`${prefix}.recovery.checklist`}>
              {summary.checklist.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3 sm:flex-row sm:items-start"
                  data-testid={`${prefix}.recovery.check.${item.key}`}
                >
                  <div className="shrink-0">
                    <Badge variant={toneToBadgeVariant(item.tone)}>
                      {t(`profile.mfa.recovery.check.${item.key}.label`)}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted">
                    {t(item.messageKey, {
                      active: summary.counts.activeFactors,
                      paths: summary.counts.recoveryPaths,
                      pending: summary.counts.pendingTotp,
                      trusted: summary.counts.activeTrustedDevices,
                      totalTrusted: summary.counts.totalKnownDevices,
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
