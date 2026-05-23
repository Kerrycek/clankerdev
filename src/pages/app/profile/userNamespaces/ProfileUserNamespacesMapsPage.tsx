import React from 'react';

import { useAppMode } from '../../../../app/appMode';

import { UserNamespaceMapList } from '../../../../components/userNamespaces/UserNamespaceMapList';

export function ProfileUserNamespacesMapsPage() {
  const { basePath } = useAppMode();

  return (
    <UserNamespaceMapList
      testIdPrefix="profile.userns.maps"
      mapsBase={`${basePath}/profile/user-namespaces/maps`}
      namespacesBase={`${basePath}/profile/user-namespaces/namespaces`}
      showAdminFields={false}
      createWithNamespaceSelect
    />
  );
}
