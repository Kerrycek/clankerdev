import React from 'react';

import type { User } from '../../../../lib/api/users';
import { roleFromLevel, type UserRole } from '../../../../lib/roles';

import { Badge } from '../../../../components/ui/Badge';
import { StatusDot } from '../../../../components/ui/StatusDot';
import type { TableRowVariant } from '../../../../components/ui/TableRowLink';

export type UsersPageTranslator = (key: string, params?: Record<string, unknown>) => string;

export type UserListRecord = User & {
  lockout?: boolean;
  password_reset?: boolean;
  enable_multi_factor_auth?: boolean;
  mailer_enabled?: boolean;
};

export function roleBadge(role: UserRole): { variant: React.ComponentProps<typeof Badge>['variant']; label: string } {
  if (role === 'admin') return { variant: 'black', label: role };
  if (role === 'support') return { variant: 'warn', label: role };
  if (role === 'user') return { variant: 'neutral', label: role };
  return { variant: 'neutral', label: role || 'unknown' };
}

export function roleBadgeForUser(user: UserListRecord) {
  return roleBadge(roleFromLevel(user.level));
}

export function userRowVariant(user: UserListRecord): TableRowVariant | undefined {
  if (user.lockout === true) return 'danger';
  if (user.password_reset === true) return 'warn';
  return undefined;
}

export function userDotVariant(user: UserListRecord): React.ComponentProps<typeof StatusDot>['variant'] {
  if (user.lockout === true) return 'danger';
  if (user.password_reset === true) return 'warn';
  if (user.enable_multi_factor_auth === true) return 'ok';
  return 'neutral';
}

export function userStatusBadges(
  user: UserListRecord,
  t: UsersPageTranslator
): Array<{ key: string; variant: React.ComponentProps<typeof Badge>['variant']; label: string }> {
  const badges: Array<{ key: string; variant: React.ComponentProps<typeof Badge>['variant']; label: string }> = [];

  if (user.lockout === true) badges.push({ key: 'lockout', variant: 'danger', label: t('admin.users.badge.lockout') });
  if (user.password_reset === true) {
    badges.push({ key: 'password_reset', variant: 'warn', label: t('admin.users.badge.password_reset') });
  }
  if (user.enable_multi_factor_auth === true) badges.push({ key: 'mfa', variant: 'ok', label: t('admin.users.badge.mfa') });
  if (user.mailer_enabled === false) badges.push({ key: 'mailer_off', variant: 'neutral', label: t('admin.users.badge.mailer_off') });

  return badges;
}
