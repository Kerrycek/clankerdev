import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';
import { fetchLanguages } from '../../lib/api/languages';
import { fetchUser, updateUser, type User } from '../../lib/api/users';
import { fetchUserMailRoleRecipients, fetchUserMailTemplateRecipients } from '../../lib/api/userMail';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { ErrorState } from '../ui/ErrorState';
import { LoadingState } from '../ui/LoadingState';

import { UserMailSettingsCard } from './UserMailSettingsCard';
import { MailRoleRecipientsTable, MailTemplateRecipientsCard } from './UserMailRecipientsTables';
import { buildMailSettingsPayload, filterMailTemplates, getUserLanguageId, type MailTemplateView } from './UserMailPreferencesModel';

export function UserMailPreferencesPanel(props: { userId: number; user?: User }) {
  const { t } = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();

  const userQ = useQuery({
    queryKey: ['users', props.userId],
    enabled: !props.user,
    queryFn: async () => (await fetchUser(props.userId)).data,
    staleTime: 30_000,
  });

  const user = props.user ?? userQ.data;

  const languagesQ = useQuery({
    queryKey: ['languages'],
    queryFn: async () => (await fetchLanguages({ limit: 500 })).data,
    staleTime: 60_000,
  });

  const roleQ = useQuery({
    queryKey: ['users', props.userId, 'mail_role_recipients'],
    queryFn: async () => (await fetchUserMailRoleRecipients(props.userId)).data,
    staleTime: 10_000,
  });

  const tplQ = useQuery({
    queryKey: ['users', props.userId, 'mail_template_recipients'],
    queryFn: async () => (await fetchUserMailTemplateRecipients(props.userId)).data,
    staleTime: 10_000,
  });

  const [mailerEnabled, setMailerEnabled] = useState(true);
  const [languageId, setLanguageId] = useState<string>('');
  const [tplView, setTplView] = useState<MailTemplateView>('all');
  const [tplNeedle, setTplNeedle] = useState('');

  useEffect(() => {
    if (!user) return;
    setMailerEnabled(user.mailer_enabled !== false);
    setLanguageId(getUserLanguageId(user));
  }, [user]);

  const storedMailerEnabled = user ? user.mailer_enabled !== false : true;
  const storedLanguageId = useMemo(() => getUserLanguageId(user), [user]);
  const settingsDirty = user ? mailerEnabled !== storedMailerEnabled || languageId !== storedLanguageId : false;

  const updateSettings = useMutation({
    mutationFn: async () => {
      if (!user) return;

      const payload = buildMailSettingsPayload({
        mailerEnabled,
        storedMailerEnabled,
        languageId,
        storedLanguageId,
      });

      return updateUser(props.userId, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      toasts.pushToast({ variant: 'ok', title: t('mail.prefs.toast.saved.title'), body: t('mail.prefs.toast.saved.body') });
    },
    onError: (error: unknown) => {
      toasts.pushToast({
        variant: 'danger',
        title: t('mail.prefs.toast.save_failed.title'),
        body: formatErrorMessage(error) || t('mail.prefs.toast.save_failed.body'),
      });
    },
  });

  const roleRecipients = roleQ.data ?? [];
  const templates = useMemo(
    () => filterMailTemplates({ templates: tplQ.data ?? [], view: tplView, needle: tplNeedle }),
    [tplQ.data, tplNeedle, tplView]
  );

  if (!props.user && userQ.isLoading) {
    return <LoadingState />;
  }

  if (!props.user && userQ.isError) {
    return <ErrorState error={userQ.error} onRetry={() => userQ.refetch()} />;
  }

  if (!user) {
    return <ErrorState kindOverride="not_found" title={t('mail.prefs.user_missing.title')} body={t('mail.prefs.user_missing.body')} />;
  }

  const userEmail = user.email ?? '';

  return (
    <div className="space-y-4">
      <Alert title={t('mail.prefs.precedence.title')} variant="info">
        {t('mail.prefs.precedence.body')}
      </Alert>

      <UserMailSettingsCard
        mailerEnabled={mailerEnabled}
        onMailerEnabledChange={setMailerEnabled}
        languageId={languageId}
        onLanguageIdChange={setLanguageId}
        languages={languagesQ.data ?? []}
        languagesLoading={languagesQ.isLoading}
        languagesError={languagesQ.isError}
        settingsDirty={settingsDirty}
        savePending={updateSettings.isPending}
        onSave={() => updateSettings.mutate()}
        userEmail={userEmail}
      />

      <MailRoleRecipientsTable
        userId={props.userId}
        userEmail={userEmail}
        roleRecipients={roleRecipients}
        isLoading={roleQ.isLoading}
        isError={roleQ.isError}
        error={roleQ.error}
        onRetry={() => roleQ.refetch()}
      />

      <MailTemplateRecipientsCard
        userId={props.userId}
        userEmail={userEmail}
        roleRecipients={roleRecipients}
        templates={templates}
        isLoading={tplQ.isLoading}
        isError={tplQ.isError}
        error={tplQ.error}
        onRetry={() => tplQ.refetch()}
        needle={tplNeedle}
        onNeedleChange={setTplNeedle}
        view={tplView}
        onViewChange={setTplView}
      />
    </div>
  );
}
