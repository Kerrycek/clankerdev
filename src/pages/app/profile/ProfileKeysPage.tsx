import React from 'react';

import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';

import { DetailShell } from '../../../components/layout/DetailShell';
import { PageHeader } from '../../../components/layout/PageHeader';

import { UserPublicKeysPanel } from '../../../components/user/UserPublicKeysPanel';

import { Spinner } from '../../../components/ui/Spinner';

import { ProfileTabs } from './ProfileTabs';

export function ProfileKeysPage() {
  const auth = useAuth();
  const { t } = useI18n();

  const userId = auth.user?.id ?? null;

  return (
    <DetailShell
      testId="profile.keys.page"
      variant="narrow"
      header={<PageHeader title={t('profile.page.title')} description={t('profile.keys.subtitle')} />}
      tabs={<ProfileTabs />}
    >
      {!userId ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <UserPublicKeysPanel userId={userId} testIdPrefix="profile.keys" />
      )}
    </DetailShell>
  );
}
