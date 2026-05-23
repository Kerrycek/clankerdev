import React from 'react';

import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';

import { DetailShell } from '../../../components/layout/DetailShell';
import { PageHeader } from '../../../components/layout/PageHeader';

import { UserMetricsTokensPanel } from '../../../components/user/UserMetricsTokensPanel';

import { Spinner } from '../../../components/ui/Spinner';

import { ProfileTabs } from './ProfileTabs';

export function ProfileMetricsPage() {
  const auth = useAuth();
  const { t } = useI18n();

  const userId = auth.user?.id ?? null;

  return (
    <DetailShell
      testId="profile.metrics.page"
      variant="narrow"
      header={<PageHeader title={t('profile.page.title')} description={t('profile.metrics.subtitle')} />}
      tabs={<ProfileTabs />}
    >
      {!userId ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <UserMetricsTokensPanel testIdPrefix="profile.metrics" />
      )}
    </DetailShell>
  );
}
