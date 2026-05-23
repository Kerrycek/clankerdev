import React from 'react';
import { Outlet } from 'react-router-dom';

import { useI18n } from '../../../../app/i18n';
import { DetailShell } from '../../../../components/layout/DetailShell';
import { PageHeader } from '../../../../components/layout/PageHeader';
import { TabsNav } from '../../../../components/ui/TabsNav';

export function AdminNetworkingLayout() {
  const { t } = useI18n();
  return (
    <DetailShell variant="wide" testId="admin.networking.shell">
      <PageHeader title={t('admin.networking.title')} description={t('admin.networking.subtitle')} />
      <TabsNav
        testId="admin.networking.tabs"
        items={[
          { to: '/admin/networking/ip-addresses', label: t('admin.networking.tab.ip_addresses'), testId: 'admin.networking.tab.ip_addresses' },
          { to: '/admin/networking/host-ip-addresses', label: t('admin.networking.tab.host_ip_addresses'), testId: 'admin.networking.tab.host_ip_addresses' },
          { to: '/admin/networking/ip-address-assignments', label: t('admin.networking.tab.ip_assignments'), testId: 'admin.networking.tab.ip_assignments' },
          { to: '/admin/networking/live', label: t('admin.networking.tab.live'), testId: 'admin.networking.tab.live' },
          { to: '/admin/networking/traffic-users', label: t('admin.networking.tab.traffic_users'), testId: 'admin.networking.tab.traffic_users' },
        ]}
      />
      <Outlet />
    </DetailShell>
  );
}
