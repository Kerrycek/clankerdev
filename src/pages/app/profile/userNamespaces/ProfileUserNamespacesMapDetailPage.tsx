import React from 'react';
import { useParams } from 'react-router-dom';

import { useAppMode } from '../../../../app/appMode';

import { UserNamespaceMapDetail } from '../../../../components/userNamespaces/UserNamespaceMapDetail';

export function ProfileUserNamespacesMapDetailPage() {
  const { basePath } = useAppMode();
  const params = useParams();
  const mapId = Number(params['mapId']);

  return (
    <UserNamespaceMapDetail
      mapId={mapId}
      backTo={`${basePath}/profile/user-namespaces/maps`}
      testIdPrefix="profile.userns.map"
    />
  );
}
