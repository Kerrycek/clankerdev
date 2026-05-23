import React from 'react';

import { UserMfaPanel } from '../../../../components/user/UserMfaPanel';

import { useAdminUserContext } from './AdminUserLayout';

export function AdminUserMfaPage() {
  const { userId, user } = useAdminUserContext();

  return (
    <UserMfaPanel
      userId={userId}
      user={user}
      allowTotpCreate={false}
      allowWebauthnRegistration={false}
      testIdPrefix="admin.user.mfa"
    />
  );
}
