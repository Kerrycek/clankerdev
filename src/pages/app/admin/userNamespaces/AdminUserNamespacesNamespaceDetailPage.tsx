import React from 'react';
import { useParams } from 'react-router-dom';

import { useAppMode } from '../../../../app/appMode';

import { UserNamespaceDetail } from '../../../../components/userNamespaces/UserNamespaceDetail';

export function AdminUserNamespacesNamespaceDetailPage() {
  const { basePath } = useAppMode();
  const params = useParams();
  const id = Number(params['id']);

  return (
    <UserNamespaceDetail
      id={id}
      mapsUrl={`${basePath}/user-namespaces/maps?user_namespace=${id}`}
      testIdPrefix="admin.userns.namespace"
    />
  );
}
