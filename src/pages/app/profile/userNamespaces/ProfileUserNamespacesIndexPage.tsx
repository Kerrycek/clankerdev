import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAppMode } from '../../../../app/appMode';
import { useI18n } from '../../../../app/i18n';
import { Spinner } from '../../../../components/ui/Spinner';

import { fetchUserNamespaces } from '../../../../lib/api/userNamespaces';

export function ProfileUserNamespacesIndexPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();

  const q = useQuery({
    queryKey: ['user_namespace', 'list', { forLanding: true }],
    queryFn: async () => (await fetchUserNamespaces({ limit: 2 })).data,
    refetchOnWindowFocus: false,
  });

  const targetBase = `${basePath}/profile/user-namespaces`;

  if (q.isLoading) {
    return (
      <div className="mt-6">
        <Spinner label={t('common.loading')} />
      </div>
    );
  }

  const list = q.data ?? [];
  const to = list.length === 1 ? `${targetBase}/maps` : `${targetBase}/namespaces`;

  return <Navigate to={to} replace />;
}
