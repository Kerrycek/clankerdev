import React from 'react';

import { UserPublicKeysPanel } from '../../../../components/user/UserPublicKeysPanel';

import { useAdminUserContext } from './AdminUserLayout';

export function AdminUserKeysPage() {
  const { userId } = useAdminUserContext();

  return <UserPublicKeysPanel userId={userId} testIdPrefix="admin.user.keys" />;
}
