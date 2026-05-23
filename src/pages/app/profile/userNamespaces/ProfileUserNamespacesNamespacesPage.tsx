import React from 'react';

import { useAppMode } from '../../../../app/appMode';

import { UserNamespaceList } from '../../../../components/userNamespaces/UserNamespaceList';

export function ProfileUserNamespacesNamespacesPage() {
  const { basePath } = useAppMode();

  return (
    <UserNamespaceList
      testIdPrefix="profile.userns.namespaces"
      namespaceBase={`${basePath}/profile/user-namespaces/namespaces`}
      mapsBase={`${basePath}/profile/user-namespaces/maps`}
      showAdminFields={false}
    />
  );
}
