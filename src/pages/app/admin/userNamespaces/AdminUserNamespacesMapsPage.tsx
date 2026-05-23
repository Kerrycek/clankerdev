import React from 'react';

import { useAppMode } from '../../../../app/appMode';

import { UserNamespaceMapList } from '../../../../components/userNamespaces/UserNamespaceMapList';

export function AdminUserNamespacesMapsPage() {
  const { basePath } = useAppMode();

  return (
    <UserNamespaceMapList
      testIdPrefix="admin.userns.maps"
      mapsBase={`${basePath}/user-namespaces/maps`}
      namespacesBase={`${basePath}/user-namespaces/namespaces`}
      showAdminFields
    />
  );
}
