import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';
import { updateUser, type User } from '../../lib/api/users';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { SwitchRow } from '../ui/SwitchRow';

import {
  buildSecuritySettingsPayload,
  buildSecuritySettingsReview,
  buildStoredSecuritySettings,
  draftFromStoredSecuritySettings,
  type SecuritySettingsDraft,
} from './UserSecurityModel';
import { UserSecuritySettingsReviewCard } from './UserSecurityReviewCards';

export function UserSecuritySettingsCard(props: {
  userId: number;
  user?: User;
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();

  const stored = useMemo(() => buildStoredSecuritySettings(props.user), [props.user]);

  const [enableBasicAuth, setEnableBasicAuth] = useState(stored.basic);
  const [enableTokenAuth, setEnableTokenAuth] = useState(stored.token);
  const [enableSingleSignOn, setEnableSingleSignOn] = useState(stored.sso);
  const [enableNewLoginNotif, setEnableNewLoginNotif] = useState(stored.notif);
  const [preferredSessionMin, setPreferredSessionMin] = useState(stored.sessMin);
  const [preferredLogoutAll, setPreferredLogoutAll] = useState(stored.logoutAll);

  useEffect(() => {
    setEnableBasicAuth(stored.basic);
    setEnableTokenAuth(stored.token);
    setEnableSingleSignOn(stored.sso);
    setEnableNewLoginNotif(stored.notif);
    setPreferredSessionMin(stored.sessMin);
    setPreferredLogoutAll(stored.logoutAll);
  }, [stored.basic, stored.token, stored.sso, stored.notif, stored.sessMin, stored.logoutAll]);

  const draft: SecuritySettingsDraft = useMemo(
    () => ({
      basic: enableBasicAuth,
      token: enableTokenAuth,
      sso: enableSingleSignOn,
      notif: enableNewLoginNotif,
      sessMin: preferredSessionMin,
      logoutAll: preferredLogoutAll,
    }),
    [enableBasicAuth, enableTokenAuth, enableSingleSignOn, enableNewLoginNotif, preferredSessionMin, preferredLogoutAll]
  );
  const review = useMemo(() => buildSecuritySettingsReview(stored, draft), [stored, draft]);

  const reset = () => {
    const next = draftFromStoredSecuritySettings(stored);
    setEnableBasicAuth(next.basic);
    setEnableTokenAuth(next.token);
    setEnableSingleSignOn(next.sso);
    setEnableNewLoginNotif(next.notif);
    setPreferredSessionMin(next.sessMin);
    setPreferredLogoutAll(next.logoutAll);
  };

  const settingsM = useMutation({
    mutationFn: async () => {
      const result = buildSecuritySettingsPayload(stored, draft);
      if (!result.valid) throw new Error(t(result.validationKey));
      if (Object.keys(result.payload).length === 0) return;
      await updateUser(props.userId, result.payload);
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

  const prefix = props.testIdPrefix;

  return (
    <Card testId={`${prefix}.settings.card`}>
      <CardHeader title={t('security.settings.title')} subtitle={t('security.settings.subtitle')} />
      <CardBody>
        <div className="space-y-3">
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
                <Badge variant={stored.oauth2 ? 'ok' : 'warn'}>{stored.oauth2 ? t('common.enabled') : t('common.disabled')}</Badge>
                {!stored.oauth2 ? (
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

          <UserSecuritySettingsReviewCard prefix={prefix} review={review} />

          {!review.sessionParse.valid ? (
            <Alert variant="warn" title={t('security.settings.review.validation.title')} testId={`${prefix}.settings.session_length.validation`}>
              {t(review.sessionParse.validationKey)}
            </Alert>
          ) : null}

          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={() => settingsM.mutate()}
              loading={settingsM.isPending}
              disabled={!review.canSubmit || settingsM.isPending}
              testId={`${prefix}.settings.save`}
            >
              {t('common.save')}
            </Button>

            <Button
              variant="secondary"
              onClick={reset}
              disabled={!review.hasChanges || settingsM.isPending}
              testId={`${prefix}.settings.reset`}
            >
              {t('common.reset')}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
