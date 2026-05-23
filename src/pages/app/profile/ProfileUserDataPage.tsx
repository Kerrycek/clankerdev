import React from 'react';

import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';

import { DetailShell } from '../../../components/layout/DetailShell';
import { PageHeader } from '../../../components/layout/PageHeader';

import { UserDataTemplatesPanel } from '../../../components/user/UserDataTemplatesPanel';

import { ProfileTabs } from './ProfileTabs';

export function ProfileUserDataPage() {
  const { t } = useI18n();
  const auth = useAuth();

  return (
    <DetailShell
      testId="profile.user_data"
      variant="narrow"
      header={
        <PageHeader
          title={t('profile.page.title')}
          description={t('user_data.page.description')}
        />
      }
      tabs={<ProfileTabs active="user_data" />}
    >
      <UserDataTemplatesPanel
        testIdPrefix="profile.user_data"
        // For admins, keep profile views scoped to "me".
        userIdForAdmin={auth.user?.id}
        createForUserId={auth.user?.id}
      />
    </DetailShell>
  );
}
