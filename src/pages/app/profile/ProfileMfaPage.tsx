import React from 'react';

import { useAuth } from '../../../app/auth';
import { getRuntimeConfig } from '../../../app/config';
import { useI18n } from '../../../app/i18n';

import { DetailShell } from '../../../components/layout/DetailShell';
import { PageHeader } from '../../../components/layout/PageHeader';

import { UserMfaPanel } from '../../../components/user/UserMfaPanel';

import { Spinner } from '../../../components/ui/Spinner';

import { ProfileTabs } from './ProfileTabs';

export function ProfileMfaPage() {
  const auth = useAuth();
  const { t } = useI18n();

  const userId = auth.user?.id ?? null;

  const cfg = getRuntimeConfig();
  const allowWebauthnRegistration = cfg.auth.kind === 'oauth2';

  return (
    <DetailShell
      testId="profile.mfa.page"
      variant="narrow"
      header={<PageHeader title={t('profile.page.title')} description={t('profile.mfa.subtitle')} />}
      tabs={<ProfileTabs />}
    >
      {!userId ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <UserMfaPanel
          userId={userId}
          user={auth.user ?? undefined}
          allowTotpCreate
          allowWebauthnRegistration={allowWebauthnRegistration}
          testIdPrefix="profile.mfa"
        />
      )}
    </DetailShell>
  );
}
