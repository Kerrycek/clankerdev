import React from 'react';
import { Navigate, Outlet, useOutletContext, useParams } from 'react-router-dom';

import { useAppMode } from '../../../../app/appMode';
import { useAuth } from '../../../../app/auth';
import { canViewGlobalFinance } from '../FinanceGlobalAdminGate';
import type { AdminUserOutletContext } from './AdminUserLayout';

/** Keep per-user accounting screens aligned with the administrator-only API. */
export function AdminUserFinanceGate() {
  const { basePath } = useAppMode();
  const auth = useAuth();
  const { userId } = useParams();
  const context = useOutletContext<AdminUserOutletContext>();

  if (!canViewGlobalFinance(auth.role)) {
    return <Navigate to={`${basePath}/users/${userId ?? ''}`} replace />;
  }

  return <Outlet context={context} />;
}

export default AdminUserFinanceGate;
