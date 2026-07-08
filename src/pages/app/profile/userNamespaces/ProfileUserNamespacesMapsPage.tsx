import React from 'react';

import { useAppMode } from '../../../../app/appMode';
import { useAuth } from '../../../../app/auth';
import { useI18n } from '../../../../app/i18n';

import { UserNamespaceMapList } from '../../../../components/userNamespaces/UserNamespaceMapList';
import { Spinner } from '../../../../components/ui/Spinner';

export function ProfileUserNamespacesMapsPage() {
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
    <UserNamespaceMapList
      testIdPrefix="profile.userns.maps"
      mapsBase={`${basePath}/profile/user-namespaces/maps`}
      namespacesBase={`${basePath}/profile/user-namespaces/namespaces`}
      fixedUserId={userId}
      showAdminFields={false}
      createWithNamespaceSelect
      createNamespacesUserId={userId}
    />
  );
}
