import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';
import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { fetchUserClusterResources, type ClusterResource } from '../../../../lib/api/clusterResources';
import { useAdminUserContext } from './AdminUserLayout';

function text(value: unknown, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function format(value: unknown, resource: ClusterResource | null | undefined) {
  if (typeof value !== 'number') return '—';
  const name = String(resource?.name ?? '').toLowerCase();
  if (['memory', 'swap', 'diskspace'].includes(name)) {
    if (value < 1024) return `${value} MiB`;
    const gib = value / 1024;
    return gib < 1024 ? `${gib % 1 === 0 ? gib : gib.toFixed(1)} GiB` : `${(gib / 1024).toFixed(1)} TiB`;
  }
  return new Intl.NumberFormat('cs-CZ').format(value);
}

function percent(used: unknown, total: unknown) {
  if (typeof used !== 'number' || typeof total !== 'number' || total <= 0) return 0;
  return Math.max(0, Math.min(100, (used / total) * 100));
}

export function AdminUserResourceUsagePage() {
  const { t } = useI18n();
  const { user } = useAdminUserContext();
  const resourcesQ = useQuery({
    queryKey: ['user_cluster_resources', { userId: user.id, limit: 500 }],
    queryFn: async () => (await fetchUserClusterResources(user.id, { limit: 500 })).data,
  });
  const groups = useMemo(() => {
    const byEnvironment = new Map<string, { label: string; rows: typeof resourcesQ.data }>();
    for (const row of resourcesQ.data ?? []) {
      const environment = row.environment;
      const key = typeof environment?.id === 'number' ? String(environment.id) : 'none';
      const group = byEnvironment.get(key) ?? { label: text(environment?.label, typeof environment?.id === 'number' ? `#${environment.id}` : '—'), rows: [] };
      group.rows!.push(row);
      byEnvironment.set(key, group);
    }
    return [...byEnvironment.entries()].map(([key, group]) => ({ key, ...group }));
  }, [resourcesQ.data]);

  return (
    <div className="space-y-4" data-testid="admin.user.resource_usage.page">
      <div>
        <h1 className="text-xl font-semibold">{t('admin.user.resource_usage.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('admin.user.resource_usage.subtitle')}</p>
      </div>
      {resourcesQ.isLoading ? <div className="text-sm text-muted">{t('common.loading')}</div> : null}
      {!resourcesQ.isLoading && groups.length === 0 ? <EmptyState title={t('admin.user.resource_usage.empty.title')} body={t('admin.user.resource_usage.empty.body')} /> : null}
      {groups.map((group) => (
        <Card key={group.key} testId={`admin.user.resource_usage.environment.${group.key}`}>
          <CardHeader title={group.label} />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.rows?.map((row) => {
                const resource = row.cluster_resource;
                const used = typeof row.used === 'number' ? row.used : 0;
                const total = typeof row.value === 'number' ? row.value : 0;
                return (
                  <div key={row.id} className="rounded-md border border-border bg-surface-2 p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{text(resource?.label, text(resource?.name))}</span>
                      <span className="text-right text-sm font-semibold">{format(row.free, resource)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">{t('admin.user.resource_usage.free')}</div>
                    <div className="mt-3 h-2 overflow-hidden rounded bg-border">
                      <div className="h-full bg-primary" style={{ width: `${percent(used, total)}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between gap-3 text-xs text-muted">
                      <span>{t('admin.user.resource_usage.used')}: {format(row.used, resource)}</span>
                      <span>{t('admin.user.resource_usage.total')}: {format(row.value, resource)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
