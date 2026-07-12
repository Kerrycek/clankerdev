import React from 'react';

import { useI18n } from '../../../../app/i18n';
import { UserResourceUsagePanel } from '../../../../components/user/UserResourceUsagePanel';
import { useAdminUserContext } from './AdminUserLayout';

export function AdminUserResourceUsagePage() {
  const { t } = useI18n();
  const { user } = useAdminUserContext();

  return (
    <div className="space-y-4" data-testid="admin.user.resource_usage.page">
      <div>
        <h1 className="text-xl font-semibold">{t('admin.user.resource_usage.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('admin.user.resource_usage.subtitle')}</p>
      </div>
      <UserResourceUsagePanel userId={user.id} testIdPrefix="admin.user.resource_usage.resources" />
    </div>
  );
}
