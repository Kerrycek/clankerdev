import React from 'react';

import { useI18n } from '../../../../app/i18n';

import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { LifecyclePanel } from '../../../../components/lifetimes/LifecyclePanel';

import { formatDateTime } from '../../../../lib/format';

import { useAdminUserContext } from './AdminUserLayout';

export function AdminUserOverviewPage() {
  const { t } = useI18n();
  const { user: u, refetch } = useAdminUserContext();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card testId="admin.user.details.card">
        <CardHeader title={t('common.details')} />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted">{t('admin.user.field.email')}</div>
              <div className="text-sm">{u.email ?? t('common.na')}</div>
            </div>
            <div>
              <div className="text-xs text-muted">{t('admin.user.field.level')}</div>
              <div className="text-sm">{u.level}</div>
            </div>
            <div>
              <div className="text-xs text-muted">{t('admin.user.field.created')}</div>
              <div className="text-sm">{u.created_at ? formatDateTime(u.created_at) : t('common.na')}</div>
            </div>
            <div>
              <div className="text-xs text-muted">{t('admin.user.field.last_activity')}</div>
              <div className="text-sm">{u.last_activity_at ? formatDateTime(u.last_activity_at) : t('common.na')}</div>
            </div>
            {u.address ? (
              <div className="sm:col-span-2">
                <div className="text-xs text-muted">{t('admin.user.field.address')}</div>
                <div className="text-sm whitespace-pre-wrap">{u.address}</div>
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <LifecyclePanel
        kind="user"
        id={u.id}
        objectLabel={u.login}
        objectState={(u as any).object_state as any}
        expirationDate={(u as any).expiration_date as any}
        remindAfterDate={(u as any).remind_after_date as any}
        onUpdated={refetch}
        testId="admin.user.lifecycle"
      />
    </div>
  );
}

