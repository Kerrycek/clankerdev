import React from 'react';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';

import { TabsNav } from '../../../components/ui/TabsNav';

export function ProfileTabs(props: { testId?: string; active?: string }) {
  const { basePath } = useAppMode();
  const { t } = useI18n();

  return (
    <TabsNav
      testId={props.testId ?? 'profile.tabs'}
      items={[
        { to: `${basePath}/profile`, label: t('profile.tabs.overview'), end: true },
        { to: `${basePath}/profile/resources`, label: t('profile.tabs.resources') },
        { to: `${basePath}/profile/security`, label: t('profile.tabs.security') },
        { to: `${basePath}/profile/mfa`, label: t('profile.tabs.mfa') },
        { to: `${basePath}/profile/sessions`, label: t('profile.tabs.sessions') },
        { to: `${basePath}/profile/keys`, label: t('profile.tabs.keys') },
        { to: `${basePath}/profile/metrics`, label: t('profile.tabs.metrics') },
        { to: `${basePath}/profile/mail`, label: t('profile.tabs.mail') },
        { to: `${basePath}/profile/user-data`, label: t('profile.tabs.user_data') },
        { to: `${basePath}/profile/user-namespaces`, label: t('profile.tabs.user_namespaces') },
      ]}
    />
  );
}
