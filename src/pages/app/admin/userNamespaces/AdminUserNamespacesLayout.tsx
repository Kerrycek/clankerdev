import React from 'react';
import { Outlet } from 'react-router-dom';

import { useAppMode } from '../../../../app/appMode';
import { useI18n } from '../../../../app/i18n';

import { DetailShell } from '../../../../components/layout/DetailShell';
import { PageHeader } from '../../../../components/layout/PageHeader';
import { TabsNav } from '../../../../components/ui/TabsNav';

export function AdminUserNamespacesLayout() {
  const { basePath } = useAppMode();
  const { t } = useI18n();

  const base = `${basePath}/user-namespaces`;

  return (
    <DetailShell variant="wide" testId="admin.userns.shell">
      <PageHeader title={t('admin.userns.title')} description={t('admin.userns.subtitle')} />

      <TabsNav
        testId="admin.userns.tabs"
        items={[
          { to: `${base}/namespaces`, label: t('userns.tabs.namespaces'), testId: 'admin.userns.tabs.namespaces' },
          { to: `${base}/maps`, label: t('userns.tabs.maps'), testId: 'admin.userns.tabs.maps' },
        ]}
      />

      <Outlet />
    </DetailShell>
  );
}
