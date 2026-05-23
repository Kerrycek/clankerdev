import React from 'react';

import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';

import { DetailShell } from '../../../components/layout/DetailShell';
import { PageHeader } from '../../../components/layout/PageHeader';

import { UserSecurityPanel } from '../../../components/user/UserSecurityPanel';

import { Spinner } from '../../../components/ui/Spinner';

import { ProfileTabs } from './ProfileTabs';

export function ProfileSecurityPage() {
  const auth = useAuth();
  const { t } = useI18n();

  const userId = auth.user?.id ?? null;

  return (
    <DetailShell
      testId="profile.security.page"
      variant="narrow"
      header={<PageHeader title={t('profile.page.title')} description={t('profile.security.subtitle')} />}
      tabs={<ProfileTabs />}
    >
      {!userId ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <UserSecurityPanel
            userId={userId}
            user={auth.user ?? undefined}
            variant="profile"
            testIdPrefix="profile.security"
          />
        </div>
      )}
    </DetailShell>
  );
}
