import React from 'react';

import { UserMailPreferencesPanel } from '../../../../components/user/UserMailPreferencesPanel';

import { useAdminUserContext } from './AdminUserLayout';

export function AdminUserMailPage() {
  const { userId, user } = useAdminUserContext();

  return <UserMailPreferencesPanel userId={userId} user={user} />;
}
