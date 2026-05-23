import React from 'react';

import { UserSessionsPanel } from '../../../../components/user/UserSessionsPanel';

import { useAdminUserContext } from './AdminUserLayout';

export function AdminUserSessionsPage() {
  const { userId } = useAdminUserContext();

  return <UserSessionsPanel userId={userId} testIdPrefix="admin.user.sessions" />;
}
