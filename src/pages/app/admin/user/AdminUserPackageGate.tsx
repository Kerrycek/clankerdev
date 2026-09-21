import React from 'react';
import { Navigate, Outlet, useOutletContext, useParams } from 'react-router-dom';

import { useAppMode } from '../../../../app/appMode';
import { useAuth } from '../../../../app/auth';
import type { UserRole } from '../../../../lib/roles';
import type { AdminUserOutletContext } from './AdminUserLayout';

export function canManageUserResourcePackages(role: UserRole): boolean {
  return role === 'admin';
}

/** Keep package assignments aligned with the administrator-only API actions. */
export function AdminUserPackageGate() {
  const { basePath } = useAppMode();
  const auth = useAuth();
  const { userId } = useParams();
  const context = useOutletContext<AdminUserOutletContext>();

  if (!canManageUserResourcePackages(auth.role)) {
    return <Navigate to={`${basePath}/users/${userId ?? ''}`} replace />;
  }

  return <Outlet context={context} />;
}

export default AdminUserPackageGate;
