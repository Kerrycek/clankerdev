import React from 'react';
import { Link } from 'react-router-dom';

import { formatDateTime } from '../../../../lib/format';

import { Badge } from '../../../../components/ui/Badge';
import { Card } from '../../../../components/ui/Card';
import { StatusDot } from '../../../../components/ui/StatusDot';
import { toneSurfaceClass } from '../../../../components/ui/tone';

import {
  type UserListRecord,
  type UsersPageTranslator,
  roleBadgeForUser,
  userDotVariant,
  userRowVariant,
  userStatusBadges,
} from './userListSemantics';

interface UsersListMobileProps {
  users: UserListRecord[];
  basePath: string;
  t: UsersPageTranslator;
}

export function UsersListMobile({ users, basePath, t }: UsersListMobileProps) {
  return (
    <div className="space-y-3 md:hidden">
      {users.map((user) => {
        const role = roleBadgeForUser(user);
        const rowVariant = userRowVariant(user);
        const dotVariant = userDotVariant(user);
        const statusBadges = userStatusBadges(user, t);
        return (
          <Card key={user.id} testId={`admin.users.card.${user.id}`} className={toneSurfaceClass(rowVariant)}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusDot variant={dotVariant} testId={`admin.users.card.${user.id}.dot`} ariaLabel={t('common.state')} />
                    <Link className="block truncate text-base font-semibold text-accent hover:underline" to={`${basePath}/users/${user.id}`}>
                      {user.login ?? `#${user.id}`}
                    </Link>
                  </div>
                  <div className="mt-0.5 text-xs text-faint">#{user.id}</div>
                </div>
                <Badge variant={role.variant}>{role.label}</Badge>
              </div>

              {statusBadges.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {statusBadges.map((badge) => (
                    <Badge key={badge.key} variant={badge.variant}>
                      {badge.label}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 space-y-1 text-xs text-muted">
                {user.full_name ? <div>{String(user.full_name)}</div> : null}
                {user.email ? <div>{String(user.email)}</div> : null}
                {user.last_activity_at ? (
                  <div>
                    <span className="text-faint">{t('admin.users.field.last_activity')}:</span>{' '}
                    {formatDateTime(String(user.last_activity_at))}
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
