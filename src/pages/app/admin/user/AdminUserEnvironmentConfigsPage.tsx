import React from 'react';

import { UserEnvironmentConfigsPanel } from '../../../../components/user/UserEnvironmentConfigsPanel';

import { useAdminUserContext } from './AdminUserLayout';

export function AdminUserEnvironmentConfigsPage() {
  const { userId } = useAdminUserContext();

  return <UserEnvironmentConfigsPanel userId={userId} editable testIdPrefix="admin.user.env_configs" />;
}
