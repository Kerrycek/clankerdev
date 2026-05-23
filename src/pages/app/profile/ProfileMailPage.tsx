import React from 'react';

import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { useAppMode } from '../../../app/appMode';

import { DetailShell } from '../../../components/layout/DetailShell';
import { PageHeader } from '../../../components/layout/PageHeader';

import { ErrorState } from '../../../components/ui/ErrorState';

import { UserMailPreferencesPanel } from '../../../components/user/UserMailPreferencesPanel';

import { ProfileTabs } from './ProfileTabs';

export function ProfileMailPage() {
  const auth = useAuth();
  const { basePath } = useAppMode();
  const { t } = useI18n();

  const userId = auth.user?.id;

  return (
    <DetailShell testId="profile.mail.page">
      <PageHeader
        testId="profile.mail.header"
        title={t('profile.page.title')}
        description={t('profile.mail.description')}
      />

      <ProfileTabs />

      {!userId ? (
        <ErrorState
          kindOverride="unauthorized"
          title={t('error.unauthorized.title')}
          body={t('error.unauthorized.body')}
          backTo={`${basePath}/`}
          showStatusLink={false}
          showDetails={false}
          testId="profile.mail.no_user"
        />
      ) : (
        <UserMailPreferencesPanel userId={userId} />
      )}
    </DetailShell>
  );
}
