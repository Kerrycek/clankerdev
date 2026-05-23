import React from 'react';

import { useAppMode } from '../../../../app/appMode';

import { UserNamespaceList } from '../../../../components/userNamespaces/UserNamespaceList';

export function AdminUserNamespacesNamespacesPage() {
  const { basePath } = useAppMode();

  return (
    <UserNamespaceList
      testIdPrefix="admin.userns.namespaces"
      namespaceBase={`${basePath}/user-namespaces/namespaces`}
      mapsBase={`${basePath}/user-namespaces/maps`}
      showAdminFields
    />
  );
}
