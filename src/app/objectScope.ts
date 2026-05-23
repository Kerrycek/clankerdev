import { useAuth } from './auth';
import { useAppMode } from './appMode';

export type ObjectScope = 'mine' | 'all';

export interface ObjectScopeValue {
  /**
   * "mine" = user's own objects (for admins this is the "My view" filter)
   * "all"  = everything accessible to the account (admin view)
   */
  scope: ObjectScope;

  /**
   * When an admin/support user uses the "My view" scope, we can explicitly
   * filter some Index actions by user ID.
   */
  mineUserId?: number;

  /** Whether the current user can switch between admin/my scopes. */
  canSwitchScope: boolean;
}

/**
 * Single source of truth for "My view" vs "Admin view" behavior.
 *
 * Normal users:
 *   - scope is always "mine"
 *   - mineUserId is undefined (backend already filters)
 *
 * Admin/support users:
 *   - /app = "mine" (filter by mineUserId where supported)
 *   - /admin = "all"
 */
export function useObjectScope(): ObjectScopeValue {
  const auth = useAuth();
  const { mode } = useAppMode();

  const canSwitchScope = auth.canUseAdminUi;

  if (!canSwitchScope) {
    return {
      scope: 'mine',
      mineUserId: undefined,
      canSwitchScope: false,
    };
  }

  if (mode === 'admin') {
    return {
      scope: 'all',
      mineUserId: undefined,
      canSwitchScope: true,
    };
  }

  const mineUserId = typeof auth.user?.id === 'number' ? auth.user.id : undefined;

  return {
    scope: 'mine',
    mineUserId,
    canSwitchScope: true,
  };
}
