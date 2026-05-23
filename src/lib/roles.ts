export type UserRole = 'user' | 'support' | 'admin' | 'unknown';

/**
 * Mirror of vpsAdmin's server-side User#role mapping.
 *
 * API output exposes `level`, not `role`, so we derive it here.
 *
 * See: api/models/user.rb
 */
export function roleFromLevel(level: number | undefined | null): UserRole {
  if (typeof level !== 'number') return 'unknown';
  if (level >= 90) return 'admin';
  if (level >= 21) return 'support';
  if (level >= 1) return 'user';
  return 'unknown';
}

export function canUseAdminUi(role: UserRole): boolean {
  return role === 'admin' || role === 'support';
}
