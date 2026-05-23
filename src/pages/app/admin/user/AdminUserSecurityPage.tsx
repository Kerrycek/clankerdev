import React from 'react';

import { UserSecurityPanel } from '../../../../components/user/UserSecurityPanel';

import { useAdminUserContext } from './AdminUserLayout';

export function AdminUserSecurityPage() {
  const { userId, user } = useAdminUserContext();

  return (
    <div className="space-y-4">
      <UserSecurityPanel userId={userId} user={user} variant="admin" testIdPrefix="admin.user.security" />
    </div>
  );
}
