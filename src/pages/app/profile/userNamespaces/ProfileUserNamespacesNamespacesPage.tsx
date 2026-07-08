import React from 'react';

import { useAppMode } from '../../../../app/appMode';
import { useAuth } from '../../../../app/auth';
import { useI18n } from '../../../../app/i18n';

import { UserNamespaceList } from '../../../../components/userNamespaces/UserNamespaceList';
import { Spinner } from '../../../../components/ui/Spinner';

export function ProfileUserNamespacesNamespacesPage() {
  const { basePath } = useAppMode();
  const auth = useAuth();
  const { t } = useI18n();
  const userId = typeof auth.user?.id === 'number' ? auth.user.id : undefined;

  if (userId === undefined) {
    return (
      <div className="mt-6">
        <Spinner label={t('common.loading')} />
      </div>
    );
  }

  return (
    <UserNamespaceList
      testIdPrefix="profile.userns.namespaces"
      namespaceBase={`${basePath}/profile/user-namespaces/namespaces`}
      mapsBase={`${basePath}/profile/user-namespaces/maps`}
      fixedUserId={userId}
      showAdminFields={false}
    />
  );
}
