import React, { useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';
import { SummaryGrid } from '../../../../components/layout/SummaryGrid';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { Select } from '../../../../components/ui/Select';
import { StatCard } from '../../../../components/ui/StatCard';
import { fetchClusterResourcePackageItems } from '../../../../lib/api/clusterResourcePackages';
import {
  createUserClusterResourcePackage,
  deleteUserClusterResourcePackage,
  fetchClusterResourcePackages,
  fetchUserClusterResourcePackages,
  type UserClusterResourcePackage,
} from '../../../../lib/api/clusterResourcePackages';
import { fetchEnvironments } from '../../../../lib/api/infra';
import { useAdminUserContext } from './AdminUserLayout';

function label(value: unknown, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function environmentLabel(value: any) {
  return label(value?.label, typeof value?.id === 'number' ? `#${value.id}` : '—');
}

function packageLabel(value: any) {
  return label(value?.label, typeof value?.id === 'number' ? `#${value.id}` : '—');
}

function resourceValue(value: unknown, resource: any) {
  if (typeof value !== 'number') return '—';
  const name = String(resource?.name ?? '').toLowerCase();
  if (['memory', 'swap', 'diskspace'].includes(name)) {
    if (value < 1024) return `${value} MiB`;
    const gib = value / 1024;
    return gib < 1024 ? `${gib % 1 === 0 ? gib : gib.toFixed(1)} GiB` : `${(gib / 1024).toFixed(1)} TiB`;
  }
  return new Intl.NumberFormat('cs-CZ').format(value);
}

export function AdminUserResourcesPage() {
  const { t } = useI18n();
  const { user } = useAdminUserContext();
  const qc = useQueryClient();
  const { pushToast } = useToasts();
  const [addOpen, setAddOpen] = useState(false);
  const [environmentId, setEnvironmentId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [comment, setComment] = useState('');
  const [validationError, setValidationError] = useState(false);
  const [removeRecord, setRemoveRecord] = useState<UserClusterResourcePackage | null>(null);

  const assignmentsQ = useQuery({
    queryKey: ['user_cluster_resource_packages', { userId: user.id, limit: 500 }],
    queryFn: async () => (await fetchUserClusterResourcePackages({ userId: user.id, limit: 500 })).data,
  });
  const environmentsQ = useQuery({
    queryKey: ['environments', { limit: 500 }],
    queryFn: async () => (await fetchEnvironments({ limit: 500 })).data,
    staleTime: 60_000,
  });
  // Shared packages are represented by a null owner. `is_personal` is derived
  // and is not a reliable index filter on older vpsAdmin API versions.
  const packagesQ = useQuery({
    queryKey: ['cluster_resource_packages', { isPersonal: false, userId: null, limit: 500 }],
    queryFn: async () => (await fetchClusterResourcePackages({ isPersonal: false, userId: null, limit: 500 })).data,
    staleTime: 30_000,
  });
  const assignments = assignmentsQ.data ?? [];
  const packageIds = useMemo(
    () => [...new Set(assignments.map((row: any) => Number(row.cluster_resource_package?.id)).filter(Number.isFinite))],
    [assignments],
  );
  const itemQueries = useQueries({
    queries: packageIds.map((id) => ({
      queryKey: ['cluster_resource_package_items', id],
      queryFn: async () => (await fetchClusterResourcePackageItems(id, { limit: 500 })).data,
      staleTime: 30_000,
    })),
  });
  const itemsByPackage = useMemo(() => new Map(packageIds.map((id, index) => [id, itemQueries[index]?.data ?? []])), [itemQueries, packageIds]);

  const grouped = useMemo(() => {
    const groups = new Map<string, { environment: any; rows: UserClusterResourcePackage[] }>();
    for (const row of assignments) {
      const environment: any = row.environment ?? row.cluster_resource_package?.environment;
      const key = typeof environment?.id === 'number' ? String(environment.id) : 'none';
      const group = groups.get(key) ?? { environment, rows: [] };
      group.rows.push(row);
      groups.set(key, group);
    }
    return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
  }, [assignments]);
  const packageSummary = useMemo(() => {
    const packages = new Map<string, { label: string; count: number; environments: Set<string> }>();

    for (const row of assignments) {
      const pkg: any = row.cluster_resource_package;
      const environment: any = row.environment ?? pkg?.environment;
      const packageId = Number(pkg?.id);
      const key = Number.isFinite(packageId) ? `id:${packageId}` : `label:${packageLabel(pkg)}`;
      const entry = packages.get(key) ?? {
        label: packageLabel(pkg),
        count: 0,
        environments: new Set<string>(),
      };
      entry.count += 1;
      entry.environments.add(environmentLabel(environment));
      packages.set(key, entry);
    }

    return [...packages.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'cs'));
  }, [assignments]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['user_cluster_resource_packages', { userId: user.id }] });
    await qc.invalidateQueries({ queryKey: ['user_cluster_resource_packages'] });
  };
  const addM = useMutation({
    mutationFn: async () => {
      const env = Number(environmentId);
      const pkg = Number(packageId);
      if (!Number.isFinite(env) || env <= 0 || !Number.isFinite(pkg) || pkg <= 0) throw new Error('validation');
      return createUserClusterResourcePackage({ environmentId: env, userId: user.id, clusterResourcePackageId: pkg, comment });
    },
    onSuccess: async () => {
      setAddOpen(false); setEnvironmentId(''); setPackageId(''); setComment(''); setValidationError(false);
      await invalidate();
      pushToast({ variant: 'ok', title: t('admin.user.resources.toast.added') });
    },
    onError: (error) => {
      if (String((error as Error).message) === 'validation') setValidationError(true);
      else pushToast({ variant: 'danger', title: t('common.error'), body: String(error) });
    },
  });
  const removeM = useMutation({
    mutationFn: async () => deleteUserClusterResourcePackage(removeRecord!.id),
    onSuccess: async () => {
      setRemoveRecord(null); await invalidate();
      pushToast({ variant: 'ok', title: t('admin.user.resources.toast.removed') });
    },
  });

  return (
    <div className="space-y-4" data-testid="admin.user.resources.page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('admin.user.resources.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('admin.user.resources.subtitle')}</p>
        </div>
        <Button variant="primary" onClick={() => setAddOpen(true)} testId="admin.user.resources.add">{t('admin.user.resources.add')}</Button>
      </div>
      {assignmentsQ.isLoading ? <div className="text-sm text-muted">{t('common.loading')}</div> : null}
      {!assignmentsQ.isLoading && grouped.length === 0 ? <EmptyState title={t('admin.user.resources.empty.title')} body={t('admin.user.resources.empty.body')} /> : null}
      {packageSummary.length ? (
        <section aria-label={t('admin.user.resources.summary.title')}>
          <h2 className="mb-3 text-base font-semibold">{t('admin.user.resources.summary.title')}</h2>
          <SummaryGrid testId="admin.user.resources.summary">
            {packageSummary.map((entry) => (
              <StatCard
                key={entry.label}
                className="md:col-span-3"
                variant="compact"
                title={entry.label}
                value={t('admin.user.resources.summary.assigned', { count: entry.count })}
                subtitle={t('admin.user.resources.summary.environments', { count: entry.environments.size })}
              />
            ))}
          </SummaryGrid>
        </section>
      ) : null}
      {grouped.map((group) => (
        <Card key={group.key} testId={`admin.user.resources.environment.${group.key}`}>
          <CardHeader
            title={environmentLabel(group.environment)}
            subtitle={t('admin.user.resources.environment.assignments', { count: group.rows.length })}
          />
          <CardBody>
            <div className="divide-y divide-border">
            {group.rows.map((row: any) => {
              const pkg = row.cluster_resource_package;
              const items = itemsByPackage.get(Number(pkg?.id)) ?? [];
              return <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{packageLabel(pkg)}</div>
                  {row.comment ? <div className="mt-1 text-sm text-muted">{row.comment}</div> : null}
                  {items.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t('admin.user.resources.limits')}>
                      {items.map((item: any) => (
                        <Badge key={item.id} variant="neutral">
                          {label(item.cluster_resource?.label, label(item.cluster_resource?.name))}: {resourceValue(item.value, item.cluster_resource)}
                        </Badge>
                      ))}
                    </div>
                  ) : <div className="mt-1 text-sm text-muted">{t('admin.user.resources.none')}</div>}
                </div>
                <div className="flex shrink-0 gap-2"><Button size="sm" variant="secondary" to={`/admin/cluster/resource-packages/${pkg?.id}`}>{t('admin.user.resources.open')}</Button><Button size="sm" variant="danger" onClick={() => setRemoveRecord(row)}>{t('admin.user.resources.remove')}</Button></div>
              </div>;
            })}
            </div>
          </CardBody>
        </Card>
      ))}
      <Modal open={addOpen} onClose={() => !addM.isPending && setAddOpen(false)} title={t('admin.user.resources.add.title')} testId="admin.user.resources.add.modal" footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button><Button variant="primary" loading={addM.isPending} onClick={() => addM.mutate()}>{t('admin.user.resources.add.save')}</Button></>}>
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            <span className="mb-1 block">{t('admin.user.resources.add.environment')}</span>
            <Select ariaLabel={t('admin.user.resources.add.environment')} value={environmentId} onChange={(e) => setEnvironmentId(e.target.value)} options={[{ value: '', label: t('common.select') }, ...(environmentsQ.data ?? []).map((env) => ({ value: String(env.id), label: environmentLabel(env) }))]} />
          </label>
          <label className="block text-sm font-medium">
            <span className="mb-1 block">{t('admin.user.resources.add.package')}</span>
            <Select ariaLabel={t('admin.user.resources.add.package')} value={packageId} onChange={(e) => setPackageId(e.target.value)} options={[{ value: '', label: t('common.select') }, ...(packagesQ.data ?? []).map((pkg: any) => ({ value: String(pkg.id), label: packageLabel(pkg) }))]} />
          </label>
          <label className="block text-sm font-medium">
            <span className="mb-1 block">{t('admin.user.resources.add.comment')}</span>
            <Input ariaLabel={t('admin.user.resources.add.comment')} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          {validationError ? <div className="text-sm text-danger">{t('admin.user.resources.add.validation')}</div> : null}
        </div>
      </Modal>
      <ConfirmDialog open={Boolean(removeRecord)} onCancel={() => setRemoveRecord(null)} onConfirm={() => removeM.mutate()} confirmLoading={removeM.isPending} danger title={t('admin.user.resources.remove.title')} description={t('admin.user.resources.remove.body')} confirmLabel={t('admin.user.resources.remove')} />
    </div>
  );
}
