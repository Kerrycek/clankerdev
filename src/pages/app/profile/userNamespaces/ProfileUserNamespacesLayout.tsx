import React from 'react';
import { Outlet } from 'react-router-dom';

import { useAppMode } from '../../../../app/appMode';
import { useI18n } from '../../../../app/i18n';

import { DetailShell } from '../../../../components/layout/DetailShell';
import { PageHeader } from '../../../../components/layout/PageHeader';
import { ProfileTabs } from '../ProfileTabs';
import { TabsNav } from '../../../../components/ui/TabsNav';

export function ProfileUserNamespacesLayout() {
  const { basePath } = useAppMode();
  const { t } = useI18n();

  const base = `${basePath}/profile/user-namespaces`;

  return (
    <DetailShell variant="wide" testId="profile.userns.shell">
      <PageHeader title={t('profile.userns.title')} description={t('profile.userns.subtitle')} />

      <ProfileTabs />

      <TabsNav
        testId="profile.userns.tabs"
        items={[
          { to: `${base}/namespaces`, label: t('userns.tabs.namespaces'), testId: 'profile.userns.tabs.namespaces' },
          { to: `${base}/maps`, label: t('userns.tabs.maps'), testId: 'profile.userns.tabs.maps' },
        ]}
      />

      <Outlet />
    </DetailShell>
  );
}
