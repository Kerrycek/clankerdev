import React from 'react';
import { Navigate } from 'react-router-dom';

import { useAppMode } from '../../../../app/appMode';

export function AdminUserNamespacesIndexPage() {
  const { basePath } = useAppMode();
  return <Navigate to={`${basePath}/user-namespaces/namespaces`} replace />;
}
