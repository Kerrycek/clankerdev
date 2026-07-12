import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';
import { Button } from '../../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { Select } from '../../../../components/ui/Select';
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
  const packagesQ = useQuery({
    queryKey: ['cluster_resource_packages', { isPersonal: false, limit: 500 }],
    queryFn: async () => (await fetchClusterResourcePackages({ isPersonal: false, limit: 500 })).data,
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
          <h1 className="text-xl font-semibold">{t('admin.user.packages.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('admin.user.packages.subtitle')}</p>
        </div>
        <Button variant="primary" onClick={() => setAddOpen(true)} testId="admin.user.resources.add">{t('admin.user.resources.add')}</Button>
      </div>
      {assignmentsQ.isLoading ? <div className="text-sm text-muted">{t('common.loading')}</div> : null}
      {!assignmentsQ.isLoading && grouped.length === 0 ? <EmptyState title={t('admin.user.resources.empty.title')} body={t('admin.user.resources.empty.body')} /> : null}
      {grouped.map((group) => (
        <Card key={group.key} testId={`admin.user.resources.environment.${group.key}`}>
          <CardHeader title={environmentLabel(group.environment)} />
          <CardBody>
            <div>
            {group.rows.map((row: any) => {
              const pkg = row.cluster_resource_package;
              const items = itemsByPackage.get(Number(pkg?.id)) ?? [];
              return <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><span className="font-medium">{packageLabel(pkg)}</span>{row.comment ? <span className="ml-2 text-xs text-muted">{row.comment}</span> : null}</div>
                  {items.length ? <span className="text-xs text-muted">{items.map((item: any) => `${label(item.cluster_resource?.label, label(item.cluster_resource?.name))}: ${resourceValue(item.value, item.cluster_resource)}`).join(' · ')}</span> : null}
                </div>
                <div className="flex gap-2"><Link className="text-sm underline" to={`/admin/cluster/resource-packages/${pkg?.id}`}>{t('admin.user.resources.open')}</Link><Button size="sm" variant="danger" onClick={() => setRemoveRecord(row)}>{t('admin.user.resources.remove')}</Button></div>
              </div>;
            })}
            </div>
          </CardBody>
        </Card>
      ))}
      <Modal open={addOpen} onClose={() => !addM.isPending && setAddOpen(false)} title={t('admin.user.resources.add.title')} testId="admin.user.resources.add.modal" footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button><Button variant="primary" loading={addM.isPending} onClick={() => addM.mutate()}>{t('admin.user.resources.add.save')}</Button></>}>
        <div className="space-y-3">
          <Select label={t('admin.user.resources.add.environment')} value={environmentId} onChange={(e) => setEnvironmentId(e.target.value)} options={[{ value: '', label: t('common.select') }, ...(environmentsQ.data ?? []).map((env) => ({ value: String(env.id), label: environmentLabel(env) }))]} />
          <Select label={t('admin.user.resources.add.package')} value={packageId} onChange={(e) => setPackageId(e.target.value)} options={[{ value: '', label: t('common.select') }, ...(packagesQ.data ?? []).map((pkg: any) => ({ value: String(pkg.id), label: packageLabel(pkg) }))]} />
          <Input label={t('admin.user.resources.add.comment')} value={comment} onChange={(e) => setComment(e.target.value)} />
          {validationError ? <div className="text-sm text-danger">{t('admin.user.resources.add.validation')}</div> : null}
        </div>
      </Modal>
      <ConfirmDialog open={Boolean(removeRecord)} onCancel={() => setRemoveRecord(null)} onConfirm={() => removeM.mutate()} confirmLoading={removeM.isPending} danger title={t('admin.user.resources.remove.title')} description={t('admin.user.resources.remove.body')} confirmLabel={t('admin.user.resources.remove')} />
    </div>
  );
}
