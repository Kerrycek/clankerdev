import React from 'react';

import { UserMetricsTokensPanel } from '../../../../components/user/UserMetricsTokensPanel';

import { useAdminUserContext } from './AdminUserLayout';

export function AdminUserMetricsPage() {
  const { userId } = useAdminUserContext();

  return <UserMetricsTokensPanel userId={userId} testIdPrefix="admin.user.metrics" />;
}
