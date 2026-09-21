import type { UserRole } from '../../../../lib/roles';

/** User administration fields and lifecycle actions are administrator-only in the API. */
export function canAdministerUser(role: UserRole): boolean {
  return role === 'admin';
}
