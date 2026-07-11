import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';
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
    const groups = new Map<string, UserClusterResourcePackage[]>();
    for (const row of assignments) {
      const env: any = row.environment ?? row.cluster_resource_package?.environment;
      const key = typeof env?.id === 'number' ? String(env.id) : 'none';
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups.entries()].map(([key, rows]) => ({ key, environment: rows[0]?.environment ?? rows[0]?.cluster_resource_package?.environment, rows }));
  }, [assignments]);

  const limitCount = useMemo(() => [...itemsByPackage.values()].reduce((total, items) => total + items.length, 0), [itemsByPackage]);

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
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t('admin.user.resources.summary.assignments')} value={assignments.length} />
        <StatCard label={t('admin.user.resources.summary.environments')} value={grouped.length} />
        <StatCard label={t('admin.user.resources.summary.limits')} value={limitCount} />
      </div>
      {assignmentsQ.isLoading ? <div className="text-sm text-muted">{t('common.loading')}</div> : null}
      {!assignmentsQ.isLoading && assignments.length === 0 ? <EmptyState title={t('admin.user.resources.empty.title')} body={t('admin.user.resources.empty.body')} /> : null}
      {grouped.map((group) => (
        <Card key={group.key} testId={`admin.user.resources.environment.${group.key}`}>
          <CardHeader title={environmentLabel(group.environment)} subtitle={`${group.rows.length}× ${t('admin.user.resources.summary.assignments').toLowerCase()}`} />
          <CardBody className="space-y-3">
            {group.rows.map((row: any) => {
              const pkg = row.cluster_resource_package;
              const items = itemsByPackage.get(Number(pkg?.id)) ?? [];
              return <div key={row.id} className="rounded-md border border-border bg-surface-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><div className="font-medium">{packageLabel(pkg)}</div>{row.comment ? <div className="text-xs text-muted">{row.comment}</div> : null}</div>
                  <div className="flex gap-2"><Link className="text-sm underline" to={`/admin/cluster/resource-packages/${pkg?.id}`}>{t('admin.user.resources.open')}</Link><Button size="sm" variant="danger" onClick={() => setRemoveRecord(row)}>{t('admin.user.resources.remove')}</Button></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {items.length ? items.map((item: any) => <Badge key={item.id} variant="neutral">{label(item.cluster_resource?.label, label(item.cluster_resource?.name))}: {item.value ?? '—'}</Badge>) : <span className="text-sm text-muted">{t('admin.user.resources.none')}</span>}
                </div>
              </div>;
            })}
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
