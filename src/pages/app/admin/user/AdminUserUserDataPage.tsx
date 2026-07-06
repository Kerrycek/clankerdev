import React from 'react';

import { useI18n } from '../../../../app/i18n';

import { UserDataTemplatesPanel } from '../../../../components/user/UserDataTemplatesPanel';

import { useAdminUserContext } from './AdminUserLayout';

export function AdminUserUserDataPage() {
  const { t } = useI18n();
  const { user, userId } = useAdminUserContext();

  return (
    <div className="space-y-2" data-testid="admin.user.user_data">
      <div className="text-sm text-muted">{t('user_data.admin.user_scoped_hint', { login: user.login })}</div>

      <UserDataTemplatesPanel
        testIdPrefix="admin.user.user_data"
        userIdForAdmin={userId}
        createForUserId={userId}
      />
    </div>
  );
}
