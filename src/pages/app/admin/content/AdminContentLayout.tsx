import React from 'react';
import { Outlet } from 'react-router-dom';

import { useI18n } from '../../../../app/i18n';
import { DetailShell } from '../../../../components/layout/DetailShell';
import { PageHeader } from '../../../../components/layout/PageHeader';
import { TabsNav } from '../../../../components/ui/TabsNav';

export function AdminContentLayout() {
  const { t } = useI18n();

  return (
    <DetailShell variant="wide" testId="admin.content.shell">
      <PageHeader title={t('admin.content.title')} description={t('admin.content.subtitle')} />

      <TabsNav
        testId="admin.content.tabs"
        items={[
          {
            to: '/admin/content/news',
            label: t('admin.content.tab.news'),
            testId: 'admin.content.tab.news',
          },
          {
            to: '/admin/content/help-boxes',
            label: t('admin.content.tab.help_boxes'),
            testId: 'admin.content.tab.help_boxes',
          },
        ]}
      />

      <Outlet />
    </DetailShell>
  );
}
