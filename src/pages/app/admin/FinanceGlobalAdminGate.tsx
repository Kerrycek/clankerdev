import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../../../app/auth';
import type { UserRole } from '../../../lib/roles';

export function canViewGlobalFinance(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Ordinary users can read only their own payment-related data. Keep every
 * global Finance surface behind the same administrator boundary as the API.
 */
export function FinanceGlobalAdminGate() {
  const auth = useAuth();

  if (!canViewGlobalFinance(auth.role)) {
    return <Navigate to="/app/payments" replace />;
  }

  return <Outlet />;
}

export default FinanceGlobalAdminGate;
