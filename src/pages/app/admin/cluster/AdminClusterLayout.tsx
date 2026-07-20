import React from 'react';
import { Outlet } from 'react-router-dom';

import { useI18n } from '../../../../app/i18n';
import { DetailShell } from '../../../../components/layout/DetailShell';
import { PageHeader } from '../../../../components/layout/PageHeader';
import { TabsNav } from '../../../../components/ui/TabsNav';

export function AdminClusterLayout() {
  const { t } = useI18n();

  return (
    <DetailShell variant="wide" testId="admin.cluster.shell">
      <PageHeader title={t('admin.cluster.title')} description={t('admin.cluster.subtitle')} />

      <TabsNav
        testId="admin.cluster.tabs"
        items={[
          {
            to: '/admin/cluster/summary',
            label: t('admin.cluster.tab.summary'),
            testId: 'admin.cluster.tab.summary',
          },
          {
            to: '/admin/cluster/environments',
            label: t('admin.cluster.tab.environments'),
            testId: 'admin.cluster.tab.environments',
          },
          {
            to: '/admin/cluster/locations',
            label: t('admin.cluster.tab.locations'),
            testId: 'admin.cluster.tab.locations',
          },
          {
            to: '/admin/cluster/os-templates',
            label: t('admin.cluster.tab.os_templates'),
            testId: 'admin.cluster.tab.os_templates',
          },
          {
            to: '/admin/cluster/networks',
            label: t('admin.cluster.tab.networks'),
            testId: 'admin.cluster.tab.networks',
          },
          {
            to: '/admin/cluster/resource-packages',
            label: t('admin.cluster.tab.resource_packages'),
            testId: 'admin.cluster.tab.resource_packages',
          },
          {
            to: '/admin/cluster/system-config',
            label: t('admin.cluster.tab.system_config'),
            testId: 'admin.cluster.tab.system_config',
          },
          {
            to: '/admin/cluster/dns-resolvers',
            label: t('admin.cluster.tab.dns_resolvers'),
            testId: 'admin.cluster.tab.dns_resolvers',
          },
          {
            to: '/admin/cluster/dns-servers',
            label: t('admin.cluster.tab.dns_servers'),
            testId: 'admin.cluster.tab.dns_servers',
          },
        ]}
      />

      <Outlet />
    </DetailShell>
  );
}
